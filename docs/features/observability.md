# Observability and Monitoring

This document describes the observability and monitoring features implemented in the lightweight web stack, including structured logging, health checks, and Prometheus metrics.

## Table of Contents

- [Overview](#overview)
- [Structured Logging](#structured-logging)
- [Health Checks](#health-checks)
- [Prometheus Metrics](#prometheus-metrics)
- [Usage Examples](#usage-examples)
- [Production Setup](#production-setup)

## Overview

The application includes production-grade observability features:

- **Structured Logging**: JSON-based logging with Pino for high-performance, searchable logs
- **Health Checks**: Kubernetes-compatible liveness, readiness, and startup probes
- **Prometheus Metrics**: Comprehensive metrics collection for monitoring and alerting

All observability features are located in `/lib/observability/`:
- `logger.ts` - Centralized logging configuration
- `metrics.ts` - Prometheus metrics definitions
- `health.ts` - Health check implementations
- `index.ts` - Convenience exports

## Structured Logging

### Features

- **JSON Format**: Structured JSON logs in production for easy parsing and indexing
- **Pretty Print**: Human-readable colored output in development
- **Log Levels**: Standard levels (trace, debug, info, warn, error, fatal)
- **Context**: Child loggers with automatic context propagation
- **Performance**: Built on Pino, one of the fastest Node.js loggers

### Configuration

The logger automatically configures based on `NODE_ENV`:

- **Production**: JSON output, `info` level by default
- **Development**: Pretty-printed output, `debug` level by default

Override the log level with the `LOG_LEVEL` environment variable:

```bash
LOG_LEVEL=debug npm start
```

Available levels (from most to least verbose):
- `trace` (10): External library logging
- `debug` (20): Verbose application logging
- `info` (30): General operational logs (default in production)
- `warn` (40): Warning conditions
- `error` (50): Error conditions
- `fatal` (60): Application crash conditions

### Usage

#### Basic Logging

```typescript
import { logger } from '@/lib/observability/logger';

logger.info('Server started successfully');
logger.warn({ port: 3000 }, 'Using default port');
logger.error({ error }, 'Failed to connect to database');
```

#### Child Loggers with Context

Create child loggers to automatically include context in all log messages:

```typescript
import { createLogger } from '@/lib/observability/logger';

const wsLogger = createLogger({ service: 'websocket' });

wsLogger.info({ clientId: '123' }, 'Client connected');
// Output: {"level":"info","service":"websocket","clientId":"123","msg":"Client connected"}
```

#### Best Practices

1. **Use structured data**: Pass objects as the first parameter for structured fields
2. **Keep messages concise**: Log message should be a short description
3. **Include context**: Use child loggers for service/module-specific logs
4. **Avoid sensitive data**: Never log passwords, tokens, or PII

Example:

```typescript
// Good
logger.info({ userId: user.id, action: 'login' }, 'User logged in successfully');

// Bad
logger.info('User ' + user.email + ' logged in at ' + new Date());
```

### Integrated Services

Logging is integrated across all services:

- **tRPC**: All procedure calls are logged with timing and status
- **WebSocket**: Connection events, messages, and errors
- **Queue Worker**: Job processing, completion, and failures
- **Queue Manager**: Job additions and queue operations

## Health Checks

The application exposes three health check endpoints for Kubernetes and other orchestration platforms.

### Endpoints

#### Liveness Probe
**GET** `/api/health/live`

Checks if the application process is running. Returns 200 if alive.

Response:
```json
{
  "status": "healthy",
  "checks": {
    "server": {
      "status": "up",
      "message": "Server process is running"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Readiness Probe
**GET** `/api/health/ready`

Checks if the application is ready to accept traffic. Verifies all critical dependencies (database, Redis) are available.

Response (healthy):
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "up",
      "message": "Database connection successful",
      "responseTime": 5
    },
    "redis": {
      "status": "up",
      "message": "Redis connection successful",
      "responseTime": 2
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Response (unhealthy):
```json
{
  "status": "unhealthy",
  "checks": {
    "database": {
      "status": "down",
      "message": "Connection timeout",
      "responseTime": 5000
    },
    "redis": {
      "status": "up",
      "message": "Redis connection successful",
      "responseTime": 2
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Returns:
- **200**: All checks passed (healthy)
- **503**: One or more checks failed (unhealthy)

#### Startup Probe
**GET** `/api/health/startup`

Checks if the application has finished starting up. Currently identical to readiness, but can be extended for slow-starting applications.

### Kubernetes Configuration

Example Kubernetes deployment configuration:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lightweight-web
spec:
  template:
    spec:
      containers:
      - name: app
        image: lightweight-web:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /api/health/live
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /api/health/startup
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
```

## Prometheus Metrics

The application exposes comprehensive metrics in Prometheus format for monitoring, alerting, and visualization.

### Metrics Endpoint

**GET** `/api/metrics`

Returns all metrics in Prometheus text format.

Example output:
```
# HELP lightweight_web_http_requests_total Total number of HTTP requests
# TYPE lightweight_web_http_requests_total counter
lightweight_web_http_requests_total{method="GET",route="/api/health/ready",status_code="200"} 145

# HELP lightweight_web_trpc_requests_total Total number of tRPC requests
# TYPE lightweight_web_trpc_requests_total counter
lightweight_web_trpc_requests_total{procedure="user.list",type="query",status="success"} 42
```

### Available Metrics

#### Default Node.js Metrics

Collected automatically with `lightweight_web_` prefix:
- Process CPU usage
- Process memory usage (heap, RSS, external)
- Event loop lag
- Garbage collection duration
- Active handles and requests

#### HTTP Metrics

```
lightweight_web_http_requests_total
  Labels: method, route, status_code
  Total number of HTTP requests

lightweight_web_http_request_duration_seconds
  Labels: method, route, status_code
  HTTP request duration histogram
  Buckets: 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10 seconds
```

#### tRPC Metrics

```
lightweight_web_trpc_requests_total
  Labels: procedure, type (query/mutation), status (success/error)
  Total number of tRPC procedure calls

lightweight_web_trpc_request_duration_seconds
  Labels: procedure, type
  tRPC request duration histogram
  Buckets: 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5 seconds
```

#### WebSocket Metrics

```
lightweight_web_ws_connections_active
  Current number of active WebSocket connections

lightweight_web_ws_connections_total
  Labels: event (connect/disconnect)
  Total number of WebSocket connection events

lightweight_web_ws_messages_total
  Labels: direction (inbound/outbound), type (message type)
  Total number of WebSocket messages

lightweight_web_ws_channel_subscriptions
  Labels: channel
  Number of subscriptions per channel
```

#### Queue Metrics

```
lightweight_web_queue_jobs_total
  Labels: queue, status (added/completed/failed)
  Total number of queue jobs

lightweight_web_queue_job_duration_seconds
  Labels: queue, job_type
  Job processing duration histogram
  Buckets: 0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300 seconds

lightweight_web_queue_jobs_active
  Labels: queue
  Number of currently active jobs

lightweight_web_queue_jobs_waiting
  Labels: queue
  Number of jobs waiting in queue
```

#### Database Metrics

```
lightweight_web_db_query_total
  Labels: operation (select/insert/update/delete)
  Total number of database queries

lightweight_web_db_query_duration_seconds
  Labels: operation
  Database query duration histogram
  Buckets: 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5 seconds

lightweight_web_db_connections_active
  Number of active database connections
```

#### SSH Metrics

```
lightweight_web_ssh_operations_total
  Labels: operation, status (success/error)
  Total number of SSH operations

lightweight_web_ssh_operation_duration_seconds
  Labels: operation
  SSH operation duration histogram
  Buckets: 0.1, 0.5, 1, 2, 5, 10, 30, 60 seconds

lightweight_web_ssh_connection_pool_size
  Labels: status (idle/active)
  Number of connections in SSH pool
```

#### Authentication Metrics

```
lightweight_web_auth_attempts_total
  Labels: method (email/ldap), status (success/failure)
  Total number of authentication attempts
```

#### Business Metrics

```
lightweight_web_users_total
  Total number of registered users

lightweight_web_projects_total
  Total number of projects
```

## Usage Examples

### Custom Metrics in Your Code

```typescript
import { Counter, Histogram } from 'prom-client';

// Create custom metrics
const myCounter = new Counter({
  name: 'lightweight_web_custom_events_total',
  help: 'Total number of custom events',
  labelNames: ['event_type'],
});

const myHistogram = new Histogram({
  name: 'lightweight_web_custom_operation_duration_seconds',
  help: 'Duration of custom operations',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Use them
myCounter.inc({ event_type: 'user_signup' });

const end = myHistogram.startTimer({ operation: 'data_processing' });
await processData();
end();
```

### Logging with Metrics

```typescript
import { createLogger, timeOperation } from '@/lib/observability';
import { httpRequestDuration } from '@/lib/observability/metrics';

const logger = createLogger({ service: 'api' });

async function handleRequest(req, res) {
  const endTimer = timeOperation(httpRequestDuration, {
    method: req.method,
    route: req.path,
    status_code: '200',
  });

  try {
    logger.info({ method: req.method, path: req.path }, 'Request received');

    // Handle request...

    logger.info({ method: req.method, path: req.path }, 'Request completed');
    endTimer();
  } catch (error) {
    logger.error({ error, method: req.method, path: req.path }, 'Request failed');
    endTimer();
    throw error;
  }
}
```

## Production Setup

### Prometheus Configuration

Add the application to your Prometheus scrape configuration:

```yaml
scrape_configs:
  - job_name: 'lightweight-web'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 15s
```

### Grafana Dashboard

Create dashboards to visualize metrics:

**Request Rate**:
```promql
rate(lightweight_web_http_requests_total[5m])
```

**Request Duration (p95)**:
```promql
histogram_quantile(0.95, rate(lightweight_web_http_request_duration_seconds_bucket[5m]))
```

**Error Rate**:
```promql
rate(lightweight_web_trpc_requests_total{status="error"}[5m])
```

**Active WebSocket Connections**:
```promql
lightweight_web_ws_connections_active
```

**Queue Job Processing Rate**:
```promql
rate(lightweight_web_queue_jobs_total{status="completed"}[5m])
```

### Alerting Rules

Example Prometheus alerting rules:

```yaml
groups:
  - name: lightweight_web
    rules:
      - alert: HighErrorRate
        expr: rate(lightweight_web_trpc_requests_total{status="error"}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/second"

      - alert: HighRequestLatency
        expr: histogram_quantile(0.95, rate(lightweight_web_http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High request latency detected"
          description: "P95 latency is {{ $value }} seconds"

      - alert: ServiceDown
        expr: up{job="lightweight-web"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"
          description: "Lightweight web service has been down for more than 1 minute"

      - alert: QueueBacklog
        expr: lightweight_web_queue_jobs_waiting > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Queue backlog is growing"
          description: "{{ $value }} jobs waiting in queue"
```

### Log Aggregation

For production environments, aggregate logs using:

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Loki** (Grafana Loki)
- **Cloud providers** (CloudWatch, Stackdriver, Azure Monitor)

Example Logstash configuration:

```conf
input {
  file {
    path => "/var/log/lightweight-web/*.log"
    codec => json
  }
}

filter {
  # Add any filtering/enrichment here
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "lightweight-web-%{+YYYY.MM.dd}"
  }
}
```

### Environment Variables

Observability-related environment variables:

```bash
# Logging
LOG_LEVEL=info          # trace, debug, info, warn, error, fatal
NODE_ENV=production     # production (JSON logs) or development (pretty logs)

# Application
PORT=3000              # HTTP server port
WS_PORT=3001           # WebSocket server port

# Dependencies (for health checks)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

## Best Practices

1. **Monitor Key Metrics**
   - Request rate and latency (p50, p95, p99)
   - Error rates
   - Queue depth and processing time
   - Database query performance
   - Active connections (WebSocket, database, SSH)

2. **Set Up Alerts**
   - High error rates
   - Elevated latency
   - Service availability
   - Resource exhaustion (memory, connections)
   - Queue backlog

3. **Use Structured Logging**
   - Always use structured fields for searchability
   - Include correlation IDs for request tracing
   - Log at appropriate levels
   - Avoid logging sensitive information

4. **Regular Review**
   - Review dashboards regularly
   - Adjust alert thresholds based on baselines
   - Archive or remove obsolete metrics
   - Update documentation as system evolves

## Troubleshooting

### High Memory Usage

Check for metrics indicating the cause:
```promql
process_resident_memory_bytes
lightweight_web_ws_connections_active
lightweight_web_db_connections_active
```

### Slow Requests

Identify slow endpoints:
```promql
topk(10, histogram_quantile(0.95,
  rate(lightweight_web_trpc_request_duration_seconds_bucket[5m])
))
```

### Queue Backlog

Check job processing rate vs. addition rate:
```promql
rate(lightweight_web_queue_jobs_total{status="added"}[5m])
rate(lightweight_web_queue_jobs_total{status="completed"}[5m])
```

### Connection Issues

Review health check logs:
```bash
curl http://localhost:3000/api/health/ready | jq
```

Check connection metrics:
```promql
lightweight_web_db_connections_active
lightweight_web_ws_connections_active
```

## Related Documentation

- [Architecture Overview](../architecture/architecture.md)
- [Deployment Guide](../architecture/deployment.md)
- [Development Guide](../architecture/development.md)
- [WebSocket Documentation](websocket.md)
- [Task Queue Documentation](task_queue.md)
