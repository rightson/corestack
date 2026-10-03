/**
 * RBAC Impersonation Service
 *
 * Handles user impersonation for super admin group members.
 * Allows admins to switch to any user's perspective for support and debugging.
 */

import { db } from '@/lib/db';
import { impersonationSessions, groupMembers, groups, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logAccessAttempt } from './audit-service';
import { createLogger } from '@/lib/observability/logger';
import crypto from 'crypto';

const logger = createLogger({ service: 'rbac-impersonation' });

// Special group name for super admins
export const SUPER_ADMIN_GROUP_NAME = 'super_admins';

// Default impersonation session duration (1 hour)
const DEFAULT_SESSION_DURATION_MS = 60 * 60 * 1000;

export interface ImpersonationSession {
  id: number;
  adminUserId: number;
  impersonatedUserId: number;
  sessionToken: string;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isActive: boolean;
  createdAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
}

export interface StartImpersonationInput {
  adminUserId: number;
  impersonatedUserId: number;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
}

/**
 * Check if a user is a member of the super admin group
 */
export async function isSuperAdmin(userId: number): Promise<boolean> {
  try {
    const result = await db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groups.name, SUPER_ADMIN_GROUP_NAME)
        )
      )
      .limit(1);

    return result.length > 0;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to check super admin status');
    return false;
  }
}

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Start an impersonation session
 */
export async function startImpersonation(input: StartImpersonationInput): Promise<ImpersonationSession | null> {
  const { adminUserId, impersonatedUserId, reason, ipAddress, userAgent, durationMs } = input;

  try {
    // 1. Check if admin user is a super admin
    const isAdmin = await isSuperAdmin(adminUserId);
    if (!isAdmin) {
      logger.warn({ adminUserId, impersonatedUserId }, 'Non-super-admin attempted impersonation');

      await logAccessAttempt({
        userId: adminUserId,
        action: 'access_denied',
        resourceType: 'impersonation',
        resourceId: impersonatedUserId,
        result: 'denied',
        metadata: { reason: 'not_super_admin' },
        ipAddress,
        userAgent,
      });

      return null;
    }

    // 2. Verify impersonated user exists
    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, impersonatedUserId))
      .limit(1);

    if (!targetUser) {
      logger.warn({ adminUserId, impersonatedUserId }, 'Attempted to impersonate non-existent user');
      return null;
    }

    // 3. Prevent impersonating yourself
    if (adminUserId === impersonatedUserId) {
      logger.warn({ adminUserId }, 'Attempted to impersonate self');
      return null;
    }

    // 4. End any existing active sessions for this admin
    await db
      .update(impersonationSessions)
      .set({
        isActive: false,
        endedAt: new Date(),
      })
      .where(
        and(
          eq(impersonationSessions.adminUserId, adminUserId),
          eq(impersonationSessions.isActive, true)
        )
      );

    // 5. Create new impersonation session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + (durationMs || DEFAULT_SESSION_DURATION_MS));

    const [session] = await db
      .insert(impersonationSessions)
      .values({
        adminUserId,
        impersonatedUserId,
        sessionToken,
        reason: reason ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        expiresAt,
      })
      .returning();

    // 6. Audit log
    await logAccessAttempt({
      userId: adminUserId,
      action: 'access_granted',
      resourceType: 'impersonation',
      resourceId: impersonatedUserId,
      result: 'success',
      metadata: {
        sessionToken,
        reason,
        expiresAt: expiresAt.toISOString(),
      },
      ipAddress,
      userAgent,
    });

    logger.info(
      { adminUserId, impersonatedUserId, sessionId: session.id },
      'Impersonation session started'
    );

    return session;
  } catch (error) {
    logger.error({ error, input }, 'Failed to start impersonation session');
    return null;
  }
}

/**
 * End an impersonation session
 */
export async function endImpersonation(sessionToken: string): Promise<boolean> {
  try {
    const [session] = await db
      .update(impersonationSessions)
      .set({
        isActive: false,
        endedAt: new Date(),
      })
      .where(
        and(
          eq(impersonationSessions.sessionToken, sessionToken),
          eq(impersonationSessions.isActive, true)
        )
      )
      .returning();

    if (!session) {
      logger.warn({ sessionToken }, 'Attempted to end non-existent or inactive session');
      return false;
    }

    await logAccessAttempt({
      userId: session.adminUserId,
      action: 'access_granted',
      resourceType: 'impersonation',
      resourceId: session.impersonatedUserId,
      result: 'success',
      metadata: {
        action: 'ended',
        sessionId: session.id,
      },
    });

    logger.info(
      { sessionId: session.id, adminUserId: session.adminUserId },
      'Impersonation session ended'
    );

    return true;
  } catch (error) {
    logger.error({ error, sessionToken }, 'Failed to end impersonation session');
    return false;
  }
}

/**
 * Get an active impersonation session by token
 */
export async function getImpersonationSession(sessionToken: string): Promise<ImpersonationSession | null> {
  try {
    const [session] = await db
      .select()
      .from(impersonationSessions)
      .where(
        and(
          eq(impersonationSessions.sessionToken, sessionToken),
          eq(impersonationSessions.isActive, true)
        )
      )
      .limit(1);

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      // Auto-expire the session
      await db
        .update(impersonationSessions)
        .set({
          isActive: false,
          endedAt: new Date(),
        })
        .where(eq(impersonationSessions.id, session.id));

      logger.info({ sessionId: session.id }, 'Impersonation session auto-expired');
      return null;
    }

    return session;
  } catch (error) {
    logger.error({ error, sessionToken }, 'Failed to get impersonation session');
    return null;
  }
}

/**
 * Get all active impersonation sessions for an admin
 */
export async function getAdminActiveSessions(adminUserId: number): Promise<ImpersonationSession[]> {
  try {
    const sessions = await db
      .select()
      .from(impersonationSessions)
      .where(
        and(
          eq(impersonationSessions.adminUserId, adminUserId),
          eq(impersonationSessions.isActive, true)
        )
      );

    return sessions;
  } catch (error) {
    logger.error({ error, adminUserId }, 'Failed to get admin active sessions');
    return [];
  }
}

/**
 * Get all impersonation sessions (for audit purposes)
 */
export async function getImpersonationHistory(options?: {
  adminUserId?: number;
  impersonatedUserId?: number;
  limit?: number;
}): Promise<ImpersonationSession[]> {
  try {
    let query = db.select().from(impersonationSessions);

    const conditions = [];
    if (options?.adminUserId) {
      conditions.push(eq(impersonationSessions.adminUserId, options.adminUserId));
    }
    if (options?.impersonatedUserId) {
      conditions.push(eq(impersonationSessions.impersonatedUserId, options.impersonatedUserId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const sessions = await query.limit(options?.limit || 100);
    return sessions;
  } catch (error) {
    logger.error({ error, options }, 'Failed to get impersonation history');
    return [];
  }
}

/**
 * Validate if a user can be impersonated
 */
export async function canImpersonate(adminUserId: number, targetUserId: number): Promise<boolean> {
  try {
    // Check if admin is super admin
    const isAdmin = await isSuperAdmin(adminUserId);
    if (!isAdmin) {
      return false;
    }

    // Check if target user exists
    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return false;
    }

    // Cannot impersonate yourself
    if (adminUserId === targetUserId) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error, adminUserId, targetUserId }, 'Failed to check impersonation capability');
    return false;
  }
}
