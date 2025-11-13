/**
 * RBAC Permission Service
 *
 * Handles CRUD operations for permissions.
 */

import { db } from '@/lib/db';
import { permissions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { CreatePermissionInput, Permission } from './types';
import { logAccessAttempt } from './audit-service';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ service: 'rbac-permission-service' });

/**
 * Create a new permission
 */
export async function createPermission(input: CreatePermissionInput, createdBy?: number): Promise<Permission> {
  try {
    const [permission] = await db.insert(permissions).values({
      name: input.name,
      displayName: input.displayName,
      description: input.description ?? null,
      resourceType: input.resourceType,
      resourceName: input.resourceName,
      action: input.action,
      metadata: input.metadata ?? null,
    }).returning();

    await logAccessAttempt({
      userId: createdBy,
      action: 'permission_created',
      resourceType: 'permission',
      resourceId: permission.id,
      permissionId: permission.id,
      result: 'success',
      metadata: { permissionName: permission.name },
    });

    logger.info({ permissionId: permission.id, permissionName: permission.name }, 'Permission created');

    return permission;
  } catch (error) {
    logger.error({ error, input }, 'Failed to create permission');
    throw error;
  }
}

/**
 * Get a permission by ID
 */
export async function getPermissionById(permissionId: number): Promise<Permission | null> {
  try {
    const [permission] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, permissionId))
      .limit(1);

    return permission || null;
  } catch (error) {
    logger.error({ error, permissionId }, 'Failed to get permission by ID');
    return null;
  }
}

/**
 * Get a permission by name
 */
export async function getPermissionByName(name: string): Promise<Permission | null> {
  try {
    const [permission] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.name, name))
      .limit(1);

    return permission || null;
  } catch (error) {
    logger.error({ error, name }, 'Failed to get permission by name');
    return null;
  }
}

/**
 * List all permissions
 */
export async function listPermissions(options?: {
  resourceType?: string;
  resourceName?: string;
  action?: string;
  isActive?: boolean;
}): Promise<Permission[]> {
  try {
    let query = db.select().from(permissions);

    const conditions = [];

    if (options?.resourceType) {
      conditions.push(eq(permissions.resourceType, options.resourceType));
    }

    if (options?.resourceName) {
      conditions.push(eq(permissions.resourceName, options.resourceName));
    }

    if (options?.action) {
      conditions.push(eq(permissions.action, options.action));
    }

    if (options?.isActive !== undefined) {
      conditions.push(eq(permissions.isActive, options.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query;
    return result;
  } catch (error) {
    logger.error({ error, options }, 'Failed to list permissions');
    return [];
  }
}

/**
 * Update a permission
 */
export async function updatePermission(
  permissionId: number,
  updates: Partial<Omit<CreatePermissionInput, 'name' | 'resourceType' | 'resourceName' | 'action'>>,
  updatedBy?: number
): Promise<Permission | null> {
  try {
    const [permission] = await db
      .update(permissions)
      .set({
        displayName: updates.displayName,
        description: updates.description,
        metadata: updates.metadata,
      })
      .where(eq(permissions.id, permissionId))
      .returning();

    await logAccessAttempt({
      userId: updatedBy,
      action: 'permission_updated',
      resourceType: 'permission',
      resourceId: permissionId,
      permissionId,
      result: 'success',
      metadata: { updates },
    });

    logger.info({ permissionId, permissionName: permission.name }, 'Permission updated');

    return permission || null;
  } catch (error) {
    logger.error({ error, permissionId, updates }, 'Failed to update permission');
    throw error;
  }
}

/**
 * Activate/deactivate a permission
 */
export async function setPermissionActive(permissionId: number, isActive: boolean, updatedBy?: number): Promise<boolean> {
  try {
    await db
      .update(permissions)
      .set({ isActive })
      .where(eq(permissions.id, permissionId));

    await logAccessAttempt({
      userId: updatedBy,
      action: 'permission_updated',
      resourceType: 'permission',
      resourceId: permissionId,
      permissionId,
      result: 'success',
      metadata: { isActive },
    });

    logger.info({ permissionId, isActive }, 'Permission activation status updated');

    return true;
  } catch (error) {
    logger.error({ error, permissionId, isActive }, 'Failed to set permission active status');
    throw error;
  }
}

/**
 * Delete a permission
 */
export async function deletePermission(permissionId: number, deletedBy?: number): Promise<boolean> {
  try {
    const existingPermission = await getPermissionById(permissionId);
    if (!existingPermission) {
      return false;
    }

    await db.delete(permissions).where(eq(permissions.id, permissionId));

    await logAccessAttempt({
      userId: deletedBy,
      action: 'permission_updated',
      resourceType: 'permission',
      resourceId: permissionId,
      permissionId,
      result: 'success',
      metadata: { action: 'deleted' },
    });

    logger.info({ permissionId, permissionName: existingPermission.name }, 'Permission deleted');

    return true;
  } catch (error) {
    logger.error({ error, permissionId }, 'Failed to delete permission');
    throw error;
  }
}

/**
 * Get or create a permission
 *
 * Useful for ensuring permissions exist during runtime.
 */
export async function getOrCreatePermission(input: CreatePermissionInput): Promise<Permission> {
  try {
    // Try to find existing permission
    const existing = await getPermissionByName(input.name);
    if (existing) {
      return existing;
    }

    // Create new permission
    return await createPermission(input);
  } catch (error) {
    logger.error({ error, input }, 'Failed to get or create permission');
    throw error;
  }
}
