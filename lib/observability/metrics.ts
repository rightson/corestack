import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Collect default metrics (memory, CPU, event loop lag, etc.)
collectDefaultMetrics({
  prefix: 'lightweight_web_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

/**
 * HTTP Request Metrics
 */
export const httpRequestsTotal = new Counter({
  name: 'lightweight_web_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new Histogram({
  name: 'lightweight_web_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

/**
 * tRPC Request Metrics
 */
export const trpcRequestsTotal = new Counter({
  name: 'lightweight_web_trpc_requests_total',
  help: 'Total number of tRPC requests',
  labelNames: ['procedure', 'type', 'status'],
});

export const trpcRequestDuration = new Histogram({
  name: 'lightweight_web_trpc_request_duration_seconds',
  help: 'Duration of tRPC requests in seconds',
  labelNames: ['procedure', 'type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

/**
 * WebSocket Metrics
 */
export const wsConnectionsActive = new Gauge({
  name: 'lightweight_web_ws_connections_active',
  help: 'Number of active WebSocket connections',
});

export const wsConnectionsTotal = new Counter({
  name: 'lightweight_web_ws_connections_total',
  help: 'Total number of WebSocket connections',
  labelNames: ['event'], // 'connect' or 'disconnect'
});

export const wsMessagesTotal = new Counter({
  name: 'lightweight_web_ws_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['direction', 'type'], // direction: 'inbound' | 'outbound', type: message type
});

export const wsChannelSubscriptions = new Gauge({
  name: 'lightweight_web_ws_channel_subscriptions',
  help: 'Number of subscriptions per channel',
  labelNames: ['channel'],
});

/**
 * Queue Metrics
 */
export const queueJobsTotal = new Counter({
  name: 'lightweight_web_queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'status'], // status: 'completed' | 'failed' | 'added'
});

export const queueJobDuration = new Histogram({
  name: 'lightweight_web_queue_job_duration_seconds',
  help: 'Duration of queue job processing in seconds',
  labelNames: ['queue', 'job_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
});

export const queueJobsActive = new Gauge({
  name: 'lightweight_web_queue_jobs_active',
  help: 'Number of currently active queue jobs',
  labelNames: ['queue'],
});

export const queueJobsWaiting = new Gauge({
  name: 'lightweight_web_queue_jobs_waiting',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue'],
});

/**
 * Database Metrics
 */
export const dbQueryTotal = new Counter({
  name: 'lightweight_web_db_query_total',
  help: 'Total number of database queries',
  labelNames: ['operation'], // 'select', 'insert', 'update', 'delete'
});

export const dbQueryDuration = new Histogram({
  name: 'lightweight_web_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const dbConnectionsActive = new Gauge({
  name: 'lightweight_web_db_connections_active',
  help: 'Number of active database connections',
});

/**
 * SSH Operation Metrics
 */
export const sshOperationsTotal = new Counter({
  name: 'lightweight_web_ssh_operations_total',
  help: 'Total number of SSH operations',
  labelNames: ['operation', 'status'], // status: 'success' | 'error'
});

export const sshOperationDuration = new Histogram({
  name: 'lightweight_web_ssh_operation_duration_seconds',
  help: 'Duration of SSH operations in seconds',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});

export const sshConnectionPoolSize = new Gauge({
  name: 'lightweight_web_ssh_connection_pool_size',
  help: 'Number of connections in the SSH pool',
  labelNames: ['status'], // status: 'idle' | 'active'
});

/**
 * Authentication Metrics
 */
export const authAttemptsTotal = new Counter({
  name: 'lightweight_web_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'status'], // method: 'email' | 'ldap', status: 'success' | 'failure'
});

/**
 * Business Metrics
 */
export const usersTotal = new Gauge({
  name: 'lightweight_web_users_total',
  help: 'Total number of registered users',
});

export const projectsTotal = new Gauge({
  name: 'lightweight_web_projects_total',
  help: 'Total number of projects',
});

/**
 * Get all metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get content type for Prometheus metrics
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

/**
 * Clear all metrics (useful for testing)
 */
export function clearMetrics(): void {
  register.clear();
}

/**
 * Helper to time an operation and record it in a histogram
 *
 * @example
 * const end = timeOperation(dbQueryDuration, { operation: 'select' });
 * await db.query.users.findMany();
 * end();
 */
export function timeOperation(
  histogram: Histogram,
  labels: Record<string, string | number>
): () => void {
  const end = histogram.startTimer(labels);
  return () => end();
}
