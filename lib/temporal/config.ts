/**
 * Temporal Configuration
 *
 * Connection and namespace configuration for Temporal server
 */

export const temporalConfig = {
  // Temporal server address
  address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',

  // Temporal namespace (default is 'default')
  namespace: process.env.TEMPORAL_NAMESPACE || 'default',

  // Task queue names
  taskQueues: {
    build: 'build-tasks',
    deploy: 'deploy-tasks',
    email: 'email-tasks',
    default: 'default-tasks',
  },

  // Worker configuration
  worker: {
    maxConcurrentActivityExecutions: 10,
    maxConcurrentWorkflowTaskExecutions: 100,
    maxCachedWorkflows: 100,
  },

  // Workflow timeouts
  timeouts: {
    // Maximum time a workflow can run
    workflowExecutionTimeout: '7 days',
    // Maximum time a single workflow task can take
    workflowTaskTimeout: '10 seconds',
    // Maximum time an activity can run
    activityStartToCloseTimeout: '10 minutes',
    // Heartbeat interval for long-running activities
    activityHeartbeatInterval: '5 seconds',
  },

  // Retry policy defaults
  retryPolicy: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '100s',
    maximumAttempts: 3,
  },
} as const;

export type TemporalConfig = typeof temporalConfig;
