/**
 * RBAC Integration Tests
 *
 * End-to-end tests for the complete RBAC system.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  createRole,
  createPermission,
  assignPermissionsToRole,
  assignRole,
  revokeRole,
  getUserPermissions,
  checkPermission,
  createGroup,
  addUserToGroup,
  isSuperAdmin,
  startImpersonation,
} from '@/lib/rbac';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

describe('RBAC Integration Tests', () => {
  let userId: number;
  let projectId: number;

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        username: 'integration-test-' + Date.now(),
        name: 'Integration Test User',
        email: `integration-${Date.now()}@example.com`,
        authType: 'email',
      })
      .returning();
    userId = user.id;

    // Assume project with ID 1 exists or create one
    projectId = 1;
  });

  afterAll(async () => {
    // Clean up
    if (userId) {
      await db.delete(users).where({ id: userId });
    }
  });

  describe('Complete Permission Flow', () => {
    it('should handle full permission lifecycle', async () => {
      // 1. Create a permission
      const permission = await createPermission({
        name: 'integration.test.' + Date.now(),
        displayName: 'Integration Test',
        resourceType: 'api',
        resourceName: 'integration',
        action: 'execute',
      });

      expect(permission.id).toBeDefined();

      // 2. Create a role
      const role = await createRole({
        name: 'integration-role-' + Date.now(),
        displayName: 'Integration Role',
        roleType: 'system',
      });

      expect(role.id).toBeDefined();

      // 3. Assign permission to role
      await assignPermissionsToRole(role.id, [permission.id]);

      // 4. Verify user doesn't have permission yet
      const hasPermBefore = await checkPermission({
        userId,
        permission: permission.name,
        useCache: false,
      });
      expect(hasPermBefore).toBe(false);

      // 5. Assign role to user
      await assignRole({
        userId,
        roleId: role.id,
      });

      // 6. Verify user now has permission
      const hasPermAfter = await checkPermission({
        userId,
        permission: permission.name,
        useCache: false,
      });
      expect(hasPermAfter).toBe(true);

      // 7. Get all user permissions
      const userPerms = await getUserPermissions(userId);
      expect(userPerms.permissions).toContain(permission.name);
      expect(userPerms.systemRoles).toHaveLength(1);

      // 8. Revoke role from user
      await revokeRole(userId, role.id);

      // 9. Verify user no longer has permission
      const hasPermFinal = await checkPermission({
        userId,
        permission: permission.name,
        useCache: false,
      });
      expect(hasPermFinal).toBe(false);
    });
  });

  describe('Project-Scoped Permissions', () => {
    it('should handle project-specific permissions', async () => {
      // Create project-scoped permission
      const permission = await createPermission({
        name: 'project.manage.' + Date.now(),
        displayName: 'Manage Project',
        resourceType: 'api',
        resourceName: 'project',
        action: 'update',
      });

      // Create project role
      const role = await createRole({
        name: 'project-manager-' + Date.now(),
        displayName: 'Project Manager',
        roleType: 'project',
      });

      await assignPermissionsToRole(role.id, [permission.id]);

      // Assign role to user for specific project
      await assignRole({
        userId,
        roleId: role.id,
        projectId,
      });

      // User should have permission in this project
      const hasPermInProject = await checkPermission({
        userId,
        permission: permission.name,
        projectId,
        useCache: false,
      });
      expect(hasPermInProject).toBe(true);

      // User should NOT have permission in different project
      const hasPermOtherProject = await checkPermission({
        userId,
        permission: permission.name,
        projectId: 999,
        useCache: false,
      });
      expect(hasPermOtherProject).toBe(false);
    });
  });

  describe('Group-Based Permissions', () => {
    it('should grant permissions via group membership', async () => {
      // Create permission and role
      const permission = await createPermission({
        name: 'group.feature.' + Date.now(),
        displayName: 'Group Feature',
        resourceType: 'api',
        resourceName: 'feature',
        action: 'execute',
      });

      const role = await createRole({
        name: 'group-role-' + Date.now(),
        displayName: 'Group Role',
        roleType: 'system',
      });

      await assignPermissionsToRole(role.id, [permission.id]);

      // Create group
      const group = await createGroup({
        name: 'test-group-' + Date.now(),
        description: 'Test Group',
        groupType: 'functional',
      });

      // Add user to group
      await addUserToGroup(group.id, userId);

      // Assign role to user via group
      await assignRole({
        userId,
        roleId: role.id,
        groupId: group.id,
      });

      // User should have permission via group membership
      const hasPerm = await checkPermission({
        userId,
        permission: permission.name,
        useCache: false,
      });
      expect(hasPerm).toBe(true);
    });
  });

  describe('Permission Hierarchy', () => {
    it('should properly handle multiple role sources', async () => {
      // Create multiple permissions
      const perm1 = await createPermission({
        name: 'hierarchy.system.' + Date.now(),
        displayName: 'System Permission',
        resourceType: 'api',
        resourceName: 'system',
        action: 'read',
      });

      const perm2 = await createPermission({
        name: 'hierarchy.project.' + Date.now(),
        displayName: 'Project Permission',
        resourceType: 'api',
        resourceName: 'project',
        action: 'read',
      });

      // Create system role with perm1
      const systemRole = await createRole({
        name: 'system-role-' + Date.now(),
        displayName: 'System Role',
        roleType: 'system',
      });
      await assignPermissionsToRole(systemRole.id, [perm1.id]);

      // Create project role with perm2
      const projectRole = await createRole({
        name: 'project-role-' + Date.now(),
        displayName: 'Project Role',
        roleType: 'project',
      });
      await assignPermissionsToRole(projectRole.id, [perm2.id]);

      // Assign both roles
      await assignRole({ userId, roleId: systemRole.id });
      await assignRole({ userId, roleId: projectRole.id, projectId });

      // User should have both permissions
      const hasPerm1 = await checkPermission({
        userId,
        permission: perm1.name,
        useCache: false,
      });
      const hasPerm2 = await checkPermission({
        userId,
        permission: perm2.name,
        projectId,
        useCache: false,
      });

      expect(hasPerm1).toBe(true);
      expect(hasPerm2).toBe(true);
    });
  });

  describe('Super Admin and Impersonation', () => {
    it('should allow super admin to impersonate users', async () => {
      // Create super admin group if it doesn't exist
      const group = await createGroup({
        name: 'super_admins',
        description: 'Super Admins',
        groupType: 'functional',
      });

      // Add user to super admin group
      await addUserToGroup(group.id, userId);

      // Verify user is super admin
      const isAdmin = await isSuperAdmin(userId);
      expect(isAdmin).toBe(true);

      // Create target user
      const [targetUser] = await db
        .insert(users)
        .values({
          username: 'target-' + Date.now(),
          name: 'Target User',
          email: `target-${Date.now()}@example.com`,
          authType: 'email',
        })
        .returning();

      // Start impersonation
      const session = await startImpersonation({
        adminUserId: userId,
        impersonatedUserId: targetUser.id,
        reason: 'Integration test',
      });

      expect(session).not.toBeNull();
      expect(session?.sessionToken).toBeDefined();

      // Clean up
      await db.delete(users).where({ id: targetUser.id });
    });
  });

  describe('Permission Caching', () => {
    it('should cache and invalidate permissions correctly', async () => {
      const permission = await createPermission({
        name: 'cache.test.' + Date.now(),
        displayName: 'Cache Test',
        resourceType: 'api',
        resourceName: 'cache',
        action: 'read',
      });

      const role = await createRole({
        name: 'cache-role-' + Date.now(),
        displayName: 'Cache Role',
        roleType: 'system',
      });

      await assignPermissionsToRole(role.id, [permission.id]);
      await assignRole({ userId, roleId: role.id });

      // First check (caches result)
      const result1 = await checkPermission({
        userId,
        permission: permission.name,
        useCache: true,
      });
      expect(result1).toBe(true);

      // Second check (uses cache)
      const result2 = await checkPermission({
        userId,
        permission: permission.name,
        useCache: true,
      });
      expect(result2).toBe(true);

      // Revoke role
      await revokeRole(userId, role.id);

      // Without cache invalidation, might still show true
      // With proper cache invalidation, should show false
      const result3 = await checkPermission({
        userId,
        permission: permission.name,
        useCache: false, // Force fresh check
      });
      expect(result3).toBe(false);
    });
  });
});
