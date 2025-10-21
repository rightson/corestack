import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
};

export const QUEUE_NAMES = {
  DEFAULT: 'default',
  EMAIL: 'email',
  PROCESSING: 'processing',
} as const;
