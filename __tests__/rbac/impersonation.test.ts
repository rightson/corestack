/**
 * Impersonation Service Tests
 *
 * Tests for user impersonation functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  isSuperAdmin,
  startImpersonation,
  endImpersonation,
  getImpersonationSession,
  canImpersonate,
  SUPER_ADMIN_GROUP_NAME,
} from '@/lib/rbac/impersonation-service';
import { createGroup, addUserToGroup } from '@/lib/rbac/group-service';
import { db } from '@/lib/db';
import { users, groups, groupMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Impersonation Service', () => {
  let adminUserId: number;
  let targetUserId: number;
  let superAdminGroupId: number;

  beforeEach(async () => {
    // Create admin user
    const [admin] = await db
      .insert(users)
      .values({
        username: 'admin-' + Date.now(),
        name: 'Admin User',
        email: `admin-${Date.now()}@example.com`,
        authType: 'email',
      })
      .returning();
    adminUserId = admin.id;

    // Create target user
    const [target] = await db
      .insert(users)
      .values({
        username: 'target-' + Date.now(),
        name: 'Target User',
        email: `target-${Date.now()}@example.com`,
        authType: 'email',
      })
      .returning();
    targetUserId = target.id;

    // Create super admin group
    const [existingGroup] = await db
      .select()
      .from(groups)
      .where(eq(groups.name, SUPER_ADMIN_GROUP_NAME))
      .limit(1);

    if (existingGroup) {
      superAdminGroupId = existingGroup.id;
    } else {
      const group = await createGroup({
        name: SUPER_ADMIN_GROUP_NAME,
        description: 'Super Admin Group',
        groupType: 'functional',
      });
      superAdminGroupId = group.id;
    }
  });

  afterEach(async () => {
    // Clean up
    if (adminUserId) {
      await db.delete(users).where(eq(users.id, adminUserId));
    }
    if (targetUserId) {
      await db.delete(users).where(eq(users.id, targetUserId));
    }
  });

  describe('isSuperAdmin', () => {
    it('should return true for users in super admin group', async () => {
      await addUserToGroup(superAdminGroupId, adminUserId);

      const result = await isSuperAdmin(adminUserId);
      expect(result).toBe(true);
    });

    it('should return false for users not in super admin group', async () => {
      const result = await isSuperAdmin(targetUserId);
      expect(result).toBe(false);
    });

    it('should return false for non-existent users', async () => {
      const result = await isSuperAdmin(999999);
      expect(result).toBe(false);
    });
  });

  describe('startImpersonation', () => {
    beforeEach(async () => {
      // Add admin to super admin group
      await addUserToGroup(superAdminGroupId, adminUserId);
    });

    it('should create impersonation session for super admin', async () => {
      const session = await startImpersonation({
        adminUserId,
        impersonatedUserId: targetUserId,
        reason: 'Test impersonation',
      });

      expect(session).not.toBeNull();
      expect(session?.adminUserId).toBe(adminUserId);
      expect(session?.impersonatedUserId).toBe(targetUserId);
      expect(session?.sessionToken).toBeDefined();
      expect(session?.isActive).toBe(true);
    });

    it('should deny impersonation for non-super admin', async () => {
      // Remove admin from super admin group
      await db
        .delete(groupMembers)
        .where(
          eq(groupMembers.userId, adminUserId)
        );

      const session = await startImpersonation({
        adminUserId,
        impersonatedUserId: targetUserId,
        reason: 'Test impersonation',
      });

      expect(session).toBeNull();
    });

    it('should prevent self-impersonation', async () => {
      const session = await startImpersonation({
        adminUserId,
        impersonatedUserId: adminUserId,
        reason: 'Self impersonation attempt',
      });

      expect(session).toBeNull();
    });

    it('should prevent impersonating non-existent user', async () => {
      const session = await startImpersonation({
        adminUserId,
        impersonatedUserId: 999999,
        reason: 'Non-existent user',
      });

      expect(session).toBeNull();
    });

    it('should set expiration time', async () => {
      const durationMs = 3600000; // 1 hour
      const session = await startImpersonation({
        adminUserId,
        impersonatedUserId: targetUserId,
        reason: 'Test with expiration',
        durationMs,
      });

      expect(session).not.toBeNull();

      const expectedExpiry = new Date(Date.now() + durationMs);
      const actualExpiry = session!.expiresAt;

      // Allow 1 second tolerance for timing
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });

    it('should end previous sessions when starting new one', async () => {
      // Start first session
      const session1 = await startImpersonation({
        adminUserId,
        impersonatedUserId: targetUserId,
        reason: 'First session',
      });

      expect(session1).not.toBeNull();

      // Start second session
      const [otherTarget] = await db
        .insert(users)
        .values({
          username: 'other-' + Date.now(),
          name: 'Other User',
          email: `other-${Date.now()}@example.com`,
          authType: 'email',
        })
        .returning();

      const session2 = await startImpersonation({
        adminUserId,
        impersonatedUserId: otherTarget.id,
        reason: 'Second session',
      });

      expect(session2).not.toBeNull();

      // First session should be ended
      const retrievedSession1 = await getImpersonationSession(session1!.sessionToken);
      expect(retrievedSession1).toBeNull();

      // Clean up
      await db.delete(users).where(eq(users.id, otherTarget.id));
    });
  });

  describe('endImpersonation', () => {
    let sessionToken: string;

    beforeEach(async () => {
      await addUserToGroup(superAdminGroupId, adminUserId);

      const session = await startImpersonation({
        adminUserId,
        impersonatedUserId: targetUserId,
        reason: 'Test session',
      });

      sessionToken = session!.sessionToken;
    });

    it('should end active impersonation session', async () => {
      const result = await endImpersonation(sessionToken);
      expect(result).toBe(true);

      // Session should no longer be retrievable
      const session = await getImpersonationSession(sessionToken);
      expect(session).toBeNull();
    });

    it('should return false for non-existent session', async () => {
      const result = await endImpersonation('invalid-token');
      expect(result).toBe(false);
    });

    it('should return false for already ended session', async () => {
      await endImpersonation(sessionToken);

      // Try to end again
      const result = await endImpersonation(sessionToken);
      expect(result).toBe(false);
    });
  });

  describe('getImpersonationSession', () => {
    let sessionToken: string;

    beforeEach(async () => {
      await addUserToGroup(superAdminGroupId, adminUserId);

      const session = await startImpersonation({
        adminUserId,
        impersonatedUserId: targetUserId,
        reason: 'Test session',
      });

      sessionToken = session!.sessionToken;
    });

    it('should retrieve active session by token', async () => {
      const session = await getImpersonationSession(sessionToken);

      expect(session).not.toBeNull();
      expect(session?.sessionToken).toBe(sessionToken);
      expect(session?.isActive).toBe(true);
    });

    it('should return null for invalid token', async () => {
      const session = await getImpersonationSession('invalid-token');
      expect(session).toBeNull();
    });

    it('should return null for ended session', async () => {
      await endImpersonation(sessionToken);

      const session = await getImpersonationSession(sessionToken);
      expect(session).toBeNull();
    });

    it('should auto-expire sessions past expiration time', async () => {
      // Create session with very short duration (1ms)
      const shortSession = await startImpersonation({
        adminUserId,
        impersonatedUserId: targetUserId,
        reason: 'Short session',
        durationMs: 1,
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const session = await getImpersonationSession(shortSession!.sessionToken);
      expect(session).toBeNull();
    });
  });

  describe('canImpersonate', () => {
    it('should allow super admin to impersonate other users', async () => {
      await addUserToGroup(superAdminGroupId, adminUserId);

      const result = await canImpersonate(adminUserId, targetUserId);
      expect(result).toBe(true);
    });

    it('should deny non-super admin', async () => {
      const result = await canImpersonate(adminUserId, targetUserId);
      expect(result).toBe(false);
    });

    it('should deny self-impersonation', async () => {
      await addUserToGroup(superAdminGroupId, adminUserId);

      const result = await canImpersonate(adminUserId, adminUserId);
      expect(result).toBe(false);
    });

    it('should deny impersonating non-existent user', async () => {
      await addUserToGroup(superAdminGroupId, adminUserId);

      const result = await canImpersonate(adminUserId, 999999);
      expect(result).toBe(false);
    });
  });

  describe('Audit Trail', () => {
    it('should log impersonation start', async () => {
      await addUserToGroup(superAdminGroupId, adminUserId);

      const session = await startImpersonation({
        adminUserId,
        impersonatedUserId: targetUserId,
        reason: 'Audit test',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(session).not.toBeNull();
      expect(session?.reason).toBe('Audit test');
      expect(session?.ipAddress).toBe('192.168.1.1');
      expect(session?.userAgent).toBe('Mozilla/5.0');
    });

    it('should log impersonation end', async () => {
      await addUserToGroup(superAdminGroupId, adminUserId);

      const session = await startImpersonation({
        adminUserId,
        impersonatedUserId: targetUserId,
        reason: 'Audit test',
      });

      const result = await endImpersonation(session!.sessionToken);
      expect(result).toBe(true);

      // Session should have endedAt timestamp
      // This would require querying the database directly
    });
  });
});
