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
    const err = error as { stdout?: Buffer; stderr?: Buffer; status?: number };
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || '',
      exitCode: err.status || 1,
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
    const err = error as { stdout?: Buffer; stderr?: Buffer; status?: number };
    return {
      stdout: err.stdout?.toString().trim() || '',
      stderr: err.stderr?.toString().trim() || '',
      exitCode: err.status || 1,
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
    const child = spawn(command, args, options || {});

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code: number | null) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
        success: code === 0,
      });
    });

    child.on('error', (error: Error) => {
      resolve({
        stdout,
        stderr: error.message,
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
