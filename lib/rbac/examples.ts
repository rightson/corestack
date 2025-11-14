/**
 * RBAC Usage Examples
 *
 * This file demonstrates how to use RBAC permissions in various scenarios.
 */

import { z } from 'zod';
import { router, protectedProcedure, permissionProcedure } from '@/lib/trpc/trpc';
import { checkResourcePermission, requireAnyPermission, requireAllPermissions } from './middleware';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Example 1: Basic Permission Protection
 *
 * Use permissionProcedure() to automatically check permissions
 */
export const exampleUserRouterBasic = router({
  // List users - requires 'user.read' permission
  list: permissionProcedure('user.read').query(async ({ ctx }) => {
    return await ctx.db.select().from(users);
  }),

  // Create user - requires 'user.create' permission
  create: permissionProcedure('user.create')
    .input(
      z.object({
        username: z.string().min(1),
        name: z.string().min(1),
        email: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.insert(users).values(input).returning();
      return result[0];
    }),

  // Delete user - requires 'user.delete' permission
  delete: permissionProcedure('user.delete')
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(users).where(eq(users.id, input.id));
      return { success: true };
    }),
});

/**
 * Example 2: Multiple Permission Requirements
 *
 * Require one of several permissions (OR logic)
 */
export const exampleUserRouterMultiple = router({
  // Update user - requires either 'user.update' OR 'user.admin' permission
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has any of the required permissions
      await requireAnyPermission(
        ctx.user.userId,
        ['user.update', 'user.admin']
      );

      const { id, ...data } = input;
      const result = await ctx.db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      return result[0];
    }),

  // Admin action - requires BOTH 'user.read' AND 'user.admin' permissions
  adminAction: protectedProcedure.mutation(async ({ ctx }) => {
    await requireAllPermissions(
      ctx.user.userId,
      ['user.read', 'user.admin']
    );

    // Admin-only logic here
    return { success: true };
  }),
});

/**
 * Example 3: Resource-Specific Permissions
 *
 * Check permissions based on resource ownership
 */
export const examplePostRouter = router({
  // Update post - user can update their own posts, or with admin permission
  updatePost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        content: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the post to check ownership
      const post = await ctx.db.query.posts.findFirst({
        where: (posts, { eq }) => eq(posts.id, input.postId),
      });

      if (!post) {
        throw new Error('Post not found');
      }

      // Check if user can update this specific post
      const canUpdate = await checkResourcePermission(
        ctx.user.userId,
        'post.update',
        post.authorId // Resource owner ID
      );

      if (!canUpdate) {
        throw new Error('Cannot update this post');
      }

      // Update post...
      return { success: true };
    }),
});

/**
 * Example 4: Project-Scoped Permissions
 *
 * Permissions that are scoped to a specific project
 */
export const exampleProjectRouter = router({
  // List project members - requires 'project.read' permission in the specific project
  listMembers: permissionProcedure('project.read')
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      // The permissionProcedure automatically extracts projectId from input
      // and checks permission in that project scope

      // Get project members...
      return [];
    }),

  // Manual project-scoped check
  updateProject: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        name: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Manually check permission in project scope
      const { checkPermission } = await import('./permission-checker');

      const canUpdate = await checkPermission({
        userId: ctx.user.userId,
        permission: 'project.update',
        projectId: input.projectId,
      });

      if (!canUpdate) {
        throw new Error('Cannot update this project');
      }

      // Update project...
      return { success: true };
    }),
});

/**
 * Example 5: Conditional Permissions
 *
 * Different permission requirements based on context
 */
export const exampleConditionalRouter = router({
  performAction: protectedProcedure
    .input(
      z.object({
        action: z.enum(['view', 'edit', 'delete']),
        resourceId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Different permissions for different actions
      const permissionMap = {
        view: 'resource.read',
        edit: 'resource.update',
        delete: 'resource.delete',
      };

      const { checkPermission } = await import('./permission-checker');

      const requiredPermission = permissionMap[input.action];
      const hasPermission = await checkPermission({
        userId: ctx.user.userId,
        permission: requiredPermission,
      });

      if (!hasPermission) {
        throw new Error(`Permission denied: ${requiredPermission}`);
      }

      // Perform action...
      return { success: true };
    }),
});

/**
 * Example 6: Combining Authentication and Authorization
 */
export const exampleCombinedRouter = router({
  // Public endpoint - no auth required
  publicInfo: router({
    getStats: protectedProcedure.query(async () => {
      return { totalUsers: 100, totalProjects: 50 };
    }),
  }),

  // Protected endpoint - auth required, no specific permission
  profile: router({
    getMyProfile: protectedProcedure.query(async ({ ctx }) => {
      // Any authenticated user can access their own profile
      return await ctx.db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, ctx.user.userId),
      });
    }),
  }),

  // Admin endpoint - auth + permission required
  admin: router({
    getAllProfiles: permissionProcedure('user.read').query(async ({ ctx }) => {
      // Only users with 'user.read' permission can access
      return await ctx.db.select().from(users);
    }),
  }),
});

/**
 * Example 7: Dynamic Permission Checking
 *
 * Check permissions at runtime based on dynamic data
 */
export const exampleDynamicRouter = router({
  accessResource: protectedProcedure
    .input(
      z.object({
        resourceType: z.enum(['user', 'project', 'post']),
        resourceId: z.number(),
        action: z.enum(['read', 'update', 'delete']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Build permission string dynamically
      const permission = `${input.resourceType}.${input.action}`;

      const { checkPermission } = await import('./permission-checker');

      const hasPermission = await checkPermission({
        userId: ctx.user.userId,
        permission,
      });

      if (!hasPermission) {
        throw new Error(`Permission denied: ${permission}`);
      }

      // Access resource...
      return { success: true };
    }),
});

/**
 * Example 8: Impersonation-Aware Permissions
 *
 * Handle permissions differently when impersonating
 */
export const exampleImpersonationRouter = router({
  sensitiveAction: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if user is being impersonated
    if (ctx.impersonation.isImpersonating) {
      // Log that admin is performing action on behalf of user
      console.log(`Admin ${ctx.impersonation.adminUserId} performing action for user ${ctx.user.userId}`);

      // Optionally, restrict certain actions during impersonation
      throw new Error('This action cannot be performed during impersonation');
    }

    // Proceed with action...
    return { success: true };
  }),

  // Allow action during impersonation
  viewData: protectedProcedure.query(async ({ ctx }) => {
    // This is safe during impersonation
    const userId = ctx.user.userId; // This will be the impersonated user's ID

    // Get user data...
    return { userId, impersonating: ctx.impersonation.isImpersonating };
  }),
});
