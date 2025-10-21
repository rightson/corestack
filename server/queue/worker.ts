import { Worker, Job } from 'bullmq';
import { redisConnection, QUEUE_NAMES } from '@/lib/queue/config';
import * as dotenv from 'dotenv';

dotenv.config();

// Job handlers
async function handleDefaultJob(job: Job) {
  console.log(`Processing default job ${job.id}:`, job.data);

  // Simulate some work
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return { success: true, processedAt: new Date().toISOString() };
}

async function handleEmailJob(job: Job) {
  console.log(`Processing email job ${job.id}:`, job.data);

  const { to, subject, body } = job.data;

  // Simulate sending email
  console.log(`Sending email to ${to}: ${subject}`);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return { success: true, sentAt: new Date().toISOString() };
}

async function handleProcessingJob(job: Job) {
  console.log(`Processing job ${job.id}:`, job.data);

  // Simulate data processing
  const { data } = job.data;
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return {
    success: true,
    processed: data,
    completedAt: new Date().toISOString(),
  };
}

// Create workers
const defaultWorker = new Worker(
  QUEUE_NAMES.DEFAULT,
  async (job) => {
    return await handleDefaultJob(job);
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

const emailWorker = new Worker(
  QUEUE_NAMES.EMAIL,
  async (job) => {
    return await handleEmailJob(job);
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

const processingWorker = new Worker(
  QUEUE_NAMES.PROCESSING,
  async (job) => {
    return await handleProcessingJob(job);
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
    console.log(`Job ${job.id} in queue ${worker.name} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} in queue ${worker.name} failed:`, err);
  });

  worker.on('error', (err) => {
    console.error(`Worker ${worker.name} error:`, err);
  });
});

console.log('Workers started for queues:', Object.values(QUEUE_NAMES).join(', '));

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  await redisConnection.quit();
  console.log('Workers shut down');
  process.exit(0);
});
