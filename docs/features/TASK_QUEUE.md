# Task Queue Guide

## Overview

The task queue system uses [BullMQ](https://docs.bullmq.io/) with Redis for background job processing.

## Available Queues

Three queues are available:

1. **default** - General purpose queue
2. **email** - Email sending queue
3. **processing** - Data processing queue

## Adding Jobs

### Via API

```javascript
fetch('/api/queue/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    queueName: 'default',
    jobName: 'my-job',
    data: { key: 'value' }
  })
});
```

### Via Code

```typescript
import { QueueManager } from '@/lib/queue';

await QueueManager.addJob('default', 'process-data', {
  data: 'example'
});
```

## Queue Worker

The queue worker processes jobs in the background.

### Starting the Worker

```bash
npm run queue:worker
```

### Worker Implementation

Workers are defined in `server/queue/workers.ts`:

```typescript
import { Job } from 'bullmq';

export async function processDefaultJob(job: Job) {
  console.log('Processing job:', job.name, job.data);
  // Your job processing logic here
  return { success: true };
}
```

## Job Options

When adding jobs, you can specify options:

```typescript
await QueueManager.addJob(
  'default',
  'my-job',
  { data: 'example' },
  {
    delay: 5000,        // Delay 5 seconds before processing
    attempts: 3,        // Retry up to 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
);
```

## Common Use Cases

### Email Queue

```typescript
await QueueManager.addJob('email', 'send-welcome-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Welcome to our app'
});
```

### Data Processing Queue

```typescript
await QueueManager.addJob('processing', 'process-large-file', {
  fileId: 123,
  operation: 'analyze'
});
```

## Monitoring

### BullMQ Board (Optional)

You can add Bull Board for a web UI to monitor queues:

```bash
npm install @bull-board/express @bull-board/api
```

## Environment Configuration

Redis connection is configured via `.env`:

```env
REDIS_URL=redis://localhost:6379
```

## Error Handling

Jobs automatically retry on failure based on the `attempts` option. Failed jobs are moved to a failed queue for later inspection.

```typescript
export async function processDefaultJob(job: Job) {
  try {
    // Job logic
    return { success: true };
  } catch (error) {
    console.error('Job failed:', error);
    throw error; // Will trigger retry
  }
}
```
