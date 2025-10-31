/**
 * Temporal tRPC Router
 *
 * API endpoints for interacting with Temporal workflows
 */

import { z } from 'zod';
import { router, publicProcedure } from '@/lib/trpc/trpc';
import { getTemporalClient } from '@/lib/temporal/client';
import { temporalConfig } from '@/lib/temporal/config';
import { formatWorkflowId, describeWorkflow } from '@/lib/temporal/utils';
import { buildWorkflow } from '@/server/temporal/workflows/build.workflow';
import { TRPCError } from '@trpc/server';

export const temporalRouter = router({
  /**
   * Start a new build workflow
   */
  startBuild: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        branch: z.string().default('main'),
        commitHash: z.string().optional(),
        config: z
          .object({
            skipTests: z.boolean().optional(),
            skipLint: z.boolean().optional(),
            environment: z.enum(['development', 'staging', 'production']).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const client = await getTemporalClient();
        const workflowId = formatWorkflowId('build', input.projectId);

        const handle = await client.workflow.start(buildWorkflow, {
          taskQueue: temporalConfig.taskQueues.build,
          workflowId,
          args: [input],
        });

        return {
          workflowId: handle.workflowId,
          runId: handle.firstExecutionRunId,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error ? error.message : 'Failed to start build workflow',
        });
      }
    }),

  /**
   * Get workflow status and progress
   */
  getWorkflowStatus: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ input }) => {
      try {
        const client = await getTemporalClient();
        const handle = client.workflow.getHandle(input.workflowId);

        const description = await describeWorkflow(handle);

        // Try to get progress and logs via queries
        let progress = 0;
        let logs: string[] = [];
        let currentStep = 'unknown';

        try {
          progress = await handle.query('getProgress');
          logs = await handle.query('getLogs');
          const status = await handle.query('getStatus');
          currentStep = status.currentStep;
        } catch (error) {
          // Queries may fail if workflow is not running
          console.warn('Failed to query workflow:', error);
        }

        return {
          workflowId: description.workflowId,
          runId: description.runId,
          status: description.status,
          startTime: description.startTime,
          closeTime: description.closeTime,
          executionTime: description.executionTime,
          progress,
          logs,
          currentStep,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            error instanceof Error ? error.message : 'Workflow not found',
        });
      }
    }),

  /**
   * Cancel a running workflow
   */
  cancelWorkflow: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const client = await getTemporalClient();
        const handle = client.workflow.getHandle(input.workflowId);
        await handle.cancel();
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error ? error.message : 'Failed to cancel workflow',
        });
      }
    }),

  /**
   * Terminate a workflow forcefully
   */
  terminateWorkflow: publicProcedure
    .input(
      z.object({
        workflowId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const client = await getTemporalClient();
        const handle = client.workflow.getHandle(input.workflowId);
        await handle.terminate(input.reason);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error ? error.message : 'Failed to terminate workflow',
        });
      }
    }),

  /**
   * List workflows with optional filtering
   */
  listWorkflows: publicProcedure
    .input(
      z.object({
        status: z
          .enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TERMINATED', 'TIMED_OUT'])
          .optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      try {
        const client = await getTemporalClient();

        const query = input.status
          ? `ExecutionStatus="${input.status}"`
          : undefined;

        const workflows = client.workflow.list({ query });
        const results = [];

        for await (const workflow of workflows) {
          results.push({
            workflowId: workflow.workflowId,
            runId: workflow.runId,
            type: workflow.workflowType,
            status: workflow.status.name,
            startTime: workflow.startTime,
            closeTime: workflow.closeTime,
          });

          if (results.length >= input.limit) {
            break;
          }
        }

        return { workflows: results };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error ? error.message : 'Failed to list workflows',
        });
      }
    }),

  /**
   * Get workflow result
   */
  getWorkflowResult: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ input }) => {
      try {
        const client = await getTemporalClient();
        const handle = client.workflow.getHandle(input.workflowId);

        const description = await handle.describe();

        // Only try to get result if workflow is completed
        if (description.status.name !== 'COMPLETED') {
          return {
            status: description.status.name,
            result: null,
          };
        }

        const result = await handle.result();

        return {
          status: description.status.name,
          result,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            error instanceof Error ? error.message : 'Workflow not found',
        });
      }
    }),
});
