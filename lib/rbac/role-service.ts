/**
 * RBAC Role Service
 *
 * Handles CRUD operations for roles and role-permission assignments.
 */

import { db } from '@/lib/db';
import { roles, rolePermissions, permissions } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { CreateRoleInput, Role } from './types';
import { logAccessAttempt } from './audit-service';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ service: 'rbac-role-service' });

/**
 * Create a new role
 */
export async function createRole(input: CreateRoleInput, createdBy?: number): Promise<Role> {
  try {
    const [role] = await db.insert(roles).values({
      name: input.name,
      displayName: input.displayName,
      description: input.description ?? null,
      roleType: input.roleType,
      isBuiltIn: input.isBuiltIn ?? false,
      metadata: input.metadata ?? null,
    }).returning();

    await logAccessAttempt({
      userId: createdBy,
      action: 'role_created',
      resourceType: 'role',
      resourceId: role.id,
      roleId: role.id,
      result: 'success',
      metadata: { roleName: role.name },
    });

    logger.info({ roleId: role.id, roleName: role.name }, 'Role created');

    return role;
  } catch (error) {
    logger.error({ error, input }, 'Failed to create role');
    throw error;
  }
}

/**
 * Get a role by ID
 */
export async function getRoleById(roleId: number): Promise<Role | null> {
  try {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    return role || null;
  } catch (error) {
    logger.error({ error, roleId }, 'Failed to get role by ID');
    return null;
  }
}

/**
 * Get a role by name
 */
export async function getRoleByName(name: string): Promise<Role | null> {
  try {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, name))
      .limit(1);

    return role || null;
  } catch (error) {
    logger.error({ error, name }, 'Failed to get role by name');
    return null;
  }
}

/**
 * List all roles
 */
export async function listRoles(options?: {
  roleType?: string;
  isActive?: boolean;
  includeBuiltIn?: boolean;
}): Promise<Role[]> {
  try {
    let query = db.select().from(roles);

    const conditions = [];

    if (options?.roleType) {
      conditions.push(eq(roles.roleType, options.roleType));
    }

    if (options?.isActive !== undefined) {
      conditions.push(eq(roles.isActive, options.isActive));
    }

    if (options?.includeBuiltIn === false) {
      conditions.push(eq(roles.isBuiltIn, false));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query;
    return result;
  } catch (error) {
    logger.error({ error, options }, 'Failed to list roles');
    return [];
  }
}

/**
 * Update a role
 */
export async function updateRole(
  roleId: number,
  updates: Partial<Omit<CreateRoleInput, 'name'>>,
  updatedBy?: number
): Promise<Role | null> {
  try {
    // Check if role is built-in
    const existingRole = await getRoleById(roleId);
    if (!existingRole) {
      logger.warn({ roleId }, 'Role not found for update');
      return null;
    }

    if (existingRole.isBuiltIn) {
      logger.warn({ roleId, roleName: existingRole.name }, 'Cannot update built-in role');
      throw new Error('Cannot update built-in roles');
    }

    const [role] = await db
      .update(roles)
      .set({
        displayName: updates.displayName,
        description: updates.description,
        metadata: updates.metadata,
        updatedAt: new Date(),
      })
      .where(eq(roles.id, roleId))
      .returning();

    await logAccessAttempt({
      userId: updatedBy,
      action: 'role_updated',
      resourceType: 'role',
      resourceId: roleId,
      roleId,
      result: 'success',
      metadata: { updates },
    });

    logger.info({ roleId, roleName: role.name }, 'Role updated');

    return role || null;
  } catch (error) {
    logger.error({ error, roleId, updates }, 'Failed to update role');
    throw error;
  }
}

/**
 * Activate/deactivate a role
 */
export async function setRoleActive(roleId: number, isActive: boolean, updatedBy?: number): Promise<boolean> {
  try {
    const existingRole = await getRoleById(roleId);
    if (!existingRole) {
      return false;
    }

    if (existingRole.isBuiltIn) {
      logger.warn({ roleId, roleName: existingRole.name }, 'Cannot deactivate built-in role');
      throw new Error('Cannot deactivate built-in roles');
    }

    await db
      .update(roles)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(roles.id, roleId));

    await logAccessAttempt({
      userId: updatedBy,
      action: 'role_updated',
      resourceType: 'role',
      resourceId: roleId,
      roleId,
      result: 'success',
      metadata: { isActive },
    });

    logger.info({ roleId, isActive }, 'Role activation status updated');

    return true;
  } catch (error) {
    logger.error({ error, roleId, isActive }, 'Failed to set role active status');
    throw error;
  }
}

/**
 * Delete a role (only non-built-in roles)
 */
export async function deleteRole(roleId: number, deletedBy?: number): Promise<boolean> {
  try {
    const existingRole = await getRoleById(roleId);
    if (!existingRole) {
      return false;
    }

    if (existingRole.isBuiltIn) {
      logger.warn({ roleId, roleName: existingRole.name }, 'Cannot delete built-in role');
      throw new Error('Cannot delete built-in roles');
    }

    await db.delete(roles).where(eq(roles.id, roleId));

    await logAccessAttempt({
      userId: deletedBy,
      action: 'role_updated',
      resourceType: 'role',
      resourceId: roleId,
      roleId,
      result: 'success',
      metadata: { action: 'deleted' },
    });

    logger.info({ roleId, roleName: existingRole.name }, 'Role deleted');

    return true;
  } catch (error) {
    logger.error({ error, roleId }, 'Failed to delete role');
    throw error;
  }
}

/**
 * Assign permissions to a role
 */
export async function assignPermissionsToRole(
  roleId: number,
  permissionIds: number[],
  grantedBy?: number
): Promise<void> {
  try {
    // Remove duplicates
    const uniquePermissionIds = [...new Set(permissionIds)];

    // Verify all permissions exist
    const existingPermissions = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(inArray(permissions.id, uniquePermissionIds));

    if (existingPermissions.length !== uniquePermissionIds.length) {
      throw new Error('One or more permission IDs are invalid');
    }

    // Insert role-permission mappings
    for (const permissionId of uniquePermissionIds) {
      await db
        .insert(rolePermissions)
        .values({
          roleId,
          permissionId,
          grantedBy: grantedBy ?? null,
        })
        .onConflictDoNothing();
    }

    await logAccessAttempt({
      userId: grantedBy,
      action: 'role_updated',
      resourceType: 'role',
      resourceId: roleId,
      roleId,
      result: 'success',
      metadata: { action: 'permissions_assigned', permissionIds: uniquePermissionIds },
    });

    logger.info({ roleId, permissionIds: uniquePermissionIds }, 'Permissions assigned to role');
  } catch (error) {
    logger.error({ error, roleId, permissionIds }, 'Failed to assign permissions to role');
    throw error;
  }
}

/**
 * Remove permissions from a role
 */
export async function removePermissionsFromRole(
  roleId: number,
  permissionIds: number[],
  revokedBy?: number
): Promise<void> {
  try {
    await db
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          inArray(rolePermissions.permissionId, permissionIds)
        )
      );

    await logAccessAttempt({
      userId: revokedBy,
      action: 'role_updated',
      resourceType: 'role',
      resourceId: roleId,
      roleId,
      result: 'success',
      metadata: { action: 'permissions_removed', permissionIds },
    });

    logger.info({ roleId, permissionIds }, 'Permissions removed from role');
  } catch (error) {
    logger.error({ error, roleId, permissionIds }, 'Failed to remove permissions from role');
    throw error;
  }
}

/**
 * Get all permissions for a role
 */
export async function getRolePermissions(roleId: number): Promise<string[]> {
  try {
    const perms = await db
      .select({ name: permissions.name })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(permissions.isActive, true)
        )
      );

    return perms.map(p => p.name);
  } catch (error) {
    logger.error({ error, roleId }, 'Failed to get role permissions');
    return [];
  }
}
