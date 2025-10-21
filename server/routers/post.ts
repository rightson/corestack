import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/trpc';
import { posts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const postRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.select().from(posts);
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.db
        .select()
        .from(posts)
        .where(eq(posts.id, input.id))
        .limit(1);
      return post[0] || null;
    }),

  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string().optional(),
        authorId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.insert(posts).values(input).returning();
      return result[0];
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await ctx.db
        .update(posts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(posts.id, id))
        .returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(posts).where(eq(posts.id, input.id));
      return { success: true };
    }),
});
