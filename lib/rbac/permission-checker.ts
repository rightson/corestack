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
  permissionCache,
} from '@/lib/db/schema';
import { eq, and, or, isNull, lt } from 'drizzle-orm';
import { CheckPermissionOptions } from './types';
import { logPermissionGranted, logPermissionDenied } from './audit-service';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ service: 'rbac-permission-checker' });

// Cache TTL in seconds (5 minutes)
const CACHE_TTL_SECONDS = 300;

/**
 * Generate a cache key for permission checks
 */
function generateCacheKey(userId: number, permission: string, projectId?: number): string {
  return `user:${userId}:perm:${permission}${projectId ? `:project:${projectId}` : ''}`;
}

/**
 * Check cached permission
 */
async function checkPermissionCache(
  userId: number,
  permissionName: string,
  projectId?: number
): Promise<boolean | null> {
  const cacheKey = generateCacheKey(userId, permissionName, projectId);

  try {
    const cached = await db
      .select()
      .from(permissionCache)
      .where(
        and(
          eq(permissionCache.cacheKey, cacheKey),
          lt(new Date(), permissionCache.expiresAt)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      logger.debug({ userId, permission: permissionName, projectId, cached: true }, 'Permission cache hit');
      return cached[0].hasPermission;
    }

    return null;
  } catch (error) {
    logger.error({ error, userId, permission: permissionName }, 'Failed to check permission cache');
    return null;
  }
}

/**
 * Cache a permission result
 */
async function cachePermissionResult(
  userId: number,
  permissionId: number,
  permissionName: string,
  projectId: number | undefined,
  hasPermission: boolean
): Promise<void> {
  const cacheKey = generateCacheKey(userId, permissionName, projectId);
  const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);

  try {
    // Delete existing cache entry if it exists
    await db.delete(permissionCache).where(eq(permissionCache.cacheKey, cacheKey));

    // Insert new cache entry
    await db.insert(permissionCache).values({
      userId,
      projectId: projectId ?? null,
      permissionId,
      hasPermission,
      cacheKey,
      expiresAt,
    });

    logger.debug({ userId, permission: permissionName, projectId, hasPermission }, 'Permission cached');
  } catch (error) {
    logger.error({ error, userId, permission: permissionName }, 'Failed to cache permission');
    // Don't throw - caching failure shouldn't break permission checks
  }
}

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
            lt(new Date(), userSystemRoles.expiresAt)
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
              lt(new Date(), userProjectRoles.expiresAt)
            )
          )
        );

      roleIds.push(...projectRoles.map(r => r.roleId));

      // 3. Get group roles for this project's groups
      const groupRoles = await db
        .select({ roleId: userGroupRoles.roleId })
        .from(userGroupRoles)
        .where(
          and(
            eq(userGroupRoles.userId, userId),
            or(
              isNull(userGroupRoles.expiresAt),
              lt(new Date(), userGroupRoles.expiresAt)
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
  const { userId, permission, projectId, useCache = true } = options;

  logger.debug({ userId, permission, projectId }, 'Checking permission');

  try {
    // 1. Check cache first if enabled
    if (useCache) {
      const cached = await checkPermissionCache(userId, permission, projectId);
      if (cached !== null) {
        if (!cached) {
          await logPermissionDenied(userId, permission, projectId, 'cached_denial');
        }
        return cached;
      }
    }

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

    const permissionId = perm[0].id;

    // 3. Get all user's roles (system, project, group)
    const userRoles = await getUserAllRoles(userId, projectId);

    if (userRoles.length === 0) {
      logger.debug({ userId, permission, projectId }, 'User has no roles');
      await logPermissionDenied(userId, permission, projectId, 'no_roles');

      // Cache the denial
      if (useCache) {
        await cachePermissionResult(userId, permissionId, permission, projectId, false);
      }

      return false;
    }

    // 4. Get all permissions from roles
    const userPermissions = await getRolePermissions(userRoles);

    // 5. Check if permission exists
    const hasPermission = userPermissions.includes(permission);

    // 6. Cache result
    if (useCache) {
      await cachePermissionResult(userId, permissionId, permission, projectId, hasPermission);
    }

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
