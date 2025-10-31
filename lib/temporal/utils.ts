/**
 * Temporal Utility Functions
 *
 * Helper functions for working with Temporal workflows and activities
 */

import type { WorkflowHandle } from '@temporalio/client';
import type { WorkflowStatus, WorkflowDescription } from './types';

/**
 * Format workflow ID
 */
export function formatWorkflowId(type: string, id: string): string {
  return `${type}-${id}-${Date.now()}`;
}

/**
 * Parse workflow ID
 */
export function parseWorkflowId(workflowId: string): {
  type: string;
  id: string;
  timestamp: number;
} | null {
  const parts = workflowId.split('-');
  if (parts.length < 3) {
    return null;
  }

  const timestamp = parseInt(parts[parts.length - 1], 10);
  const id = parts.slice(1, -1).join('-');
  const type = parts[0];

  if (isNaN(timestamp)) {
    return null;
  }

  return { type, id, timestamp };
}

/**
 * Get workflow status color for CLI
 */
export function getStatusColor(status: WorkflowStatus): string {
  switch (status) {
    case 'RUNNING':
      return 'blue';
    case 'COMPLETED':
      return 'green';
    case 'FAILED':
      return 'red';
    case 'CANCELLED':
      return 'yellow';
    case 'TERMINATED':
      return 'red';
    case 'TIMED_OUT':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get workflow status emoji
 */
export function getStatusEmoji(status: WorkflowStatus): string {
  switch (status) {
    case 'RUNNING':
      return '🔄';
    case 'COMPLETED':
      return '✅';
    case 'FAILED':
      return '❌';
    case 'CANCELLED':
      return '⚠️';
    case 'TERMINATED':
      return '🛑';
    case 'TIMED_OUT':
      return '⏱️';
    default:
      return '❓';
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Get workflow execution time
 */
export function getExecutionTime(startTime?: Date, closeTime?: Date): number {
  if (!startTime) {
    return 0;
  }

  const end = closeTime || new Date();
  return end.getTime() - startTime.getTime();
}

/**
 * Describe workflow with formatted information
 */
export async function describeWorkflow(
  handle: WorkflowHandle
): Promise<WorkflowDescription> {
  const description = await handle.describe();

  return {
    workflowId: handle.workflowId,
    runId: description.runId,
    type: description.type,
    status: description.status.name as WorkflowStatus,
    startTime: description.startTime,
    closeTime: description.closeTime,
    executionTime: getExecutionTime(description.startTime, description.closeTime),
  };
}

/**
 * Wait for workflow completion with timeout
 */
export async function waitForWorkflow<T>(
  handle: WorkflowHandle<T>,
  timeoutMs: number = 60000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Workflow timeout')), timeoutMs)
  );

  return Promise.race([handle.result(), timeoutPromise]);
}

/**
 * Cancel workflow safely
 */
export async function cancelWorkflow(
  handle: WorkflowHandle,
  reason?: string
): Promise<void> {
  try {
    await handle.cancel();
    console.log(`Workflow ${handle.workflowId} cancelled${reason ? `: ${reason}` : ''}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      console.log(`Workflow ${handle.workflowId} not found or already completed`);
    } else {
      throw error;
    }
  }
}

/**
 * Terminate workflow forcefully
 */
export async function terminateWorkflow(
  handle: WorkflowHandle,
  reason?: string
): Promise<void> {
  try {
    await handle.terminate(reason);
    console.log(`Workflow ${handle.workflowId} terminated${reason ? `: ${reason}` : ''}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      console.log(`Workflow ${handle.workflowId} not found or already completed`);
    } else {
      throw error;
    }
  }
}
