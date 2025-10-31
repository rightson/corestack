/**
 * Temporal Workflow and Activity Types
 *
 * Shared type definitions for workflows and activities
 */

/**
 * Build Workflow Types
 */
export interface BuildWorkflowParams {
  projectId: string;
  branch: string;
  commitHash?: string;
  config?: {
    skipTests?: boolean;
    skipLint?: boolean;
    environment?: 'development' | 'staging' | 'production';
  };
}

export interface BuildWorkflowResult {
  success: boolean;
  artifactUrl?: string;
  duration: number;
  errors?: string[];
}

export interface BuildState {
  currentStep: string;
  progress: number;
  logs: string[];
  status: 'running' | 'completed' | 'failed';
}

/**
 * Deploy Workflow Types
 */
export interface DeployWorkflowParams {
  projectId: string;
  environment: 'staging' | 'production';
  artifactUrl: string;
  config?: {
    autoRollback?: boolean;
    healthCheckUrl?: string;
  };
}

export interface DeployWorkflowResult {
  success: boolean;
  deploymentUrl?: string;
  duration: number;
  errors?: string[];
}

/**
 * Email Workflow Types
 */
export interface EmailWorkflowParams {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
}

export interface EmailWorkflowResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Workflow Status
 */
export type WorkflowStatus =
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TERMINATED'
  | 'CONTINUED_AS_NEW'
  | 'TIMED_OUT';

/**
 * Workflow Description
 */
export interface WorkflowDescription {
  workflowId: string;
  runId: string;
  type: string;
  status: WorkflowStatus;
  startTime?: Date;
  closeTime?: Date;
  executionTime?: number;
}

/**
 * Activity Result Types
 */
export interface ActivityResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Progress Update
 */
export interface ProgressUpdate {
  percent: number;
  currentStep: string;
  message?: string;
}
