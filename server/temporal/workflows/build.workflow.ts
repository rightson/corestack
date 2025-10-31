/**
 * Build Workflow
 *
 * Temporal workflow for building projects with comprehensive error handling,
 * progress tracking, and cancellation support.
 */

import {
  proxyActivities,
  defineQuery,
  defineSignal,
  setHandler,
  ApplicationFailure,
} from '@temporalio/workflow';
import type * as activities from '../activities/build.activities';
import type {
  BuildWorkflowParams,
  BuildWorkflowResult,
  BuildState,
} from '@/lib/temporal/types';

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
const state: BuildState = {
  currentStep: 'initializing',
  progress: 0,
  logs: [],
  status: 'running',
};

// Queries for observability
export const getProgress = defineQuery<number>('getProgress');
export const getStatus = defineQuery<BuildState>('getStatus');
export const getLogs = defineQuery<string[]>('getLogs');

// Signals for interaction
export const cancelBuild = defineSignal('cancelBuild');

/**
 * Build Workflow
 *
 * Orchestrates the complete build process including:
 * - Repository cloning
 * - Dependency installation
 * - Linting
 * - Testing
 * - Building
 * - Artifact upload
 * - Notifications
 */
export async function buildWorkflow(
  params: BuildWorkflowParams
): Promise<BuildWorkflowResult> {
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
    const timestamp = new Date().toISOString();
    state.logs.push(`[${timestamp}] ${message}`);
  };

  try {
    // Step 1: Clone repository
    state.currentStep = 'cloning';
    state.progress = 10;
    addLog(`Cloning repository for project ${params.projectId}`);
    addLog(`Branch: ${params.branch}${params.commitHash ? ` (commit: ${params.commitHash})` : ''}`);

    const repoPath = await cloneRepository({
      projectId: params.projectId,
      branch: params.branch,
      commitHash: params.commitHash,
    });

    if (cancelled) {
      throw ApplicationFailure.create({ message: 'Build cancelled by user' });
    }
    addLog(`Repository cloned to ${repoPath}`);

    // Step 2: Install dependencies
    state.currentStep = 'installing';
    state.progress = 30;
    addLog('Installing dependencies...');

    await installDependencies({ repoPath });

    if (cancelled) {
      throw ApplicationFailure.create({ message: 'Build cancelled by user' });
    }
    addLog('Dependencies installed successfully');

    // Step 3: Run lint check (if not skipped)
    if (!params.config?.skipLint) {
      state.currentStep = 'linting';
      state.progress = 50;
      addLog('Running lint check...');

      const lintResult = await runLintCheck({ repoPath });

      if (!lintResult.passed) {
        addLog(`Lint check failed: ${lintResult.errors.join(', ')}`);
        throw ApplicationFailure.create({
          message: 'Lint check failed',
          details: [lintResult.errors],
        });
      }
      addLog('Lint check passed');
    } else {
      addLog('Lint check skipped');
      state.progress = 50;
    }

    // Step 4: Run tests (if not skipped)
    if (!params.config?.skipTests) {
      state.currentStep = 'testing';
      state.progress = 65;
      addLog('Running tests...');

      const testResult = await runTests({ repoPath });

      if (!testResult.passed) {
        addLog(`Tests failed: ${testResult.summary}`);
        throw ApplicationFailure.create({
          message: 'Tests failed',
          details: [testResult.summary],
        });
      }
      addLog(`Tests passed: ${testResult.summary}`);
    } else {
      addLog('Tests skipped');
      state.progress = 65;
    }

    if (cancelled) {
      throw ApplicationFailure.create({ message: 'Build cancelled by user' });
    }

    // Step 5: Build project
    state.currentStep = 'building';
    state.progress = 80;
    addLog('Building project...');
    addLog(`Environment: ${params.config?.environment || 'development'}`);

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
      const notifyErrorMessage =
        notifyError instanceof Error ? notifyError.message : 'Unknown error';
      addLog(`Failed to send notification: ${notifyErrorMessage}`);
    });

    return {
      success: false,
      duration: Date.now() - startTime,
      errors: [errorMessage],
    };
  }
}
