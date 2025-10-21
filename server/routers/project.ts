import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/trpc';
import { projects, projectMembers, permissionRequests, users } from '@/lib/db/schema';
import { eq, desc, and, or, like, ilike, sql } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth/jwt';

export const projectRouter = router({
  // Get recent projects for a user
  getRecent: publicProcedure
    .input(z.object({ token: z.string(), limit: z.number().default(5) }))
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      return await ctx.db
        .select()
        .from(projects)
        .where(eq(projects.ownerId, payload.userId))
        .orderBy(desc(projects.lastAccessedAt))
        .limit(input.limit);
    }),

  // Get all user's own projects
  getMyProjects: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      return await ctx.db
        .select()
        .from(projects)
        .where(eq(projects.ownerId, payload.userId))
        .orderBy(desc(projects.updatedAt));
    }),

  // Get all public projects with permission info
  getAllProjects: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      // Get all public projects
      const allProjects = await ctx.db
        .select()
        .from(projects)
        .where(eq(projects.visibility, 'public'))
        .orderBy(desc(projects.lastAccessedAt));

      // Get user's project memberships
      const memberships = await ctx.db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(eq(projectMembers.userId, payload.userId));

      const memberProjectIds = new Set(memberships.map((m) => m.projectId));

      // Get user's pending permission requests
      const pendingRequests = await ctx.db
        .select({ projectId: permissionRequests.projectId })
        .from(permissionRequests)
        .where(
          and(
            eq(permissionRequests.userId, payload.userId),
            eq(permissionRequests.status, 'pending')
          )
        );

      const requestedProjectIds = new Set(pendingRequests.map((r) => r.projectId));

      // Add permission info to each project
      return allProjects.map((project) => ({
        ...project,
        hasPermission: project.ownerId === payload.userId || memberProjectIds.has(project.id),
        permissionRequested: requestedProjectIds.has(project.id),
      }));
    }),

  // Search projects
  searchProjects: publicProcedure
    .input(
      z.object({
        token: z.string(),
        query: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      const searchTerm = `%${input.query}%`;

      // Search in public projects by version, code, or name
      const searchResults = await ctx.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.visibility, 'public'),
            or(
              ilike(projects.projectVersion, searchTerm),
              ilike(projects.projectCode, searchTerm),
              ilike(projects.name, searchTerm)
            )
          )
        )
        .orderBy(desc(projects.lastAccessedAt));

      // Get user's project memberships
      const memberships = await ctx.db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(eq(projectMembers.userId, payload.userId));

      const memberProjectIds = new Set(memberships.map((m) => m.projectId));

      // Get user's pending permission requests
      const pendingRequests = await ctx.db
        .select({ projectId: permissionRequests.projectId })
        .from(permissionRequests)
        .where(
          and(
            eq(permissionRequests.userId, payload.userId),
            eq(permissionRequests.status, 'pending')
          )
        );

      const requestedProjectIds = new Set(pendingRequests.map((r) => r.projectId));

      // Add permission info to each project
      return searchResults.map((project) => ({
        ...project,
        hasPermission: project.ownerId === payload.userId || memberProjectIds.has(project.id),
        permissionRequested: requestedProjectIds.has(project.id),
      }));
    }),

  // Create a new project
  create: publicProcedure
    .input(
      z.object({
        token: z.string(),
        projectVersion: z.string().min(1),
        projectCode: z.string().min(1),
        name: z.string().optional(),
        description: z.string().optional(),
        visibility: z.enum(['private', 'public']).default('private'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      const result = await ctx.db
        .insert(projects)
        .values({
          projectVersion: input.projectVersion,
          projectCode: input.projectCode,
          name: input.name,
          description: input.description,
          ownerId: payload.userId,
          visibility: input.visibility,
          lastAccessedAt: new Date(),
        })
        .returning();

      return result[0];
    }),

  // Update a project
  update: publicProcedure
    .input(
      z.object({
        token: z.string(),
        id: z.number(),
        projectVersion: z.string().optional(),
        projectCode: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['active', 'archived', 'completed']).optional(),
        visibility: z.enum(['private', 'public']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      const { token, id, ...data } = input;

      const result = await ctx.db
        .update(projects)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(projects.id, id),
            eq(projects.ownerId, payload.userId)
          )
        )
        .returning();

      return result[0];
    }),

  // Update last accessed time
  updateLastAccessed: publicProcedure
    .input(z.object({ token: z.string(), id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      await ctx.db
        .update(projects)
        .set({ lastAccessedAt: new Date() })
        .where(eq(projects.id, input.id));

      return { success: true };
    }),

  // Delete a project
  delete: publicProcedure
    .input(z.object({ token: z.string(), id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      await ctx.db
        .delete(projects)
        .where(
          and(
            eq(projects.id, input.id),
            eq(projects.ownerId, payload.userId)
          )
        );

      return { success: true };
    }),

  // Request permission for a project
  requestPermission: publicProcedure
    .input(z.object({ token: z.string(), projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      // Check if already has permission
      const existing = await ctx.db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, input.projectId),
            eq(projectMembers.userId, payload.userId)
          )
        );

      if (existing.length > 0) {
        throw new Error('Already has permission');
      }

      // Check if already requested
      const existingRequest = await ctx.db
        .select()
        .from(permissionRequests)
        .where(
          and(
            eq(permissionRequests.projectId, input.projectId),
            eq(permissionRequests.userId, payload.userId),
            eq(permissionRequests.status, 'pending')
          )
        );

      if (existingRequest.length > 0) {
        throw new Error('Permission already requested');
      }

      // Create permission request
      await ctx.db.insert(permissionRequests).values({
        projectId: input.projectId,
        userId: payload.userId,
      });

      return { success: true };
    }),
});
