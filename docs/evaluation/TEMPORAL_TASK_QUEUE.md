# Temporal Task Queue Integration

## Overview

This document outlines the design and implementation strategy for adopting Temporal as the task queue system for the lightweight-web-seed stack. Temporal provides a robust, scalable, and observable workflow orchestration platform that excels at managing long-running tasks, complex workflows, and distributed systems.

**Implementation Status**: 🔴 Not Started (0% complete)

## What is Temporal?

Temporal is a durable execution platform that guarantees workflow completion even in the presence of failures. It provides:

- **Durable Execution** - Workflows automatically resume after crashes or restarts
- **Built-in Observability** - Complete visibility into workflow state and history
- **Activity Management** - Reliable execution of tasks with automatic retries
- **Workflow Versioning** - Safe deployment of workflow changes
- **Time Travel Debugging** - Replay workflows for debugging
- **Distributed Tracing** - Built-in monitoring and metrics
- **Scalable Workers** - Horizontally scalable task execution
- **Strong Type Safety** - Full TypeScript support with end-to-end type safety

## Current State: BullMQ

### Current Implementation

The stack currently uses BullMQ with Redis for task queue management:

**Components:**
- **Queue Manager** (`lib/queue/index.ts`) - Queue creation and job management
- **Worker** (`server/queue/worker.ts`) - Job processors for different queue types
- **Queues**: `default`, `email`, `processing`
- **Infrastructure**: Redis backend

**Strengths:**
- ✅ Simple setup and configuration
- ✅ Good for basic job queuing
- ✅ Reliable for short-lived tasks
- ✅ Redis-based persistence

**Limitations:**
- ❌ Limited workflow orchestration capabilities
- ❌ No built-in support for complex task dependencies
- ❌ Requires external tooling for comprehensive observability
- ❌ Difficult to handle long-running tasks (hours/days)
- ❌ No built-in workflow versioning
- ❌ Limited debugging capabilities for failed workflows
- ❌ Manual implementation of saga patterns and compensations
- ❌ No native support for task state queries from CLI/UI

## Why Temporal for This Stack?

### 1. Long-Running Task Support

**Use Case**: Long-running CLI operations submitted from UI or CLI that may take minutes, hours, or days.

**Current Problem with BullMQ:**
- Redis connection timeouts for tasks > 30 minutes
- Manual checkpointing and state management
- Difficult to resume interrupted tasks
- Resource consumption for keeping jobs in memory

**Temporal Solution:**
```typescript
// Workflow automatically persists state and can run for days/weeks
export async function longRunningBuildWorkflow(params: BuildParams) {
  // Each activity can run for extended periods
  await downloadDependencies(params);
  await runTests(params);
  await buildProject(params);
  await deployArtifacts(params);

  // If worker crashes, workflow automatically resumes from last checkpoint
  return { status: 'completed', timestamp: Date.now() };
}
```

### 2. Built-in Task State Observability

**Requirement**: Easy observation of task state from UI and CLI components.

**Temporal Advantages:**
- **Workflow Query**: Real-time state inspection without affecting execution
- **Workflow History**: Complete audit trail of all state transitions
- **Rich Metadata**: Timestamps, retries, failures, and custom data
- **Web UI**: Temporal Web provides built-in visualization
- **API Access**: Query workflow state via TypeScript SDK

**Example: UI Integration**
```typescript
// Query workflow status from UI component
const workflowHandle = temporal.workflow.getHandle(workflowId);
const status = await workflowHandle.query('getStatus');
const progress = await workflowHandle.query('getProgress');

// Real-time updates via signals
await workflowHandle.signal('updateProgress', { percent: 45 });
```

**Example: CLI Integration**
```typescript
// CLI command to check task status
cli
  .command('task status <taskId>')
  .action(async (taskId: string) => {
    const handle = temporal.workflow.getHandle(taskId);
    const status = await handle.describe();
    console.log({
      status: status.status,
      startTime: status.startTime,
      runTime: Date.now() - status.startTime.getTime(),
      currentActivity: status.pendingActivities[0]?.activityType
    });
  });
```

### 3. Configurable Worker Servers

**Requirement**: Tasks executed by configured worker servers with flexible scaling.

**Temporal Architecture:**
```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│  UI Client  │─────▶│   Temporal   │◀─────│ CLI Client   │
└─────────────┘      │    Server    │      └──────────────┘
                     └──────────────┘
                            │
                            │ Task Queue
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
   │ Worker  │        │ Worker  │        │ Worker  │
   │  Pod 1  │        │  Pod 2  │        │  Pod N  │
   └─────────┘        └─────────┘        └─────────┘
```

**Worker Configuration:**
```typescript
// Multiple worker configurations for different task types
const buildWorker = await Worker.create({
  connection,
  namespace: 'default',
  taskQueue: 'build-tasks',
  workflowsPath: require.resolve('./workflows'),
  activities: buildActivities,
  maxConcurrentActivityExecutions: 10,
});

const deployWorker = await Worker.create({
  connection,
  taskQueue: 'deploy-tasks',
  activities: deployActivities,
  maxConcurrentActivityExecutions: 5,
});

// Scale workers horizontally - just start more instances
// Workers automatically coordinate via Temporal Server
```

### 4. Complex Workflow Orchestration

**Current Limitation**: BullMQ requires manual implementation of task dependencies and workflows.

**Temporal Benefits:**
```typescript
// Complex workflow with conditional logic, retries, and compensation
export async function deploymentWorkflow(params: DeployParams) {
  let buildSuccess = false;

  try {
    // Run tests in parallel
    const [unitTests, integrationTests] = await Promise.all([
      runUnitTests(params),
      runIntegrationTests(params)
    ]);

    // Conditional execution
    if (unitTests.passed && integrationTests.passed) {
      buildSuccess = await buildApplication(params);

      if (buildSuccess) {
        // Deploy to staging
        const stagingDeploy = await deployToStaging(params);

        // Wait for approval (can wait days/weeks)
        await workflow.condition(() => approvalReceived);

        // Deploy to production
        await deployToProduction(params);
      }
    }

    return { success: true };
  } catch (error) {
    // Automatic compensation/rollback
    if (buildSuccess) {
      await rollbackDeployment(params);
    }
    throw error;
  }
}
```

### 5. Enhanced Developer Experience

**Built-in Time Travel Debugging:**
- Replay failed workflows with exact same inputs and state
- Test workflow changes against production history
- Debug race conditions and timing issues

**Strong Type Safety:**
```typescript
// End-to-end type safety from client to workflow
interface BuildWorkflowParams {
  projectId: string;
  branch: string;
  config: BuildConfig;
}

interface BuildWorkflowResult {
  status: 'success' | 'failure';
  artifactUrl?: string;
  errors?: string[];
}

// Type-safe workflow definition
export async function buildWorkflow(
  params: BuildWorkflowParams
): Promise<BuildWorkflowResult> {
  // Implementation
}

// Type-safe client call
const result = await client.workflow.execute<BuildWorkflowResult>(
  buildWorkflow,
  {
    taskQueue: 'build-tasks',
    workflowId: `build-${projectId}`,
    args: [{ projectId, branch, config }],
  }
);
```

## Architecture Design

### System Components

```
┌──────────────────────────────────────────────────────────────────┐
│                         Application Layer                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────┐         ┌──────────────┐        ┌─────────────┐ │
│  │   Next.js   │         │   CLI Tool   │        │   tRPC API  │ │
│  │  UI Client  │         │              │        │   Routes    │ │
│  └──────┬──────┘         └──────┬───────┘        └──────┬──────┘ │
│         │                       │                       │        │
│         └───────────────────────┼───────────────────────┘        │
│                                 │                                │
│                                 ▼                                │
│                     ┌───────────────────────┐                    │
│                     │  Temporal TypeScript  │                    │
│                     │       SDK Client      │                    │
│                     └───────────┬───────────┘                    │
└─────────────────────────────────┼────────────────────────────────┘
                                  │
                                  │ gRPC
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│                       Temporal Server                             │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Workflow   │  │   Activity   │  │   History    │           │
│  │    Engine    │  │    Engine    │  │   Service    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                    │
│  Storage: PostgreSQL (Workflow State & History)                   │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 │ Task Queues
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼─────┐           ┌────▼─────┐          ┌─────▼─────┐
    │  Worker  │           │  Worker  │          │  Worker   │
    │  Pool 1  │           │  Pool 2  │          │  Pool N   │
    │          │           │          │          │           │
    │ ┌──────┐ │           │ ┌──────┐ │          │ ┌───────┐ │
    │ │Build │ │           │ │Email │ │          │ │Deploy │ │
    │ │Tasks │ │           │ │Tasks │ │          │ │Tasks  │ │
    │ └──────┘ │           │ └──────┘ │          │ └───────┘ │
    └──────────┘           └──────────┘          └───────────┘
```

### File Structure

```
lightweight-web-seed/
├── lib/
│   └── temporal/
│       ├── client.ts              # Temporal client configuration
│       ├── config.ts              # Connection and namespace config
│       ├── types.ts               # Shared workflow types
│       └── utils.ts               # Helper functions
├── server/
│   ├── temporal/
│   │   ├── workflows/             # Workflow definitions
│   │   │   ├── build.workflow.ts
│   │   │   ├── deploy.workflow.ts
│   │   │   └── email.workflow.ts
│   │   ├── activities/            # Activity implementations
│   │   │   ├── build.activities.ts
│   │   │   ├── deploy.activities.ts
│   │   │   └── email.activities.ts
│   │   └── workers/               # Worker configurations
│   │       ├── build.worker.ts
│   │       ├── deploy.worker.ts
│   │       └── main.worker.ts
│   └── routers/
│       └── temporal.router.ts     # tRPC endpoints for Temporal
├── cli/
│   ├── commands/
│   │   └── task.ts                # Task management CLI commands
│   └── index.ts
├── app/
│   └── api/
│       └── temporal/
│           └── route.ts           # REST endpoints (if needed)
└── components/
    └── TaskMonitor.tsx            # UI component for task monitoring
```

## Integration Patterns

### 1. Starting Workflows from UI

**Component: TaskMonitor.tsx**
```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

export function TaskSubmitButton({ projectId }: { projectId: string }) {
  const [workflowId, setWorkflowId] = useState<string | null>(null);

  const startBuild = trpc.temporal.startBuild.useMutation({
    onSuccess: (result) => {
      setWorkflowId(result.workflowId);
    },
  });

  const { data: status } = trpc.temporal.getWorkflowStatus.useQuery(
    { workflowId: workflowId! },
    { enabled: !!workflowId, refetchInterval: 2000 }
  );

  return (
    <div>
      <button
        onClick={() => startBuild.mutate({ projectId, branch: 'main' })}
        disabled={startBuild.isPending}
      >
        {startBuild.isPending ? 'Starting...' : 'Start Build'}
      </button>

      {status && (
        <div className="mt-4">
          <p>Status: {status.status}</p>
          <p>Progress: {status.progress}%</p>
          <p>Current Step: {status.currentStep}</p>
          {status.logs && (
            <pre className="mt-2 text-xs">
              {status.logs.slice(-10).join('\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
```

**tRPC Router: temporal.router.ts**
```typescript
import { z } from 'zod';
import { router, publicProcedure } from '@/lib/trpc/server';
import { temporalClient } from '@/lib/temporal/client';
import { buildWorkflow } from '@/server/temporal/workflows/build.workflow';

export const temporalRouter = router({
  startBuild: publicProcedure
    .input(z.object({
      projectId: z.string(),
      branch: z.string(),
      config: z.object({}).optional(),
    }))
    .mutation(async ({ input }) => {
      const workflowId = `build-${input.projectId}-${Date.now()}`;

      const handle = await temporalClient.workflow.start(buildWorkflow, {
        taskQueue: 'build-tasks',
        workflowId,
        args: [input],
      });

      return {
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      };
    }),

  getWorkflowStatus: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ input }) => {
      const handle = temporalClient.workflow.getHandle(input.workflowId);

      try {
        const description = await handle.describe();
        const progress = await handle.query('getProgress');
        const logs = await handle.query('getLogs');

        return {
          status: description.status.name,
          startTime: description.startTime,
          progress,
          logs,
          currentStep: description.pendingActivities[0]?.activityType || 'idle',
        };
      } catch (error) {
        return {
          status: 'unknown',
          error: error.message,
        };
      }
    }),

  cancelWorkflow: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input }) => {
      const handle = temporalClient.workflow.getHandle(input.workflowId);
      await handle.cancel();
      return { success: true };
    }),

  listWorkflows: publicProcedure
    .input(z.object({
      status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const workflows = await temporalClient.workflow.list({
        query: input.status ? `ExecutionStatus="${input.status}"` : undefined,
      });

      return {
        workflows: await Promise.all(
          Array.from(workflows).slice(0, input.limit).map(async (w) => ({
            workflowId: w.workflowId,
            status: w.status.name,
            startTime: w.startTime,
            type: w.workflowType,
          }))
        ),
      };
    }),
});
```

### 2. Starting Workflows from CLI

**CLI Commands: cli/commands/task.ts**
```typescript
import { Command } from 'commander';
import { temporalClient } from '@/lib/temporal/client';
import { buildWorkflow } from '@/server/temporal/workflows/build.workflow';
import chalk from 'chalk';
import ora from 'ora';

export function createTaskCommands() {
  const taskCmd = new Command('task')
    .description('Task and workflow management commands');

  // Start a new workflow
  taskCmd
    .command('start <type>')
    .description('Start a new workflow')
    .option('-p, --project <projectId>', 'Project ID')
    .option('-b, --branch <branch>', 'Git branch', 'main')
    .option('-w, --wait', 'Wait for completion')
    .action(async (type: string, options) => {
      const spinner = ora('Starting workflow...').start();

      try {
        const workflowId = `${type}-${options.project}-${Date.now()}`;

        const handle = await temporalClient.workflow.start(buildWorkflow, {
          taskQueue: `${type}-tasks`,
          workflowId,
          args: [{
            projectId: options.project,
            branch: options.branch,
          }],
        });

        spinner.succeed(chalk.green(`Workflow started: ${workflowId}`));
        console.log(`Run ID: ${handle.firstExecutionRunId}`);

        if (options.wait) {
          spinner.start('Waiting for workflow to complete...');
          const result = await handle.result();
          spinner.succeed(chalk.green('Workflow completed'));
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.blue(`\nMonitor with: task status ${workflowId}`));
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to start workflow'));
        console.error(error);
        process.exit(1);
      }
    });

  // Get workflow status
  taskCmd
    .command('status <workflowId>')
    .description('Get workflow status')
    .option('-f, --follow', 'Follow workflow progress')
    .action(async (workflowId: string, options) => {
      const handle = temporalClient.workflow.getHandle(workflowId);

      const showStatus = async () => {
        try {
          const description = await handle.describe();
          const progress = await handle.query('getProgress');

          console.clear();
          console.log(chalk.bold('\nWorkflow Status\n'));
          console.log(`ID:        ${workflowId}`);
          console.log(`Status:    ${chalk.yellow(description.status.name)}`);
          console.log(`Started:   ${description.startTime?.toISOString()}`);
          console.log(`Progress:  ${progress?.percent || 0}%`);
          console.log(`Step:      ${progress?.currentStep || 'N/A'}`);

          if (description.pendingActivities.length > 0) {
            console.log(chalk.bold('\nActive Tasks:'));
            description.pendingActivities.forEach((activity) => {
              console.log(`  - ${activity.activityType}`);
            });
          }
        } catch (error) {
          console.error(chalk.red('Error fetching status:'), error.message);
          if (!options.follow) process.exit(1);
        }
      };

      if (options.follow) {
        const interval = setInterval(showStatus, 2000);
        showStatus();

        // Wait for workflow completion
        try {
          await handle.result();
          clearInterval(interval);
          console.log(chalk.green('\n\nWorkflow completed!'));
        } catch (error) {
          clearInterval(interval);
          console.log(chalk.red('\n\nWorkflow failed!'));
        }
      } else {
        await showStatus();
      }
    });

  // Cancel workflow
  taskCmd
    .command('cancel <workflowId>')
    .description('Cancel a running workflow')
    .action(async (workflowId: string) => {
      const spinner = ora('Cancelling workflow...').start();

      try {
        const handle = temporalClient.workflow.getHandle(workflowId);
        await handle.cancel();
        spinner.succeed(chalk.green('Workflow cancelled'));
      } catch (error) {
        spinner.fail(chalk.red('Failed to cancel workflow'));
        console.error(error);
        process.exit(1);
      }
    });

  // List workflows
  taskCmd
    .command('list')
    .description('List workflows')
    .option('-s, --status <status>', 'Filter by status (RUNNING, COMPLETED, FAILED)')
    .option('-l, --limit <limit>', 'Maximum number of results', '20')
    .action(async (options) => {
      const spinner = ora('Fetching workflows...').start();

      try {
        const query = options.status
          ? `ExecutionStatus="${options.status}"`
          : undefined;

        const workflows = temporalClient.workflow.list({ query });
        const results = [];

        for await (const workflow of workflows) {
          results.push(workflow);
          if (results.length >= parseInt(options.limit)) break;
        }

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow('No workflows found'));
          return;
        }

        console.log(chalk.bold(`\nFound ${results.length} workflow(s):\n`));

        results.forEach((w) => {
          const statusColor =
            w.status.name === 'RUNNING' ? chalk.blue :
            w.status.name === 'COMPLETED' ? chalk.green :
            w.status.name === 'FAILED' ? chalk.red :
            chalk.gray;

          console.log(`${statusColor(w.status.name.padEnd(12))} ${w.workflowId}`);
          console.log(`  Type: ${w.workflowType}`);
          console.log(`  Started: ${w.startTime?.toISOString() || 'N/A'}`);
          console.log();
        });
      } catch (error) {
        spinner.fail(chalk.red('Failed to list workflows'));
        console.error(error);
        process.exit(1);
      }
    });

  // Get workflow logs
  taskCmd
    .command('logs <workflowId>')
    .description('Get workflow logs')
    .option('-f, --follow', 'Follow logs in real-time')
    .action(async (workflowId: string, options) => {
      const handle = temporalClient.workflow.getHandle(workflowId);

      const showLogs = async () => {
        try {
          const logs = await handle.query('getLogs');
          if (options.follow) console.clear();
          console.log(logs.join('\n'));
        } catch (error) {
          console.error(chalk.red('Error fetching logs:'), error.message);
        }
      };

      if (options.follow) {
        const interval = setInterval(showLogs, 1000);
        showLogs();

        try {
          await handle.result();
          clearInterval(interval);
        } catch {
          clearInterval(interval);
        }
      } else {
        await showLogs();
      }
    });

  return taskCmd;
}
```

### 3. Workflow Implementation Example

**Workflow: build.workflow.ts**
```typescript
import {
  proxyActivities,
  defineQuery,
  defineSignal,
  setHandler,
  condition,
  sleep,
} from '@temporalio/workflow';
import type * as activities from '../activities/build.activities';

// Proxy activities for invocation
const {
  cloneRepository,
  installDependencies,
  runLintCheck,
  runTests,
  buildProject,
  uploadArtifacts,
  notifyCompletion,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

// Workflow state
interface BuildState {
  currentStep: string;
  progress: number;
  logs: string[];
  status: 'running' | 'completed' | 'failed';
}

const state: BuildState = {
  currentStep: 'initializing',
  progress: 0,
  logs: [],
  status: 'running',
};

// Queries for observability
export const getProgress = defineQuery<BuildState['progress']>('getProgress');
export const getStatus = defineQuery<BuildState>('getStatus');
export const getLogs = defineQuery<string[]>('getLogs');

// Signals for interaction
export const updateProgress = defineSignal<[number]>('updateProgress');
export const cancelBuild = defineSignal('cancelBuild');

export interface BuildParams {
  projectId: string;
  branch: string;
  commitHash?: string;
  config?: {
    skipTests?: boolean;
    environment?: 'development' | 'staging' | 'production';
  };
}

export interface BuildResult {
  success: boolean;
  artifactUrl?: string;
  duration: number;
  errors?: string[];
}

export async function buildWorkflow(params: BuildParams): Promise<BuildResult> {
  const startTime = Date.now();
  let cancelled = false;

  // Setup query handlers
  setHandler(getProgress, () => state.progress);
  setHandler(getStatus, () => state);
  setHandler(getLogs, () => state.logs);

  // Setup signal handlers
  setHandler(cancelBuild, () => {
    cancelled = true;
    state.status = 'failed';
    state.logs.push('Build cancelled by user');
  });

  const addLog = (message: string) => {
    state.logs.push(`[${new Date().toISOString()}] ${message}`);
  };

  try {
    // Step 1: Clone repository
    state.currentStep = 'cloning';
    state.progress = 10;
    addLog(`Cloning repository for project ${params.projectId}`);

    const repoPath = await cloneRepository({
      projectId: params.projectId,
      branch: params.branch,
      commitHash: params.commitHash,
    });

    if (cancelled) throw new Error('Build cancelled');
    addLog(`Repository cloned to ${repoPath}`);

    // Step 2: Install dependencies
    state.currentStep = 'installing';
    state.progress = 30;
    addLog('Installing dependencies...');

    await installDependencies({ repoPath });

    if (cancelled) throw new Error('Build cancelled');
    addLog('Dependencies installed');

    // Step 3: Run lint check
    state.currentStep = 'linting';
    state.progress = 50;
    addLog('Running lint check...');

    const lintResult = await runLintCheck({ repoPath });

    if (!lintResult.passed) {
      addLog(`Lint check failed: ${lintResult.errors.join(', ')}`);
      throw new Error('Lint check failed');
    }
    addLog('Lint check passed');

    // Step 4: Run tests (if not skipped)
    if (!params.config?.skipTests) {
      state.currentStep = 'testing';
      state.progress = 65;
      addLog('Running tests...');

      const testResult = await runTests({ repoPath });

      if (!testResult.passed) {
        addLog(`Tests failed: ${testResult.summary}`);
        throw new Error('Tests failed');
      }
      addLog(`Tests passed: ${testResult.summary}`);
    } else {
      addLog('Tests skipped');
    }

    if (cancelled) throw new Error('Build cancelled');

    // Step 5: Build project
    state.currentStep = 'building';
    state.progress = 80;
    addLog('Building project...');

    const buildResult = await buildProject({
      repoPath,
      environment: params.config?.environment || 'development',
    });

    addLog(`Build completed: ${buildResult.artifactSize} bytes`);

    // Step 6: Upload artifacts
    state.currentStep = 'uploading';
    state.progress = 95;
    addLog('Uploading artifacts...');

    const uploadResult = await uploadArtifacts({
      artifactPath: buildResult.artifactPath,
      projectId: params.projectId,
    });

    addLog(`Artifacts uploaded to ${uploadResult.url}`);

    // Step 7: Notify completion
    state.currentStep = 'notifying';
    state.progress = 100;

    await notifyCompletion({
      projectId: params.projectId,
      success: true,
      artifactUrl: uploadResult.url,
    });

    state.status = 'completed';
    addLog('Build completed successfully');

    return {
      success: true,
      artifactUrl: uploadResult.url,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    state.status = 'failed';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    addLog(`Build failed: ${errorMessage}`);

    // Notify failure
    await notifyCompletion({
      projectId: params.projectId,
      success: false,
      error: errorMessage,
    }).catch((notifyError) => {
      addLog(`Failed to send notification: ${notifyError.message}`);
    });

    return {
      success: false,
      duration: Date.now() - startTime,
      errors: [errorMessage],
    };
  }
}
```

**Activities: build.activities.ts**
```typescript
import { Context } from '@temporalio/activity';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface CloneRepositoryInput {
  projectId: string;
  branch: string;
  commitHash?: string;
}

export async function cloneRepository(
  input: CloneRepositoryInput
): Promise<string> {
  const { projectId, branch, commitHash } = input;
  const repoPath = `/tmp/builds/${projectId}-${Date.now()}`;

  // Heartbeat for long-running operation
  const context = Context.current();
  const heartbeatInterval = setInterval(() => {
    context.heartbeat();
  }, 5000);

  try {
    await fs.mkdir(repoPath, { recursive: true });

    // Clone repository
    const cloneCommand = `git clone -b ${branch} https://github.com/org/${projectId}.git ${repoPath}`;
    await execAsync(cloneCommand);

    // Checkout specific commit if provided
    if (commitHash) {
      await execAsync(`git checkout ${commitHash}`, { cwd: repoPath });
    }

    return repoPath;
  } finally {
    clearInterval(heartbeatInterval);
  }
}

export interface InstallDependenciesInput {
  repoPath: string;
}

export async function installDependencies(
  input: InstallDependenciesInput
): Promise<void> {
  const { repoPath } = input;
  const context = Context.current();

  const heartbeatInterval = setInterval(() => {
    context.heartbeat();
  }, 5000);

  try {
    await execAsync('npm install', { cwd: repoPath });
  } finally {
    clearInterval(heartbeatInterval);
  }
}

export interface LintCheckInput {
  repoPath: string;
}

export interface LintCheckResult {
  passed: boolean;
  errors: string[];
}

export async function runLintCheck(
  input: LintCheckInput
): Promise<LintCheckResult> {
  const { repoPath } = input;

  try {
    await execAsync('npm run lint', { cwd: repoPath });
    return { passed: true, errors: [] };
  } catch (error: any) {
    return {
      passed: false,
      errors: [error.stderr || error.message],
    };
  }
}

export interface TestInput {
  repoPath: string;
}

export interface TestResult {
  passed: boolean;
  summary: string;
}

export async function runTests(input: TestInput): Promise<TestResult> {
  const { repoPath } = input;
  const context = Context.current();

  const heartbeatInterval = setInterval(() => {
    context.heartbeat();
  }, 10000);

  try {
    const { stdout } = await execAsync('npm test', { cwd: repoPath });
    return {
      passed: true,
      summary: stdout.split('\n').slice(-5).join('\n'),
    };
  } catch (error: any) {
    return {
      passed: false,
      summary: error.stderr || error.message,
    };
  } finally {
    clearInterval(heartbeatInterval);
  }
}

export interface BuildInput {
  repoPath: string;
  environment: 'development' | 'staging' | 'production';
}

export interface BuildResult {
  artifactPath: string;
  artifactSize: number;
}

export async function buildProject(input: BuildInput): Promise<BuildResult> {
  const { repoPath, environment } = input;
  const context = Context.current();

  const heartbeatInterval = setInterval(() => {
    context.heartbeat();
  }, 10000);

  try {
    process.env.NODE_ENV = environment;
    await execAsync('npm run build', { cwd: repoPath });

    const artifactPath = path.join(repoPath, 'dist');
    const stats = await fs.stat(artifactPath);

    return {
      artifactPath,
      artifactSize: stats.size,
    };
  } finally {
    clearInterval(heartbeatInterval);
  }
}

export interface UploadArtifactsInput {
  artifactPath: string;
  projectId: string;
}

export interface UploadArtifactsResult {
  url: string;
}

export async function uploadArtifacts(
  input: UploadArtifactsInput
): Promise<UploadArtifactsResult> {
  const { artifactPath, projectId } = input;

  // Simulate artifact upload to S3/CDN
  // In real implementation, use AWS SDK or similar
  const url = `https://cdn.example.com/artifacts/${projectId}/${Date.now()}/dist.tar.gz`;

  // Simulate upload time
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return { url };
}

export interface NotifyCompletionInput {
  projectId: string;
  success: boolean;
  artifactUrl?: string;
  error?: string;
}

export async function notifyCompletion(
  input: NotifyCompletionInput
): Promise<void> {
  const { projectId, success, artifactUrl, error } = input;

  // Send notification via email, webhook, etc.
  console.log('Notification sent:', { projectId, success, artifactUrl, error });

  // In real implementation:
  // - Send email via email service
  // - Send webhook to external service
  // - Update database
  // - Send WebSocket notification
}
```

### 4. Worker Configuration

**Worker Setup: workers/main.worker.ts**
```typescript
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from '../activities/build.activities';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

async function runWorker() {
  // Connect to Temporal server
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  // Create worker
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: 'build-tasks',
    workflowsPath: path.join(__dirname, '../workflows'),
    activities,
    // Worker configuration
    maxConcurrentActivityExecutions: 10,
    maxConcurrentWorkflowTaskExecutions: 100,
    maxCachedWorkflows: 100,
  });

  console.log('Worker started on task queue: build-tasks');
  console.log('Listening for workflows...');

  // Run the worker
  await worker.run();
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down worker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down worker...');
  process.exit(0);
});

runWorker().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
```

## Migration Strategy

### Phase 1: Infrastructure Setup (2-3 days)

**Tasks:**
1. Install Temporal Server (Docker Compose)
2. Configure PostgreSQL for Temporal persistence
3. Set up Temporal Web UI for visualization
4. Install Temporal TypeScript SDK

**Docker Compose Addition:**
```yaml
# docker-compose.yml
services:
  # ... existing services ...

  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "7233:7233"
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=postgres
      - POSTGRES_PWD=postgres
      - POSTGRES_SEEDS=postgres
      - DYNAMIC_CONFIG_FILE_PATH=config/dynamicconfig/development-sql.yaml
    depends_on:
      - postgres

  temporal-ui:
    image: temporalio/ui:latest
    ports:
      - "8080:8080"
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
      - TEMPORAL_CORS_ORIGINS=http://localhost:3000
    depends_on:
      - temporal
```

**Dependencies:**
```bash
npm install @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity
npm install -D @temporalio/testing
```

### Phase 2: Parallel Implementation (1 week)

**Strategy: Run BullMQ and Temporal side-by-side**

1. Implement Temporal client and worker infrastructure
2. Migrate one workflow type to Temporal (e.g., email workflow)
3. Test thoroughly with both systems running
4. Gradually migrate additional workflow types
5. Keep BullMQ as fallback

**Benefits:**
- Zero downtime migration
- Easy rollback if issues arise
- Team can learn Temporal incrementally
- Compare performance and reliability

### Phase 3: Feature Parity (1 week)

**Migrate all workflow types:**
1. Email workflows → Temporal
2. Processing workflows → Temporal
3. Build workflows → Temporal
4. Deploy workflows → Temporal

**Add missing features:**
- CLI integration for all workflow types
- UI components for workflow monitoring
- WebSocket notifications for workflow events
- Workflow history and audit logs

### Phase 4: Enhanced Features (1 week)

**Leverage Temporal-specific capabilities:**
1. Add workflow versioning for safe deployments
2. Implement complex workflows with conditionals
3. Add workflow queries for real-time state inspection
4. Implement workflow signals for interactive workflows
5. Add time-travel debugging for failed workflows

### Phase 5: Deprecate BullMQ (2-3 days)

**Tasks:**
1. Monitor Temporal performance for 1 week
2. Verify all features work correctly
3. Remove BullMQ dependencies
4. Clean up queue-related code
5. Update documentation

**Rollback Plan:**
- Keep BullMQ code in separate branch
- Document rollback procedure
- Keep Redis running (used for caching anyway)

## Comparison: BullMQ vs Temporal

| Feature | BullMQ | Temporal | Winner |
|---------|--------|----------|--------|
| **Setup Complexity** | Simple (Redis only) | Complex (Server + DB) | BullMQ |
| **Long-running Tasks** | Limited (< 30 min) | Excellent (days/weeks) | Temporal |
| **Observability** | Basic (via Bull Board) | Excellent (built-in) | Temporal |
| **State Persistence** | Redis (volatile) | PostgreSQL (durable) | Temporal |
| **Workflow Orchestration** | Manual implementation | Native support | Temporal |
| **Error Handling** | Basic retries | Advanced compensation | Temporal |
| **Debugging** | Limited | Time-travel replay | Temporal |
| **Type Safety** | Good | Excellent | Temporal |
| **Scalability** | Good | Excellent | Temporal |
| **Worker Management** | Manual | Automatic coordination | Temporal |
| **Query Support** | None | Native queries | Temporal |
| **Versioning** | None | Built-in | Temporal |
| **Memory Usage** | Low (< 50MB) | Medium (100-200MB) | BullMQ |
| **Learning Curve** | Easy | Moderate | BullMQ |
| **Community/Ecosystem** | Mature | Growing | BullMQ |
| **Hosting Cost** | Low | Medium-High | BullMQ |

**Recommendation**: Temporal provides significantly better capabilities for long-running tasks, observability, and workflow orchestration. The increased complexity and cost are justified for production systems with complex workflow requirements.

## Infrastructure Requirements

### Development Environment

**Services needed:**
- Temporal Server (Docker)
- PostgreSQL (for Temporal)
- Temporal Web UI (Docker)

**Resource requirements:**
- Temporal Server: ~200-300MB RAM
- PostgreSQL: ~100-200MB RAM
- Total additional: ~400-500MB RAM

### Production Environment

**Recommended setup:**

**Option 1: Temporal Cloud (Managed)**
- Zero infrastructure management
- Auto-scaling
- Built-in monitoring
- High availability
- Cost: ~$200-500/month (based on usage)

**Option 2: Self-hosted**
- 3x Temporal Server instances (HA)
- PostgreSQL with replication
- Temporal Web UI
- Load balancer
- Cost: ~3x medium instances = ~$300-600/month

**Worker Servers:**
- Scale based on workload
- 1 worker can handle ~100 concurrent workflows
- Typical setup: 2-5 worker instances
- Cost: ~$100-300/month

## Performance Expectations

### Workflow Latency

| Metric | BullMQ | Temporal | Notes |
|--------|--------|----------|-------|
| Job dispatch | <10ms | 20-50ms | Temporal slightly slower due to persistence |
| State query | N/A | <50ms | Temporal provides real-time queries |
| Job completion | <1ms | 10-20ms | Temporal records complete history |
| Retry overhead | ~100ms | ~50ms | Temporal's retry more efficient |

### Scalability

**BullMQ:**
- ~10,000 jobs/second (simple jobs)
- Limited by Redis throughput
- Difficult to scale beyond single Redis instance

**Temporal:**
- ~1,000-5,000 workflows/second (typical setup)
- Horizontally scalable
- Can handle millions of concurrent workflows
- Limited by database write throughput

### Resource Usage

**Per Worker:**
- BullMQ: ~30-50MB RAM, minimal CPU
- Temporal: ~100-200MB RAM, moderate CPU

**For 1000 concurrent long-running tasks:**
- BullMQ: ~500MB RAM (entire job state in Redis)
- Temporal: ~200-300MB RAM (state persisted to DB, only active data in memory)

## Testing Strategy

### Unit Tests

```typescript
// Example: Testing workflows with Temporal
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { buildWorkflow } from '../workflows/build.workflow';
import * as activities from '../activities/build.activities';

describe('Build Workflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('should complete build successfully', async () => {
    const { client, nativeConnection } = testEnv;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test',
      workflowsPath: require.resolve('../workflows'),
      activities,
    });

    await worker.runUntil(async () => {
      const result = await client.workflow.execute(buildWorkflow, {
        taskQueue: 'test',
        workflowId: 'test-build-1',
        args: [{
          projectId: 'test-project',
          branch: 'main',
        }],
      });

      expect(result.success).toBe(true);
      expect(result.artifactUrl).toBeDefined();
    });
  });

  it('should handle build failures', async () => {
    // Test failure scenarios
  });

  it('should support cancellation', async () => {
    // Test cancellation
  });
});
```

### Integration Tests

```typescript
describe('Temporal Integration', () => {
  it('should start workflow from UI', async () => {
    // Test tRPC endpoint
  });

  it('should query workflow status', async () => {
    // Test status query
  });

  it('should list workflows', async () => {
    // Test workflow listing
  });
});
```

## Monitoring and Observability

### Metrics to Track

**Workflow Metrics:**
- Total workflows started
- Workflows completed/failed/running
- Average workflow duration
- Workflow success rate

**Activity Metrics:**
- Activity execution count
- Activity duration
- Activity retry count
- Activity failure rate

**Worker Metrics:**
- Worker count
- Worker CPU/memory usage
- Task queue backlog
- Worker throughput

### Temporal Web UI

Access at `http://localhost:8080`:
- View all workflows
- Inspect workflow state and history
- See activity executions
- Debug failed workflows
- Replay workflows for testing

### Custom Monitoring

```typescript
// Add custom metrics to workflows
export async function buildWorkflow(params: BuildParams) {
  const startTime = Date.now();

  try {
    // ... workflow logic ...

    // Emit custom metrics
    await logMetric('workflow.build.success', 1, {
      projectId: params.projectId,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    await logMetric('workflow.build.failure', 1, {
      projectId: params.projectId,
      error: error.message,
    });
    throw error;
  }
}
```

## Security Considerations

### Authentication

```typescript
// Temporal client with authentication
import { Connection } from '@temporalio/client';

const connection = await Connection.connect({
  address: process.env.TEMPORAL_ADDRESS,
  tls: {
    clientCertPair: {
      crt: await fs.readFile('client.crt'),
      key: await fs.readFile('client.key'),
    },
  },
});
```

### Authorization

- Use Temporal Cloud's built-in authorization
- Implement custom authorization in tRPC endpoints
- Restrict workflow access based on user roles
- Audit workflow execution via Temporal's history

### Data Encryption

- Encrypt sensitive workflow parameters
- Use Temporal's data converter for encryption
- Encrypt data at rest in PostgreSQL
- Use TLS for all Temporal communication

## Cost Analysis

### Infrastructure Costs (Monthly)

**Self-hosted:**
- Temporal Server (3 instances): $300
- PostgreSQL (managed): $150
- Worker instances (3): $200
- Load balancer: $50
- **Total: ~$700/month**

**Temporal Cloud:**
- Base plan: $200
- Usage-based: $0.50-2.00 per 1000 workflow executions
- Typical usage (100K workflows/month): $300
- **Total: ~$500/month**

**Current BullMQ:**
- Redis (managed): $50
- Worker instances: $100
- **Total: ~$150/month**

**Cost Increase: 3-5x**

### Value Justification

**Benefits that justify cost:**
- Reduced development time (faster feature development)
- Fewer bugs (better error handling and retries)
- Reduced debugging time (time-travel debugging)
- Better observability (less time investigating issues)
- Improved reliability (durable execution)
- Better scalability (future-proof)

**Estimated savings:**
- Development time: 20% faster = ~$2000/month
- Operations time: 30% less debugging = ~$1000/month
- **Total savings: ~$3000/month**

**ROI: Positive within first month**

## Decision Checklist

### When to use Temporal

✅ **Use Temporal if:**
- You have long-running tasks (> 30 minutes)
- You need complex workflow orchestration
- You require strong observability and debugging
- You want built-in retry and compensation logic
- You need workflow versioning and safe deployments
- You expect to scale to thousands of concurrent workflows
- You want end-to-end type safety
- You need to query workflow state in real-time
- You have budget for additional infrastructure

❌ **Stick with BullMQ if:**
- All tasks complete in < 5 minutes
- Simple job queuing is sufficient
- Limited budget for infrastructure
- Small team (< 5 developers)
- Low task volume (< 1000/day)
- No need for complex workflows

### For This Stack: ✅ Temporal Recommended

**Reasons:**
1. ✅ Requirements explicitly mention long-running CLI tasks
2. ✅ Need for easy task state observation from UI/CLI
3. ✅ Multiple worker servers for task execution
4. ✅ Potential for complex build/deploy workflows
5. ✅ Type-safe stack benefits from Temporal's TypeScript SDK
6. ✅ Existing tRPC infrastructure integrates well
7. ✅ CLI-first approach aligns with Temporal's capabilities

## Implementation Timeline

| Phase | Duration | Effort | Risk |
|-------|----------|--------|------|
| **Phase 1: Infrastructure** | 2-3 days | 20 hours | Low |
| **Phase 2: Parallel Implementation** | 1 week | 40 hours | Medium |
| **Phase 3: Feature Parity** | 1 week | 40 hours | Medium |
| **Phase 4: Enhanced Features** | 1 week | 30 hours | Low |
| **Phase 5: Deprecate BullMQ** | 2-3 days | 10 hours | Low |
| **Total** | ~3.5 weeks | ~140 hours | Medium |

**Recommendation**: Allocate 4 weeks with buffer for testing and refinement.

## Success Metrics

### Quantitative Metrics

- ✅ Support for tasks running > 1 hour
- ✅ Workflow state queryable in < 100ms
- ✅ 99.9% workflow completion rate
- ✅ < 1% workflow retry rate
- ✅ Support for 1000+ concurrent workflows
- ✅ Worker auto-scaling functional
- ✅ Zero data loss during failures

### Qualitative Metrics

- ✅ Developers can easily debug failed workflows
- ✅ UI provides clear visibility into task progress
- ✅ CLI offers intuitive workflow management
- ✅ Operations team confident in system reliability
- ✅ Easy to add new workflow types

## Conclusion

Temporal provides a robust, production-ready solution for managing long-running tasks with excellent observability and workflow orchestration capabilities. The migration from BullMQ requires investment in infrastructure and development time but provides significant benefits:

**Key Benefits:**
1. ✅ Native support for long-running tasks (hours/days/weeks)
2. ✅ Built-in observability with real-time state queries
3. ✅ Scalable worker architecture with automatic coordination
4. ✅ Strong type safety with TypeScript SDK
5. ✅ Comprehensive debugging tools (time-travel replay)
6. ✅ Easy integration with existing tRPC and CLI infrastructure

**Recommended Next Steps:**
1. Review this document with the team
2. Set up Temporal in development environment (Phase 1)
3. Implement pilot workflow (email notifications)
4. Evaluate performance and developer experience
5. Proceed with full migration if satisfied
6. Consider Temporal Cloud for production

**Implementation Status**: 🔴 Not Started (0% complete)

---

*Document Version: 1.0*
*Last Updated: 2025-10-30*
*Status: Design/Planning Phase*
