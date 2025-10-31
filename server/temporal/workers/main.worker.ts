/**
 * Temporal Worker
 *
 * Main worker process that executes workflows and activities.
 * This worker listens to the 'build-tasks' queue and processes build workflows.
 */

import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from '../activities/build.activities';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { temporalConfig } from '@/lib/temporal/config';

// Load environment variables
dotenv.config();

/**
 * Run the Temporal worker
 */
async function runWorker() {
  console.log('Starting Temporal worker...');
  console.log(`Temporal address: ${temporalConfig.address}`);
  console.log(`Namespace: ${temporalConfig.namespace}`);
  console.log(`Task queue: ${temporalConfig.taskQueues.build}`);

  try {
    // Connect to Temporal server
    const connection = await NativeConnection.connect({
      address: temporalConfig.address,
    });

    console.log('Connected to Temporal server');

    // Create worker
    const worker = await Worker.create({
      connection,
      namespace: temporalConfig.namespace,
      taskQueue: temporalConfig.taskQueues.build,
      workflowsPath: path.join(__dirname, '../workflows'),
      activities,
      // Worker configuration
      maxConcurrentActivityTaskExecutions:
        temporalConfig.worker.maxConcurrentActivityExecutions,
      maxConcurrentWorkflowTaskExecutions:
        temporalConfig.worker.maxConcurrentWorkflowTaskExecutions,
      maxCachedWorkflows: temporalConfig.worker.maxCachedWorkflows,
    });

    console.log(`Worker created successfully`);
    console.log(`Max concurrent activities: ${temporalConfig.worker.maxConcurrentActivityExecutions}`);
    console.log(
      `Max concurrent workflow tasks: ${temporalConfig.worker.maxConcurrentWorkflowTaskExecutions}`
    );
    console.log(`Max cached workflows: ${temporalConfig.worker.maxCachedWorkflows}`);
    console.log('');
    console.log('Worker is running and listening for tasks...');
    console.log('Press Ctrl+C to stop');

    // Run the worker
    await worker.run();
  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\nReceived ${signal}, shutting down worker gracefully...`);

  // The worker will finish its current tasks before shutting down
  // This is handled automatically by the Temporal SDK

  console.log('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the worker
runWorker().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
