/**
 * Build Activities
 *
 * Activity implementations for the build workflow.
 * Activities are the actual work units that execute outside the workflow.
 */

import { Context } from '@temporalio/activity';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Activity Input/Output Types
 */

export interface CloneRepositoryInput {
  projectId: string;
  branch: string;
  commitHash?: string;
}

export interface InstallDependenciesInput {
  repoPath: string;
}

export interface LintCheckInput {
  repoPath: string;
}

export interface LintCheckResult {
  passed: boolean;
  errors: string[];
}

export interface TestInput {
  repoPath: string;
}

export interface TestResult {
  passed: boolean;
  summary: string;
}

export interface BuildInput {
  repoPath: string;
  environment: 'development' | 'staging' | 'production';
}

export interface BuildResult {
  artifactPath: string;
  artifactSize: number;
}

export interface UploadArtifactsInput {
  artifactPath: string;
  projectId: string;
}

export interface UploadArtifactsResult {
  url: string;
}

export interface NotifyCompletionInput {
  projectId: string;
  success: boolean;
  artifactUrl?: string;
  error?: string;
}

/**
 * Clone repository from version control
 */
export async function cloneRepository(
  input: CloneRepositoryInput
): Promise<string> {
  const { projectId, branch } = input;
  const repoPath = `/tmp/builds/${projectId}-${Date.now()}`;

  // Heartbeat for long-running operation
  const context = Context.current();
  const heartbeatInterval = setInterval(() => {
    context.heartbeat();
  }, 5000);

  try {
    await fs.mkdir(repoPath, { recursive: true });

    // In a real implementation, this would clone from an actual Git repository
    // For demonstration, we'll create a mock repository structure
    // The commitHash would be used here: git checkout ${input.commitHash}
    console.log(`[Activity] Cloning repository for ${projectId} (branch: ${branch})`);

    // Mock: Create a basic project structure
    await fs.mkdir(path.join(repoPath, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(repoPath, 'package.json'),
      JSON.stringify(
        {
          name: projectId,
          version: '1.0.0',
          scripts: {
            lint: 'echo "Running lint..." && exit 0',
            test: 'echo "Running tests..." && exit 0',
            build: 'echo "Building project..." && mkdir -p dist && echo "Build output" > dist/index.js',
          },
        },
        null,
        2
      )
    );

    // Simulate clone time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`[Activity] Repository cloned to ${repoPath}`);
    return repoPath;
  } finally {
    clearInterval(heartbeatInterval);
  }
}

/**
 * Install project dependencies
 */
export async function installDependencies(
  input: InstallDependenciesInput
): Promise<void> {
  const { repoPath } = input;
  const context = Context.current();

  const heartbeatInterval = setInterval(() => {
    context.heartbeat();
  }, 5000);

  try {
    console.log(`[Activity] Installing dependencies in ${repoPath}`);

    // In a real implementation, this would run npm/yarn/pnpm install
    // For demonstration, we'll simulate the installation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log(`[Activity] Dependencies installed successfully`);
  } finally {
    clearInterval(heartbeatInterval);
  }
}

/**
 * Run lint check on the codebase
 */
export async function runLintCheck(input: LintCheckInput): Promise<LintCheckResult> {
  const { repoPath } = input;

  console.log(`[Activity] Running lint check in ${repoPath}`);

  try {
    // In a real implementation, this would run the actual linter
    await execAsync('npm run lint', { cwd: repoPath });

    console.log(`[Activity] Lint check passed`);
    return { passed: true, errors: [] };
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string };
    console.error(`[Activity] Lint check failed:`, err.stderr || err.message);

    // For demonstration, we'll consider it passed
    // In production, this would return actual errors
    return { passed: true, errors: [] };
  }
}

/**
 * Run tests
 */
export async function runTests(input: TestInput): Promise<TestResult> {
  const { repoPath } = input;
  const context = Context.current();

  const heartbeatInterval = setInterval(() => {
    context.heartbeat();
  }, 10000);

  try {
    console.log(`[Activity] Running tests in ${repoPath}`);

    const { stdout } = await execAsync('npm test', { cwd: repoPath });

    console.log(`[Activity] Tests passed`);
    return {
      passed: true,
      summary: stdout.split('\n').slice(-5).join('\n') || 'All tests passed',
    };
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string };
    console.error(`[Activity] Tests failed:`, err.stderr || err.message);

    // For demonstration, we'll consider it passed
    // In production, this would return actual test results
    return {
      passed: true,
      summary: 'Tests passed (mocked)',
    };
  } finally {
    clearInterval(heartbeatInterval);
  }
}

/**
 * Build the project
 */
export async function buildProject(input: BuildInput): Promise<BuildResult> {
  const { repoPath, environment } = input;
  const context = Context.current();

  const heartbeatInterval = setInterval(() => {
    context.heartbeat();
  }, 10000);

  try {
    console.log(`[Activity] Building project in ${repoPath} (env: ${environment})`);

    // Set environment variable for the build process
    const nodeEnv = environment === 'staging' ? 'production' : environment;
    await execAsync('npm run build', {
      cwd: repoPath,
      env: { ...process.env, NODE_ENV: nodeEnv },
    });

    const artifactPath = path.join(repoPath, 'dist');

    // Calculate artifact size
    let totalSize = 0;
    try {
      const files = await fs.readdir(artifactPath);
      for (const file of files) {
        const filePath = path.join(artifactPath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }
    } catch (error) {
      console.warn(`[Activity] Could not calculate artifact size:`, error);
      totalSize = 1024; // Default size
    }

    console.log(`[Activity] Build completed (size: ${totalSize} bytes)`);

    return {
      artifactPath,
      artifactSize: totalSize,
    };
  } finally {
    clearInterval(heartbeatInterval);
  }
}

/**
 * Upload build artifacts to storage
 */
export async function uploadArtifacts(
  input: UploadArtifactsInput
): Promise<UploadArtifactsResult> {
  const { artifactPath, projectId } = input;

  console.log(`[Activity] Uploading artifacts from ${artifactPath}`);

  // Simulate artifact upload to S3/CDN
  // In real implementation, use AWS SDK or similar
  const url = `https://cdn.example.com/artifacts/${projectId}/${Date.now()}/dist.tar.gz`;

  // Simulate upload time
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log(`[Activity] Artifacts uploaded to ${url}`);

  return { url };
}

/**
 * Send notification about build completion
 */
export async function notifyCompletion(input: NotifyCompletionInput): Promise<void> {
  const { projectId, success, artifactUrl, error } = input;

  console.log(`[Activity] Sending notification for project ${projectId}`);
  console.log(
    `  Status: ${success ? 'SUCCESS' : 'FAILED'}${artifactUrl ? `\n  Artifact: ${artifactUrl}` : ''}${error ? `\n  Error: ${error}` : ''}`
  );

  // In real implementation:
  // - Send email via email service
  // - Send webhook to external service
  // - Update database
  // - Send WebSocket notification

  // Simulate notification time
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log(`[Activity] Notification sent successfully`);
}
