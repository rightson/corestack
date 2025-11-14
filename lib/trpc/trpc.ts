import { initTRPC, TRPCError } from '@trpc/server';
import { type Context } from './context';
import superjson from 'superjson';
import { createLogger } from '@/lib/observability/logger';
import { trpcRequestsTotal, trpcRequestDuration } from '@/lib/observability/metrics';

const logger = createLogger({ service: 'trpc' });

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

/**
 * Observability middleware - logs and tracks metrics for all tRPC procedures
 */
const observabilityMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();

  logger.debug({ path, type }, 'tRPC request started');

  try {
    const result = await next();

    const duration = (Date.now() - start) / 1000;

    // Record success metrics
    trpcRequestsTotal.inc({ procedure: path, type, status: 'success' });
    trpcRequestDuration.observe({ procedure: path, type }, duration);

    logger.info({ path, type, duration, status: 'success' }, 'tRPC request completed');

    return result;
  } catch (error) {
    const duration = (Date.now() - start) / 1000;

    // Record error metrics
    const status = error instanceof TRPCError ? error.code : 'INTERNAL_SERVER_ERROR';
    trpcRequestsTotal.inc({ procedure: path, type, status: 'error' });
    trpcRequestDuration.observe({ procedure: path, type }, duration);

    logger.error(
      { path, type, duration, error, status },
      'tRPC request failed'
    );

    throw error;
  }
});

export const router = t.router;
export const publicProcedure = t.procedure.use(observabilityMiddleware);

/**
 * Protected procedure - requires authentication
 *
 * Use this for endpoints that require a valid user session.
 */
export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Now TypeScript knows user is not null
    },
  });
});

/**
 * Permission-based procedure factory
 *
 * Creates a procedure that requires a specific permission.
 * Optionally checks project-level permissions if projectId is in the input.
 *
 * @param permission - The permission name to check (e.g., 'user.create', 'project.update')
 * @returns A procedure that checks for the given permission
 *
 * @example
 * ```typescript
 * const userRouter = router({
 *   create: permissionProcedure('user.create')
 *     .input(createUserSchema)
 *     .mutation(async ({ ctx, input }) => {
 *       // Permission already checked
 *       return createUser(input);
 *     }),
 * });
 * ```
 */
export function permissionProcedure(permission: string) {
  return protectedProcedure.use(async ({ ctx, next, input }) => {
    // Import dynamically to avoid circular dependency
    const { checkPermission } = await import('@/lib/rbac');

    // Extract projectId from input if it exists
    const projectId = (input as any)?.projectId;

    // Check permission
    const hasPermission = await checkPermission({
      userId: ctx.user.userId,
      permission,
      projectId,
    });

    if (!hasPermission) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Insufficient permissions: ${permission}`,
      });
    }

    return next({ ctx });
  });
}
