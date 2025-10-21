# Background Job Processing Flow

## Job Queue Flow

This document details how background jobs are processed using BullMQ and Redis.

### Flow Diagram

```
API/Component (app/api/queue/route.ts or components/*.tsx)
    │
    │ QueueManager.addJob('email', 'send-welcome', data)
    ▼
BullMQ Queue Manager (lib/queue/index.ts)
    │
    │ Creates job with options
    │ Adds job to Redis queue
    ▼
Redis (port 6379)
    │
    │ Job stored in BullMQ queue structure
    │ Job awaits processing
    ▼
Queue Worker (server/queue/workers.ts)
    │
    │ Continuously polls Redis for jobs
    │ Picks up job from queue
    │ Executes worker function (processEmailJob, etc.)
    ▼
Job Processing
    │
    │ Business logic executes
    │ May interact with database or external services
    ▼
Job Completed/Failed
    │
    │ Result stored in Redis
    │ If failed: retry based on attempts config
    │ If succeeded: mark complete
    ▼
Optional callback or retry (configured in lib/queue/index.ts)
```

## Available Queues

### 1. Default Queue

General-purpose queue for miscellaneous tasks:

```typescript
await QueueManager.addJob('default', 'my-task', {
  data: 'task data',
});
```

### 2. Email Queue

Dedicated queue for email-related tasks:

```typescript
await QueueManager.addJob('email', 'send-welcome', {
  userId: 123,
  email: 'user@example.com',
});
```

### 3. Processing Queue

For data processing and heavy computations:

```typescript
await QueueManager.addJob('processing', 'process-data', {
  dataId: 456,
  options: {},
});
```

## Job Lifecycle

### 1. Job Creation

```typescript
const job = await QueueManager.addJob(
  'default',        // Queue name
  'job-name',       // Job name/type
  { data: '...' },  // Job data
  {
    attempts: 3,    // Retry attempts
    backoff: {
      type: 'exponential',
      delay: 1000,  // Initial delay in ms
    },
  }
);
```

### 2. Job Storage

Job is serialized and stored in Redis with:
- Unique job ID
- Job data
- Options and configuration
- Status (waiting, active, completed, failed)
- Timestamps

### 3. Worker Picks Up Job

Worker continuously polls the queue:

```typescript
worker.on('active', (job) => {
  console.log(`Processing job ${job.id}`);
});
```

### 4. Job Processing

Worker function executes:

```typescript
async function processEmailJob(job: Job) {
  const { userId, email } = job.data;

  // Send email
  await sendEmail(email, 'Welcome!');

  // Update database
  await db.update(users)
    .set({ emailSent: true })
    .where(eq(users.id, userId));

  return { success: true };
}
```

### 5. Job Completion

On success:
- Job marked as completed
- Result stored in Redis
- Job removed from active set

On failure:
- Job marked as failed
- Retry if attempts remaining
- Move to failed set if max attempts reached

## Job Options

### Retry Configuration

```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
}
```

### Delayed Jobs

```typescript
{
  delay: 5000, // Start after 5 seconds
}
```

### Priority

```typescript
{
  priority: 1, // Lower number = higher priority
}
```

### Remove on Complete

```typescript
{
  removeOnComplete: true, // Remove from Redis after completion
  removeOnFail: false,    // Keep failed jobs for debugging
}
```

## Worker Configuration

Workers are configured in `server/queue/workers.ts`:

```typescript
import { Worker } from 'bullmq';

const worker = new Worker('default', async (job) => {
  // Route to appropriate handler based on job.name
  switch (job.name) {
    case 'send-email':
      return await processEmailJob(job);
    case 'process-data':
      return await processDataJob(job);
    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}, {
  connection: {
    host: 'localhost',
    port: 6379,
  },
  concurrency: 5, // Process 5 jobs concurrently
});
```

## Monitoring Jobs

### Check Job Status

```typescript
const job = await queue.getJob(jobId);
console.log(job.getState()); // 'waiting', 'active', 'completed', 'failed'
```

### View Queue Stats

```typescript
const counts = await queue.getJobCounts();
console.log(counts); // { waiting: 10, active: 2, completed: 100 }
```

### Failed Jobs

```typescript
const failed = await queue.getFailed();
failed.forEach(job => {
  console.log(job.failedReason);
});
```

## Best Practices

1. **Keep Jobs Small** - Break large tasks into smaller jobs
2. **Idempotent Operations** - Jobs should be safely retryable
3. **Proper Error Handling** - Catch and log errors appropriately
4. **Monitor Queue Length** - Alert on queue buildup
5. **Set Reasonable Timeouts** - Prevent jobs from running indefinitely
6. **Clean Up Completed Jobs** - Use removeOnComplete to manage memory

## Starting the Worker

```bash
# Start the queue worker
npm run queue:worker
```

The worker runs as a separate process and should be kept running in production.

## API Endpoint

Add jobs via REST API:

```bash
curl -X POST http://localhost:3000/api/queue/add \
  -H "Content-Type: application/json" \
  -d '{
    "queueName": "default",
    "jobName": "my-job",
    "data": { "key": "value" }
  }'
```
