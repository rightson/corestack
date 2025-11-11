import { execSync, spawn } from 'child_process';
import type { SpawnOptions } from 'child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export function execCommand(
  command: string,
  options: { silent?: boolean; cwd?: string } = {}
): ExecResult {
  try {
    const stdout = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: options.cwd,
    });

    return {
      stdout: typeof stdout === 'string' ? stdout : '',
      stderr: '',
      exitCode: 0,
      success: true,
    };
  } catch (error: unknown) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      exitCode: error.status || 1,
      success: false,
    };
  }
}

export function execCommandQuiet(command: string, cwd?: string): ExecResult {
  try {
    const stdout = execSync(command, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
    });

    return {
      stdout: stdout.trim(),
      stderr: '',
      exitCode: 0,
      success: true,
    };
  } catch (error: unknown) {
    return {
      stdout: error.stdout?.toString().trim() || '',
      stderr: error.stderr?.toString().trim() || '',
      exitCode: error.status || 1,
      success: false,
    };
  }
}

export async function spawnCommand(
  command: string,
  args: string[],
  options?: SpawnOptions
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, options);

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
        success: code === 0,
      });
    });

    child.on('error', (error) => {
      resolve({
        stdout,
        stderr: (error as Error).message,
        exitCode: 1,
        success: false,
      });
    });
  });
}

export function isPortInUse(port: number): boolean {
  try {
    execSync(`lsof -ti:${port}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
