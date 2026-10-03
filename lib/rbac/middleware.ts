/**
 * RBAC Middleware Utilities
 *
 * Helper functions and decorators for applying permission checks to endpoints.
 */

import { checkPermission, checkMultiplePermissions } from './permission-checker';
import { TRPCError } from '@trpc/server';

/**
 * Require one of multiple permissions (OR logic)
 */
export async function requireAnyPermission(
  userId: number,
  permissions: string[],
  projectId?: number
): Promise<void> {
  const results = await checkMultiplePermissions(userId, permissions, projectId);
  const hasAny = Object.values(results).some(has => has);

  if (!hasAny) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Requires one of: ${permissions.join(', ')}`,
    });
  }
}

/**
 * Require all of multiple permissions (AND logic)
 */
export async function requireAllPermissions(
  userId: number,
  permissions: string[],
  projectId?: number
): Promise<void> {
  const results = await checkMultiplePermissions(userId, permissions, projectId);
  const hasAll = Object.values(results).every(has => has);

  if (!hasAll) {
    const missing = Object.entries(results)
      .filter(([_, has]) => !has)
      .map(([perm]) => perm);

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Missing permissions: ${missing.join(', ')}`,
    });
  }
}

/**
 * Check resource-specific permission
 * Useful for checking permissions on specific resources (e.g., "can user edit THIS post?")
 */
export async function checkResourcePermission(
  userId: number,
  permission: string,
  resourceOwnerId?: number,
  projectId?: number
): Promise<boolean> {
  // Check base permission
  const hasPermission = await checkPermission({
    userId,
    permission,
    projectId,
  });

  if (!hasPermission) {
    return false;
  }

  // If checking on a specific resource with an owner, verify ownership
  // unless user has admin-level permission
  if (resourceOwnerId !== undefined) {
    // User owns the resource
    if (userId === resourceOwnerId) {
      return true;
    }

    // Check if user has admin-level permission (e.g., "*.update.all" vs "*.update.own")
    const adminPermission = permission.replace('.', '.all.');
    const hasAdminPerm = await checkPermission({
      userId,
      permission: adminPermission,
      projectId,
      useCache: true,
    });

    return hasAdminPerm;
  }

  return true;
}

/**
 * Permission requirement configurations
 */
export interface PermissionRequirement {
  // Single permission
  permission?: string;

  // Multiple permissions (OR logic)
  anyOf?: string[];

  // Multiple permissions (AND logic)
  allOf?: string[];

  // Optional project scope
  projectId?: number;

  // Custom error message
  errorMessage?: string;
}

/**
 * Check permission requirement
 */
export async function checkPermissionRequirement(
  userId: number,
  requirement: PermissionRequirement
): Promise<void> {
  const { permission, anyOf, allOf, projectId, errorMessage } = requirement;

  try {
    if (permission) {
      const has = await checkPermission({ userId, permission, projectId });
      if (!has) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: errorMessage || `Permission required: ${permission}`,
        });
      }
    } else if (anyOf) {
      await requireAnyPermission(userId, anyOf, projectId);
    } else if (allOf) {
      await requireAllPermissions(userId, allOf, projectId);
    }
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: errorMessage || 'Insufficient permissions',
    });
  }
}

/**
 * Extract project ID from various input formats
 */
export function extractProjectId(input: any): number | undefined {
  if (!input) return undefined;

  // Direct projectId field
  if (input.projectId) return input.projectId;

  // Nested in params
  if (input.params?.projectId) return input.params.projectId;

  // Nested in data
  if (input.data?.projectId) return input.data.projectId;

  return undefined;
}
