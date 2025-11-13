/**
 * RBAC User Role Service
 *
 * Handles user role assignments and revocations.
 */

import { db } from '@/lib/db';
import {
  userSystemRoles,
  userProjectRoles,
  userGroupRoles,
  roles,
  permissions,
  rolePermissions,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { AssignRoleInput, UserPermissionsResult } from './types';
import { logRoleAssigned, logRoleRevoked } from './audit-service';
import { invalidateUserPermissionCache } from './permission-checker';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ service: 'rbac-user-role-service' });

/**
 * Assign a role to a user
 */
export async function assignRole(input: AssignRoleInput): Promise<void> {
  const { userId, roleId, grantedBy, expiresAt, projectId, groupId } = input;

  try {
    if (projectId) {
      // Assign project role
      await db
        .insert(userProjectRoles)
        .values({
          userId,
          projectId,
          roleId,
          grantedBy: grantedBy ?? null,
          expiresAt: expiresAt ?? null,
        })
        .onConflictDoNothing();

      logger.info({ userId, roleId, projectId }, 'Project role assigned');
    } else if (groupId) {
      // Assign group role
      await db
        .insert(userGroupRoles)
        .values({
          userId,
          groupId,
          roleId,
          grantedBy: grantedBy ?? null,
          expiresAt: expiresAt ?? null,
        })
        .onConflictDoNothing();

      logger.info({ userId, roleId, groupId }, 'Group role assigned');
    } else {
      // Assign system role
      await db
        .insert(userSystemRoles)
        .values({
          userId,
          roleId,
          grantedBy: grantedBy ?? null,
          expiresAt: expiresAt ?? null,
        })
        .onConflictDoNothing();

      logger.info({ userId, roleId }, 'System role assigned');
    }

    // Invalidate cache
    await invalidateUserPermissionCache(userId, projectId);

    // Audit log
    await logRoleAssigned(userId, roleId, grantedBy, { projectId, groupId, expiresAt });
  } catch (error) {
    logger.error({ error, input }, 'Failed to assign role');
    throw error;
  }
}

/**
 * Revoke a role from a user
 */
export async function revokeRole(
  userId: number,
  roleId: number,
  options?: {
    projectId?: number;
    groupId?: number;
    revokedBy?: number;
  }
): Promise<void> {
  try {
    if (options?.projectId) {
      // Revoke project role
      await db
        .delete(userProjectRoles)
        .where(
          and(
            eq(userProjectRoles.userId, userId),
            eq(userProjectRoles.roleId, roleId),
            eq(userProjectRoles.projectId, options.projectId)
          )
        );

      logger.info({ userId, roleId, projectId: options.projectId }, 'Project role revoked');
    } else if (options?.groupId) {
      // Revoke group role
      await db
        .delete(userGroupRoles)
        .where(
          and(
            eq(userGroupRoles.userId, userId),
            eq(userGroupRoles.roleId, roleId),
            eq(userGroupRoles.groupId, options.groupId)
          )
        );

      logger.info({ userId, roleId, groupId: options.groupId }, 'Group role revoked');
    } else {
      // Revoke system role
      await db
        .delete(userSystemRoles)
        .where(
          and(
            eq(userSystemRoles.userId, userId),
            eq(userSystemRoles.roleId, roleId)
          )
        );

      logger.info({ userId, roleId }, 'System role revoked');
    }

    // Invalidate cache
    await invalidateUserPermissionCache(userId, options?.projectId);

    // Audit log
    await logRoleRevoked(userId, roleId, options?.revokedBy, {
      projectId: options?.projectId,
      groupId: options?.groupId,
    });
  } catch (error) {
    logger.error({ error, userId, roleId, options }, 'Failed to revoke role');
    throw error;
  }
}

/**
 * Get all roles and permissions for a user
 */
export async function getUserPermissions(userId: number, projectId?: number): Promise<UserPermissionsResult> {
  try {
    const result: UserPermissionsResult = {
      systemRoles: [],
      projectRoles: [],
      groupRoles: [],
      permissions: [],
    };

    // 1. Get system roles
    const systemRolesData = await db
      .select({
        role: roles,
      })
      .from(userSystemRoles)
      .innerJoin(roles, eq(userSystemRoles.roleId, roles.id))
      .where(
        and(
          eq(userSystemRoles.userId, userId),
          eq(roles.isActive, true)
        )
      );

    result.systemRoles = systemRolesData.map(r => r.role);

    // 2. Get project roles if projectId is provided
    if (projectId) {
      const projectRolesData = await db
        .select({
          role: roles,
          projectId: userProjectRoles.projectId,
        })
        .from(userProjectRoles)
        .innerJoin(roles, eq(userProjectRoles.roleId, roles.id))
        .where(
          and(
            eq(userProjectRoles.userId, userId),
            eq(userProjectRoles.projectId, projectId),
            eq(roles.isActive, true)
          )
        );

      result.projectRoles = projectRolesData.map(r => ({
        ...r.role,
        projectId: r.projectId,
      }));

      // 3. Get group roles
      const groupRolesData = await db
        .select({
          role: roles,
          groupId: userGroupRoles.groupId,
        })
        .from(userGroupRoles)
        .innerJoin(roles, eq(userGroupRoles.roleId, roles.id))
        .where(
          and(
            eq(userGroupRoles.userId, userId),
            eq(roles.isActive, true)
          )
        );

      result.groupRoles = groupRolesData.map(r => ({
        ...r.role,
        groupId: r.groupId,
      }));
    }

    // 4. Get all permissions from all roles
    const allRoleIds = [
      ...result.systemRoles.map(r => r.id),
      ...result.projectRoles.map(r => r.id),
      ...result.groupRoles.map(r => r.id),
    ];

    if (allRoleIds.length > 0) {
      const perms = await db
        .select({ name: permissions.name })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(
          and(
            inArray(rolePermissions.roleId, allRoleIds),
            eq(permissions.isActive, true)
          )
        );

      result.permissions = [...new Set(perms.map(p => p.name))];
    }

    return result;
  } catch (error) {
    logger.error({ error, userId, projectId }, 'Failed to get user permissions');
    return {
      systemRoles: [],
      projectRoles: [],
      groupRoles: [],
      permissions: [],
    };
  }
}

/**
 * Get users by role
 */
export async function getUsersByRole(
  roleId: number,
  options?: {
    projectId?: number;
    groupId?: number;
  }
): Promise<number[]> {
  try {
    const userIds: number[] = [];

    if (options?.projectId) {
      // Get users with this project role
      const users = await db
        .select({ userId: userProjectRoles.userId })
        .from(userProjectRoles)
        .where(
          and(
            eq(userProjectRoles.roleId, roleId),
            eq(userProjectRoles.projectId, options.projectId)
          )
        );

      userIds.push(...users.map(u => u.userId));
    } else if (options?.groupId) {
      // Get users with this group role
      const users = await db
        .select({ userId: userGroupRoles.userId })
        .from(userGroupRoles)
        .where(
          and(
            eq(userGroupRoles.roleId, roleId),
            eq(userGroupRoles.groupId, options.groupId)
          )
        );

      userIds.push(...users.map(u => u.userId));
    } else {
      // Get users with this system role
      const users = await db
        .select({ userId: userSystemRoles.userId })
        .from(userSystemRoles)
        .where(eq(userSystemRoles.roleId, roleId));

      userIds.push(...users.map(u => u.userId));
    }

    return [...new Set(userIds)];
  } catch (error) {
    logger.error({ error, roleId, options }, 'Failed to get users by role');
    return [];
  }
}

/**
 * Check if a user has a specific role
 */
export async function userHasRole(
  userId: number,
  roleId: number,
  options?: {
    projectId?: number;
    groupId?: number;
  }
): Promise<boolean> {
  try {
    if (options?.projectId) {
      const [result] = await db
        .select()
        .from(userProjectRoles)
        .where(
          and(
            eq(userProjectRoles.userId, userId),
            eq(userProjectRoles.roleId, roleId),
            eq(userProjectRoles.projectId, options.projectId)
          )
        )
        .limit(1);

      return !!result;
    } else if (options?.groupId) {
      const [result] = await db
        .select()
        .from(userGroupRoles)
        .where(
          and(
            eq(userGroupRoles.userId, userId),
            eq(userGroupRoles.roleId, roleId),
            eq(userGroupRoles.groupId, options.groupId)
          )
        )
        .limit(1);

      return !!result;
    } else {
      const [result] = await db
        .select()
        .from(userSystemRoles)
        .where(
          and(
            eq(userSystemRoles.userId, userId),
            eq(userSystemRoles.roleId, roleId)
          )
        )
        .limit(1);

      return !!result;
    }
  } catch (error) {
    logger.error({ error, userId, roleId, options }, 'Failed to check if user has role');
    return false;
  }
}
