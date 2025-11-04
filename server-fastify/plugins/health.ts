import type { FastifyInstance } from 'fastify';
import {
  checkDatabaseHealth,
  checkRedisHealth,
} from '@/lib/observability/health';

export function registerHealthRoutes(server: FastifyInstance) {
  // Readiness check
  server.get('/api/health/ready', async (request, reply) => {
    const dbHealthy = await checkDatabaseHealth();
    const redisHealthy = await checkRedisHealth();

    if (dbHealthy && redisHealthy) {
      return reply.code(200).send({ status: 'ready' });
    } else {
      return reply.code(503).send({
        status: 'not ready',
        database: dbHealthy,
        redis: redisHealthy,
      });
    }
  });

  // Liveness check
  server.get('/api/health/live', async (request, reply) => {
    return reply.code(200).send({ status: 'alive' });
  });

  // Startup check
  server.get('/api/health/startup', async (request, reply) => {
    const dbHealthy = await checkDatabaseHealth();

    if (dbHealthy) {
      return reply.code(200).send({ status: 'started' });
    } else {
      return reply.code(503).send({ status: 'starting' });
    }
  });
}
