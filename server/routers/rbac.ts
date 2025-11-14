/**
 * RBAC Management Router
 *
 * Provides API endpoints for managing roles, permissions, user roles, and groups.
 */

import { router, protectedProcedure, permissionProcedure } from '@/lib/trpc/trpc';
import { z } from 'zod';
import {
  // Role Service
  createRole,
  listRoles,
  getRoleById,
  updateRole,
  setRoleActive,
  deleteRole,
  assignPermissionsToRole,
  removePermissionsFromRole,
  getRolePermissions as getRolePermissionsList,
  // Permission Service
  createPermission,
  listPermissions,
  getPermissionById,
  updatePermission,
  setPermissionActive,
  deletePermission,
  // User Role Service
  assignRole,
  revokeRole,
  getUserPermissions,
  getUsersByRole,
  // Group Service
  createGroup,
  listGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addUserToGroup,
  removeUserFromGroup,
  getGroupMembers,
  addProjectToGroup,
  removeProjectFromGroup,
  getGroupProjects,
  getUserGroups,
  // Impersonation Service
  isSuperAdmin,
  startImpersonation,
  endImpersonation,
  getAdminActiveSessions,
  getImpersonationHistory,
  canImpersonate,
} from '@/lib/rbac';

// ===== Input Schemas =====

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  description: z.string().optional(),
  roleType: z.enum(['system', 'project', 'cross-project']),
  isBuiltIn: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateRoleSchema = z.object({
  roleId: z.number(),
  displayName: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const createPermissionSchema = z.object({
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  description: z.string().optional(),
  resourceType: z.enum(['api', 'ui', 'data']),
  resourceName: z.string().min(1).max(255),
  action: z.enum(['create', 'read', 'update', 'delete', 'execute']),
  metadata: z.record(z.any()).optional(),
});

const updatePermissionSchema = z.object({
  permissionId: z.number(),
  displayName: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const assignRoleSchema = z.object({
  userId: z.number(),
  roleId: z.number(),
  projectId: z.number().optional(),
  groupId: z.number().optional(),
  expiresAt: z.date().optional(),
});

const revokeRoleSchema = z.object({
  userId: z.number(),
  roleId: z.number(),
  projectId: z.number().optional(),
  groupId: z.number().optional(),
});

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  groupType: z.enum(['project', 'cross-project', 'functional']),
  metadata: z.record(z.any()).optional(),
});

const updateGroupSchema = z.object({
  groupId: z.number(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// ===== Router Definition =====

export const rbacRouter = router({
  // ===== Roles =====
  roles: router({
    list: permissionProcedure('rbac.role.read')
      .input(z.object({
        roleType: z.string().optional(),
        isActive: z.boolean().optional(),
        includeBuiltIn: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        return await listRoles(input);
      }),

    getById: permissionProcedure('rbac.role.read')
      .input(z.object({ roleId: z.number() }))
      .query(async ({ input }) => {
        return await getRoleById(input.roleId);
      }),

    create: permissionProcedure('rbac.role.create')
      .input(createRoleSchema)
      .mutation(async ({ ctx, input }) => {
        return await createRole(input, ctx.user.userId);
      }),

    update: permissionProcedure('rbac.role.update')
      .input(updateRoleSchema)
      .mutation(async ({ ctx, input }) => {
        const { roleId, ...updates } = input;
        return await updateRole(roleId, updates, ctx.user.userId);
      }),

    setActive: permissionProcedure('rbac.role.update')
      .input(z.object({ roleId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return await setRoleActive(input.roleId, input.isActive, ctx.user.userId);
      }),

    delete: permissionProcedure('rbac.role.delete')
      .input(z.object({ roleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await deleteRole(input.roleId, ctx.user.userId);
      }),

    assignPermissions: permissionProcedure('rbac.role.update')
      .input(z.object({
        roleId: z.number(),
        permissionIds: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        await assignPermissionsToRole(input.roleId, input.permissionIds, ctx.user.userId);
        return { success: true };
      }),

    removePermissions: permissionProcedure('rbac.role.update')
      .input(z.object({
        roleId: z.number(),
        permissionIds: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        await removePermissionsFromRole(input.roleId, input.permissionIds, ctx.user.userId);
        return { success: true };
      }),

    getPermissions: permissionProcedure('rbac.role.read')
      .input(z.object({ roleId: z.number() }))
      .query(async ({ input }) => {
        return await getRolePermissionsList(input.roleId);
      }),
  }),

  // ===== Permissions =====
  permissions: router({
    list: permissionProcedure('rbac.permission.read')
      .input(z.object({
        resourceType: z.string().optional(),
        resourceName: z.string().optional(),
        action: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        return await listPermissions(input);
      }),

    getById: permissionProcedure('rbac.permission.read')
      .input(z.object({ permissionId: z.number() }))
      .query(async ({ input }) => {
        return await getPermissionById(input.permissionId);
      }),

    create: permissionProcedure('rbac.permission.create')
      .input(createPermissionSchema)
      .mutation(async ({ ctx, input }) => {
        return await createPermission(input, ctx.user.userId);
      }),

    update: permissionProcedure('rbac.permission.update')
      .input(updatePermissionSchema)
      .mutation(async ({ ctx, input }) => {
        const { permissionId, ...updates } = input;
        return await updatePermission(permissionId, updates, ctx.user.userId);
      }),

    setActive: permissionProcedure('rbac.permission.update')
      .input(z.object({ permissionId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return await setPermissionActive(input.permissionId, input.isActive, ctx.user.userId);
      }),

    delete: permissionProcedure('rbac.permission.delete')
      .input(z.object({ permissionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await deletePermission(input.permissionId, ctx.user.userId);
      }),
  }),

  // ===== User Roles =====
  userRoles: router({
    assign: permissionProcedure('rbac.user-role.assign')
      .input(assignRoleSchema)
      .mutation(async ({ ctx, input }) => {
        await assignRole({
          ...input,
          grantedBy: ctx.user.userId,
        });
        return { success: true };
      }),

    revoke: permissionProcedure('rbac.user-role.revoke')
      .input(revokeRoleSchema)
      .mutation(async ({ ctx, input }) => {
        await revokeRole(input.userId, input.roleId, {
          projectId: input.projectId,
          groupId: input.groupId,
          revokedBy: ctx.user.userId,
        });
        return { success: true };
      }),

    getUserPermissions: permissionProcedure('rbac.user-role.read')
      .input(z.object({
        userId: z.number(),
        projectId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await getUserPermissions(input.userId, input.projectId);
      }),

    getUsersByRole: permissionProcedure('rbac.user-role.read')
      .input(z.object({
        roleId: z.number(),
        projectId: z.number().optional(),
        groupId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await getUsersByRole(input.roleId, {
          projectId: input.projectId,
          groupId: input.groupId,
        });
      }),

    // Get current user's permissions (no special permission required)
    getMyPermissions: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await getUserPermissions(ctx.user.userId, input.projectId);
      }),
  }),

  // ===== Groups =====
  groups: router({
    list: permissionProcedure('rbac.group.read')
      .input(z.object({
        groupType: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await listGroups(input);
      }),

    getById: permissionProcedure('rbac.group.read')
      .input(z.object({ groupId: z.number() }))
      .query(async ({ input }) => {
        return await getGroupById(input.groupId);
      }),

    create: permissionProcedure('rbac.group.create')
      .input(createGroupSchema)
      .mutation(async ({ ctx, input }) => {
        return await createGroup(input, ctx.user.userId);
      }),

    update: permissionProcedure('rbac.group.update')
      .input(updateGroupSchema)
      .mutation(async ({ ctx, input }) => {
        const { groupId, ...updates } = input;
        return await updateGroup(groupId, updates, ctx.user.userId);
      }),

    delete: permissionProcedure('rbac.group.delete')
      .input(z.object({ groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await deleteGroup(input.groupId, ctx.user.userId);
      }),

    addMember: permissionProcedure('rbac.group.update')
      .input(z.object({
        groupId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await addUserToGroup(input.groupId, input.userId, ctx.user.userId);
        return { success: true };
      }),

    removeMember: permissionProcedure('rbac.group.update')
      .input(z.object({
        groupId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await removeUserFromGroup(input.groupId, input.userId, ctx.user.userId);
        return { success: true };
      }),

    getMembers: permissionProcedure('rbac.group.read')
      .input(z.object({ groupId: z.number() }))
      .query(async ({ input }) => {
        return await getGroupMembers(input.groupId);
      }),

    addProject: permissionProcedure('rbac.group.update')
      .input(z.object({
        groupId: z.number(),
        projectId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await addProjectToGroup(input.groupId, input.projectId, ctx.user.userId);
        return { success: true };
      }),

    removeProject: permissionProcedure('rbac.group.update')
      .input(z.object({
        groupId: z.number(),
        projectId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await removeProjectFromGroup(input.groupId, input.projectId, ctx.user.userId);
        return { success: true };
      }),

    getProjects: permissionProcedure('rbac.group.read')
      .input(z.object({ groupId: z.number() }))
      .query(async ({ input }) => {
        return await getGroupProjects(input.groupId);
      }),

    getUserGroups: permissionProcedure('rbac.group.read')
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await getUserGroups(input.userId);
      }),

    // Get current user's groups (no special permission required)
    getMyGroups: protectedProcedure
      .query(async ({ ctx }) => {
        return await getUserGroups(ctx.user.userId);
      }),
  }),

  // ===== Impersonation =====
  impersonation: router({
    // Check if current user is a super admin
    isSuperAdmin: protectedProcedure
      .query(async ({ ctx }) => {
        return await isSuperAdmin(ctx.user.userId);
      }),

    // Check if current user can impersonate a target user
    canImpersonate: protectedProcedure
      .input(z.object({ targetUserId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await canImpersonate(ctx.user.userId, input.targetUserId);
      }),

    // Start impersonation session (super admin only)
    start: protectedProcedure
      .input(z.object({
        targetUserId: z.number(),
        reason: z.string().optional(),
        durationMs: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if user is super admin
        const isAdmin = await isSuperAdmin(ctx.user.userId);
        if (!isAdmin) {
          throw new Error('Only super admins can start impersonation sessions');
        }

        // Extract request metadata
        const ipAddress = undefined; // Would need to be extracted from request
        const userAgent = undefined; // Would need to be extracted from request

        const session = await startImpersonation({
          adminUserId: ctx.user.userId,
          impersonatedUserId: input.targetUserId,
          reason: input.reason,
          ipAddress,
          userAgent,
          durationMs: input.durationMs,
        });

        if (!session) {
          throw new Error('Failed to start impersonation session');
        }

        return {
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt,
          impersonatedUserId: session.impersonatedUserId,
        };
      }),

    // End impersonation session
    end: protectedProcedure
      .input(z.object({ sessionToken: z.string() }))
      .mutation(async ({ input }) => {
        const success = await endImpersonation(input.sessionToken);
        return { success };
      }),

    // Get active sessions for current admin
    getActiveSessions: protectedProcedure
      .query(async ({ ctx }) => {
        return await getAdminActiveSessions(ctx.user.userId);
      }),

    // Get impersonation history
    getHistory: protectedProcedure
      .input(z.object({
        adminUserId: z.number().optional(),
        impersonatedUserId: z.number().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await getImpersonationHistory(input);
      }),

    // Get current impersonation status
    getStatus: protectedProcedure
      .query(async ({ ctx }) => {
        return ctx.impersonation;
      }),
  }),
});
