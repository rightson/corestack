import { Worker, Job } from 'bullmq';
import { redisConnection, QUEUE_NAMES } from '@/lib/queue/config';
import * as dotenv from 'dotenv';
import { createLogger } from '@/lib/observability/logger';
import {
  queueJobsTotal,
  queueJobDuration,
  queueJobsActive,
  timeOperation,
} from '@/lib/observability/metrics';

dotenv.config();

const logger = createLogger({ service: 'queue-worker' });

// Job handlers
async function handleDefaultJob(job: Job) {
  logger.info({ jobId: job.id, data: job.data }, 'Processing default job');

  // Simulate some work
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return { success: true, processedAt: new Date().toISOString() };
}

async function handleEmailJob(job: Job) {
  const { to, subject, body } = job.data;
  logger.info({ jobId: job.id, to, subject }, 'Processing email job');

  // Simulate sending email
  logger.debug({ to, subject }, 'Sending email');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return { success: true, sentAt: new Date().toISOString() };
}

async function handleProcessingJob(job: Job) {
  logger.info({ jobId: job.id, data: job.data }, 'Processing data job');

  // Simulate data processing
  const { data } = job.data;
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return {
    success: true,
    processed: data,
    completedAt: new Date().toISOString(),
  };
}

// Create workers with metrics
const defaultWorker = new Worker(
  QUEUE_NAMES.DEFAULT,
  async (job) => {
    const endTimer = timeOperation(queueJobDuration, {
      queue: QUEUE_NAMES.DEFAULT,
      job_type: job.name || 'default',
    });
    queueJobsActive.inc({ queue: QUEUE_NAMES.DEFAULT });

    try {
      return await handleDefaultJob(job);
    } finally {
      queueJobsActive.dec({ queue: QUEUE_NAMES.DEFAULT });
      endTimer();
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

const emailWorker = new Worker(
  QUEUE_NAMES.EMAIL,
  async (job) => {
    const endTimer = timeOperation(queueJobDuration, {
      queue: QUEUE_NAMES.EMAIL,
      job_type: job.name || 'email',
    });
    queueJobsActive.inc({ queue: QUEUE_NAMES.EMAIL });

    try {
      return await handleEmailJob(job);
    } finally {
      queueJobsActive.dec({ queue: QUEUE_NAMES.EMAIL });
      endTimer();
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

const processingWorker = new Worker(
  QUEUE_NAMES.PROCESSING,
  async (job) => {
    const endTimer = timeOperation(queueJobDuration, {
      queue: QUEUE_NAMES.PROCESSING,
      job_type: job.name || 'processing',
    });
    queueJobsActive.inc({ queue: QUEUE_NAMES.PROCESSING });

    try {
      return await handleProcessingJob(job);
    } finally {
      queueJobsActive.dec({ queue: QUEUE_NAMES.PROCESSING });
      endTimer();
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// Worker event listeners
const workers = [defaultWorker, emailWorker, processingWorker];

workers.forEach((worker) => {
  worker.on('completed', (job) => {
    queueJobsTotal.inc({ queue: worker.name, status: 'completed' });
    logger.info({ jobId: job.id, queue: worker.name }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    queueJobsTotal.inc({ queue: worker.name, status: 'failed' });
    logger.error({ jobId: job?.id, queue: worker.name, error: err }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ queue: worker.name, error: err }, 'Worker error');
  });
});

logger.info({ queues: Object.values(QUEUE_NAMES) }, 'Queue workers started');

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down workers');
  await Promise.all(workers.map((w) => w.close()));
  await redisConnection.quit();
  logger.info('Workers shut down');
  process.exit(0);
});
