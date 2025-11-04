import type { FastifyInstance } from 'fastify';
import { register } from '@/lib/observability/metrics';

export function registerMetricsRoute(server: FastifyInstance) {
  server.get('/api/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}
