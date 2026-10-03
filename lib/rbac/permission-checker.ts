/**
 * RBAC Permission Checker
 *
 * Core permission checking logic with caching support.
 */

import { db } from '@/lib/db';
import {
  permissions,
  roles,
  rolePermissions,
  userSystemRoles,
  userProjectRoles,
  userGroupRoles,
  groupProjects,
  permissionCache,
} from '@/lib/db/schema';
import { eq, and, or, isNull, lt, gt } from 'drizzle-orm';
import { CheckPermissionOptions } from './types';
import { logPermissionGranted, logPermissionDenied } from './audit-service';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ service: 'rbac-permission-checker' });

// Authorization cache reads/writes are disabled until grant revisions provide
// race-safe invalidation. A stale positive must never survive a revoked grant.

/**
 * Get all user's roles (system, project, and group)
 */
async function getUserAllRoles(userId: number, projectId?: number): Promise<number[]> {
  const roleIds: number[] = [];

  try {
    // 1. Get system roles
    const systemRoles = await db
      .select({ roleId: userSystemRoles.roleId })
      .from(userSystemRoles)
      .where(
        and(
          eq(userSystemRoles.userId, userId),
          or(
            isNull(userSystemRoles.expiresAt),
            gt(userSystemRoles.expiresAt, new Date())
          )
        )
      );

    roleIds.push(...systemRoles.map(r => r.roleId));

    // 2. Get project roles if projectId is provided
    if (projectId) {
      const projectRoles = await db
        .select({ roleId: userProjectRoles.roleId })
        .from(userProjectRoles)
        .where(
          and(
            eq(userProjectRoles.userId, userId),
            eq(userProjectRoles.projectId, projectId),
            or(
              isNull(userProjectRoles.expiresAt),
              gt(userProjectRoles.expiresAt, new Date())
            )
          )
        );

      roleIds.push(...projectRoles.map(r => r.roleId));

      // 3. Get group roles for this project's groups
      const groupRoles = await db
        .select({ roleId: userGroupRoles.roleId })
        .from(userGroupRoles)
        .innerJoin(groupProjects, eq(userGroupRoles.groupId, groupProjects.groupId))
        .where(
          and(
            eq(userGroupRoles.userId, userId),
            eq(groupProjects.projectId, projectId),
            or(
              isNull(userGroupRoles.expiresAt),
              gt(userGroupRoles.expiresAt, new Date())
            )
          )
        );

      roleIds.push(...groupRoles.map(r => r.roleId));
    }

    return [...new Set(roleIds)]; // Remove duplicates
  } catch (error) {
    logger.error({ error, userId, projectId }, 'Failed to get user roles');
    return [];
  }
}

/**
 * Get all permissions from a list of roles
 */
async function getRolePermissions(roleIds: number[]): Promise<string[]> {
  if (roleIds.length === 0) {
    return [];
  }

  try {
    const perms = await db
      .select({ name: permissions.name })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
      .where(
        and(
          eq(permissions.isActive, true),
          eq(roles.isActive, true),
          or(...roleIds.map(id => eq(rolePermissions.roleId, id)))
        )
      );

    return perms.map(p => p.name);
  } catch (error) {
    logger.error({ error, roleIds }, 'Failed to get role permissions');
    return [];
  }
}

/**
 * Check if a user has a specific permission
 *
 * Permission resolution follows this hierarchy:
 * 1. System-level permissions (user_system_roles)
 * 2. Group-level permissions (user_group_roles)
 * 3. Project-level permissions (user_project_roles)
 */
export async function checkPermission(options: CheckPermissionOptions): Promise<boolean> {
  const { userId, permission, projectId } = options;

  logger.debug({ userId, permission, projectId }, 'Checking permission');

  try {
    // 2. Get the permission ID
    const perm = await db
      .select()
      .from(permissions)
      .where(
        and(
          eq(permissions.name, permission),
          eq(permissions.isActive, true)
        )
      )
      .limit(1);

    if (perm.length === 0) {
      logger.warn({ permission }, 'Permission not found');
      await logPermissionDenied(userId, permission, projectId, 'permission_not_found');
      return false;
    }

    // 3. Get all user's roles (system, project, group)
    const userRoles = await getUserAllRoles(userId, projectId);

    if (userRoles.length === 0) {
      logger.debug({ userId, permission, projectId }, 'User has no roles');
      await logPermissionDenied(userId, permission, projectId, 'no_roles');

      return false;
    }

    // 4. Get all permissions from roles
    const userPermissions = await getRolePermissions(userRoles);

    // 5. Check if permission exists
    const hasPermission = userPermissions.includes(permission);

    // 7. Audit log
    if (hasPermission) {
      await logPermissionGranted(userId, permission, projectId);
    } else {
      await logPermissionDenied(userId, permission, projectId, 'insufficient_permissions');
    }

    logger.info({ userId, permission, projectId, hasPermission }, 'Permission check completed');

    return hasPermission;
  } catch (error) {
    logger.error({ error, userId, permission, projectId }, 'Permission check failed');
    await logPermissionDenied(userId, permission, projectId, 'error');
    return false;
  }
}

/**
 * Check multiple permissions at once (optimized)
 */
export async function checkMultiplePermissions(
  userId: number,
  permissionNames: string[],
  projectId?: number
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};

  try {
    // Get all user's roles once
    const userRoles = await getUserAllRoles(userId, projectId);

    if (userRoles.length === 0) {
      // User has no roles, deny all permissions
      for (const perm of permissionNames) {
        result[perm] = false;
      }
      return result;
    }

    // Get all permissions from roles
    const userPermissions = await getRolePermissions(userRoles);

    // Check each permission
    for (const perm of permissionNames) {
      result[perm] = userPermissions.includes(perm);
    }

    return result;
  } catch (error) {
    logger.error({ error, userId, permissions: permissionNames, projectId }, 'Multiple permission check failed');

    // On error, deny all permissions
    for (const perm of permissionNames) {
      result[perm] = false;
    }

    return result;
  }
}

/**
 * Invalidate permission cache for a user
 */
export async function invalidateUserPermissionCache(userId: number, projectId?: number): Promise<void> {
  try {
    if (projectId) {
      await db
        .delete(permissionCache)
        .where(
          and(
            eq(permissionCache.userId, userId),
            eq(permissionCache.projectId, projectId)
          )
        );
    } else {
      await db
        .delete(permissionCache)
        .where(eq(permissionCache.userId, userId));
    }

    logger.info({ userId, projectId }, 'User permission cache invalidated');
  } catch (error) {
    logger.error({ error, userId, projectId }, 'Failed to invalidate permission cache');
  }
}

/**
 * Clear all expired cache entries
 */
export async function clearExpiredCache(): Promise<void> {
  try {
    await db
      .delete(permissionCache)
      .where(lt(permissionCache.expiresAt, new Date()));

    logger.info('Expired permission cache entries cleared');
  } catch (error) {
    logger.error({ error }, 'Failed to clear expired cache');
  }
}
