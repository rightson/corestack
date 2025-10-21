import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/trpc';
import { projects, projectMembers } from '@/lib/db/schema';
import { eq, desc, and, or } from 'drizzle-orm';
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

  // Get all public projects
  getAllProjects: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      // Get public projects and projects where user is a member
      const memberProjects = await ctx.db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(eq(projectMembers.userId, payload.userId));

      const memberProjectIds = memberProjects.map((p) => p.projectId);

      return await ctx.db
        .select()
        .from(projects)
        .where(
          or(
            eq(projects.visibility, 'public'),
            and(
              ...memberProjectIds.map((id) => eq(projects.id, id))
            )
          )
        )
        .orderBy(desc(projects.updatedAt));
    }),

  // Create a new project
  create: publicProcedure
    .input(
      z.object({
        token: z.string(),
        name: z.string().min(1),
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
        name: z.string().min(1).optional(),
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
});
