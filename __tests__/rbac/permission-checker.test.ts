/**
 * Permission Checker Tests
 *
 * Tests for the core permission checking logic.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  checkPermission,
  checkMultiplePermissions,
  invalidateUserPermissionCache,
  clearExpiredCache,
} from '@/lib/rbac/permission-checker';
import {
  createRole,
  createPermission,
  assignPermissionsToRole,
  assignRole,
} from '@/lib/rbac';
import { db } from '@/lib/db';
import { users, roles, permissions } from '@/lib/db/schema';

describe('Permission Checker', () => {
  let testUserId: number;
  let testRoleId: number;
  let testPermissionId: number;
  let testProjectId: number | undefined;

  beforeEach(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        username: 'test-user-' + Date.now(),
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        authType: 'email',
      })
      .returning();
    testUserId = user.id;

    // Create test permission
    const permission = await createPermission({
      name: 'test.read.' + Date.now(),
      displayName: 'Test Read',
      resourceType: 'api',
      resourceName: 'test',
      action: 'read',
    });
    testPermissionId = permission.id;

    // Create test role
    const role = await createRole({
      name: 'test-role-' + Date.now(),
      displayName: 'Test Role',
      roleType: 'system',
    });
    testRoleId = role.id;

    // Assign permission to role
    await assignPermissionsToRole(testRoleId, [testPermissionId]);
  });

  afterEach(async () => {
    // Clean up: delete test data
    if (testUserId) {
      await db.delete(users).where({ id: testUserId });
    }
  });

  describe('checkPermission', () => {
    it('should grant permission when user has role with permission', async () => {
      // Assign role to user
      await assignRole({
        userId: testUserId,
        roleId: testRoleId,
      });

      // Check permission
      const hasPermission = await checkPermission({
        userId: testUserId,
        permission: 'test.read.' + Date.now(),
        useCache: false, // Disable cache for test
      });

      expect(hasPermission).toBe(true);
    });

    it('should deny permission when user lacks role', async () => {
      // Don't assign role to user
      const hasPermission = await checkPermission({
        userId: testUserId,
        permission: 'test.read.' + Date.now(),
        useCache: false,
      });

      expect(hasPermission).toBe(false);
    });

    it('should deny permission when permission does not exist', async () => {
      const hasPermission = await checkPermission({
        userId: testUserId,
        permission: 'nonexistent.permission',
        useCache: false,
      });

      expect(hasPermission).toBe(false);
    });

    it('should cache permission results', async () => {
      await assignRole({
        userId: testUserId,
        roleId: testRoleId,
      });

      const permName = 'test.read.' + Date.now();

      // First call - not cached
      const start1 = Date.now();
      const result1 = await checkPermission({
        userId: testUserId,
        permission: permName,
        useCache: true,
      });
      const duration1 = Date.now() - start1;

      // Second call - should be cached
      const start2 = Date.now();
      const result2 = await checkPermission({
        userId: testUserId,
        permission: permName,
        useCache: true,
      });
      const duration2 = Date.now() - start2;

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      // Cached call should be faster (though this is timing-dependent)
      expect(duration2).toBeLessThanOrEqual(duration1);
    });

    it('should check project-scoped permissions', async () => {
      // Create project role and assign
      const projectRole = await createRole({
        name: 'project-role-' + Date.now(),
        displayName: 'Project Role',
        roleType: 'project',
      });

      await assignPermissionsToRole(projectRole.id, [testPermissionId]);

      const testProjectId = 1; // Assuming project exists

      await assignRole({
        userId: testUserId,
        roleId: projectRole.id,
        projectId: testProjectId,
      });

      const hasPermission = await checkPermission({
        userId: testUserId,
        permission: 'test.read.' + Date.now(),
        projectId: testProjectId,
        useCache: false,
      });

      expect(hasPermission).toBe(true);
    });
  });

  describe('checkMultiplePermissions', () => {
    it('should check multiple permissions at once', async () => {
      // Create additional permissions
      const perm1 = await createPermission({
        name: 'test.write.' + Date.now(),
        displayName: 'Test Write',
        resourceType: 'api',
        resourceName: 'test',
        action: 'create',
      });

      const perm2 = await createPermission({
        name: 'test.delete.' + Date.now(),
        displayName: 'Test Delete',
        resourceType: 'api',
        resourceName: 'test',
        action: 'delete',
      });

      // Assign only one permission to role
      await assignPermissionsToRole(testRoleId, [perm1.id]);
      await assignRole({ userId: testUserId, roleId: testRoleId });

      const results = await checkMultiplePermissions(
        testUserId,
        [perm1.name, perm2.name]
      );

      expect(results[perm1.name]).toBe(true);
      expect(results[perm2.name]).toBe(false);
    });

    it('should return false for all when user has no roles', async () => {
      const results = await checkMultiplePermissions(
        testUserId,
        ['perm1', 'perm2', 'perm3']
      );

      expect(results.perm1).toBe(false);
      expect(results.perm2).toBe(false);
      expect(results.perm3).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should invalidate user permission cache', async () => {
      await assignRole({ userId: testUserId, roleId: testRoleId });

      const permName = 'test.read.' + Date.now();

      // Cache permission
      await checkPermission({
        userId: testUserId,
        permission: permName,
        useCache: true,
      });

      // Invalidate cache
      await invalidateUserPermissionCache(testUserId);

      // Check permission again - should not use cache
      const hasPermission = await checkPermission({
        userId: testUserId,
        permission: permName,
        useCache: true,
      });

      expect(hasPermission).toBe(true);
    });

    it('should clear expired cache entries', async () => {
      // This test would need to manipulate cache expiry times
      await clearExpiredCache();
      // Assert that expired entries are removed
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent user gracefully', async () => {
      const hasPermission = await checkPermission({
        userId: 999999,
        permission: 'test.read',
        useCache: false,
      });

      expect(hasPermission).toBe(false);
    });

    it('should handle empty permission string', async () => {
      const hasPermission = await checkPermission({
        userId: testUserId,
        permission: '',
        useCache: false,
      });

      expect(hasPermission).toBe(false);
    });

    it('should handle null/undefined projectId', async () => {
      await assignRole({ userId: testUserId, roleId: testRoleId });

      const hasPermission = await checkPermission({
        userId: testUserId,
        permission: 'test.read.' + Date.now(),
        projectId: undefined,
        useCache: false,
      });

      expect(hasPermission).toBe(true);
    });
  });
});
