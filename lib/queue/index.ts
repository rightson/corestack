import { Queue, JobsOptions } from 'bullmq';
import { defaultQueueOptions, QUEUE_NAMES } from './config';

// Create queues
const queues = {
  [QUEUE_NAMES.DEFAULT]: new Queue(QUEUE_NAMES.DEFAULT, defaultQueueOptions),
  [QUEUE_NAMES.EMAIL]: new Queue(QUEUE_NAMES.EMAIL, defaultQueueOptions),
  [QUEUE_NAMES.PROCESSING]: new Queue(QUEUE_NAMES.PROCESSING, defaultQueueOptions),
};

export interface TaskData {
  [key: string]: any;
}

export class QueueManager {
  static async addJob(
    queueName: keyof typeof queues,
    jobName: string,
    data: TaskData,
    options?: JobsOptions
  ) {
    const queue = queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(jobName, data, options);
    console.log(`Job ${jobName} added to queue ${queueName} with id ${job.id}`);
    return job;
  }

  static async getJob(queueName: keyof typeof queues, jobId: string) {
    const queue = queues[queueName];
    return await queue.getJob(jobId);
  }

  static async getQueue(queueName: keyof typeof queues) {
    return queues[queueName];
  }

  static async close() {
    await Promise.all(Object.values(queues).map((q) => q.close()));
  }
}

export { queues, QUEUE_NAMES };
