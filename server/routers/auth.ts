import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/trpc';
import { authenticateUser, changePassword } from '@/lib/auth/service';
import { verifyToken } from '@/lib/auth/jwt';

export const authRouter = router({
  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        authType: z.enum(['email', 'ldap']).default('email'),
      })
    )
    .mutation(async ({ input }) => {
      return await authenticateUser(input.username, input.password, input.authType);
    }),

  changePassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        return { success: false, error: 'Invalid token' };
      }

      return await changePassword(payload.userId, input.newPassword);
    }),

  verifyToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        return { valid: false };
      }
      return { valid: true, user: payload };
    }),
});
