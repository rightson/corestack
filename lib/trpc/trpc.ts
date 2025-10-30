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
