/**
 * RBAC Audit Service
 *
 * Handles audit logging for all RBAC operations and access attempts.
 */

import { db } from '@/lib/db';
import { rbacAuditLog } from '@/lib/db/schema';
import { AuditAction, AuditResult } from './types';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ service: 'rbac-audit' });

export interface LogAccessAttemptOptions {
  userId?: number;
  action: AuditAction;
  resourceType?: string;
  resourceId?: number;
  roleId?: number;
  permissionId?: number;
  result: AuditResult;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an access attempt or RBAC operation to the audit log
 */
export async function logAccessAttempt(options: LogAccessAttemptOptions): Promise<void> {
  try {
    await db.insert(rbacAuditLog).values({
      userId: options.userId ?? null,
      action: options.action,
      resourceType: options.resourceType ?? null,
      resourceId: options.resourceId ?? null,
      roleId: options.roleId ?? null,
      permissionId: options.permissionId ?? null,
      result: options.result,
      metadata: options.metadata ?? null,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
    });

    logger.info({
      userId: options.userId,
      action: options.action,
      result: options.result,
    }, 'RBAC audit log entry created');
  } catch (error) {
    logger.error({ error, options }, 'Failed to create audit log entry');
    // Don't throw - audit logging failure shouldn't break the application
  }
}

/**
 * Log a successful permission grant
 */
export async function logPermissionGranted(
  userId: number,
  permission: string,
  projectId?: number,
  metadata?: Record<string, any>
): Promise<void> {
  await logAccessAttempt({
    userId,
    action: 'access_granted',
    resourceType: 'permission',
    result: 'success',
    metadata: {
      permission,
      projectId,
      ...metadata,
    },
  });
}

/**
 * Log a permission denial
 */
export async function logPermissionDenied(
  userId: number,
  permission: string,
  projectId?: number,
  reason?: string
): Promise<void> {
  await logAccessAttempt({
    userId,
    action: 'access_denied',
    resourceType: 'permission',
    result: 'denied',
    metadata: {
      permission,
      projectId,
      reason,
    },
  });
}

/**
 * Log a role assignment
 */
export async function logRoleAssigned(
  userId: number,
  roleId: number,
  grantedBy?: number,
  metadata?: Record<string, any>
): Promise<void> {
  await logAccessAttempt({
    userId: grantedBy,
    action: 'grant_role',
    resourceType: 'role',
    resourceId: userId,
    roleId,
    result: 'success',
    metadata,
  });
}

/**
 * Log a role revocation
 */
export async function logRoleRevoked(
  userId: number,
  roleId: number,
  revokedBy?: number,
  metadata?: Record<string, any>
): Promise<void> {
  await logAccessAttempt({
    userId: revokedBy,
    action: 'revoke_role',
    resourceType: 'role',
    resourceId: userId,
    roleId,
    result: 'success',
    metadata,
  });
}
