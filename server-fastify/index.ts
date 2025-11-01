import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/lib/trpc/context';
import { registerHealthRoutes } from './plugins/health';
import { registerMetricsRoute } from './plugins/metrics';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ service: 'fastify' });

async function main() {
  const server = Fastify({
    logger: false, // Use our pino logger instead
    maxParamLength: 5000,
  });

  // CORS
  await server.register(cors, {
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL || 'http://localhost:3000'
        : 'http://localhost:3000',
    credentials: true,
  });

  // tRPC
  await server.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }) {
        logger.error({ path, error }, 'tRPC error');
      },
    },
  });

  // Health checks
  registerHealthRoutes(server);

  // Metrics
  registerMetricsRoute(server);

  const port = parseInt(process.env.API_PORT || '4000');
  await server.listen({ port, host: '0.0.0.0' });

  logger.info({ port }, 'Fastify server started');
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
