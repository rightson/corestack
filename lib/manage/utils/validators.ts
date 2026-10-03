import { hasCommand, getCommandVersion, parseVersion, compareVersions } from './platform.js';

export interface PrerequisiteCheck {
  name: string;
  required: boolean;
  check: () => Promise<CheckResult>;
}

export interface CheckResult {
  passed: boolean;
  version?: string;
  message?: string;
  installInstructions?: string;
}

export async function checkNodeVersion(minVersion = '18.0.0'): Promise<CheckResult> {
  if (!hasCommand('node')) {
    return {
      passed: false,
      message: 'Node.js not found',
      installInstructions: 'Install from https://nodejs.org/ or use nvm',
    };
  }

  const versionOutput = getCommandVersion('node', '--version');
  if (!versionOutput) {
    return { passed: false, message: 'Could not determine Node.js version' };
  }

  const currentVersion = parseVersion(versionOutput);
  const requiredVersion = parseVersion(minVersion);

  if (!currentVersion || !requiredVersion) {
    return { passed: false, message: 'Could not parse version numbers' };
  }

  const comparison = compareVersions(currentVersion, requiredVersion);

  return {
    passed: comparison >= 0,
    version: versionOutput,
    message: comparison < 0 ? `Node.js ${versionOutput} found, but >= ${minVersion} required` : undefined,
  };
}

export async function checkNpmVersion(minVersion = '9.0.0'): Promise<CheckResult> {
  if (!hasCommand('npm')) {
    return {
      passed: false,
      message: 'npm not found',
      installInstructions: 'npm should be installed with Node.js',
    };
  }

  const versionOutput = getCommandVersion('npm', '--version');
  if (!versionOutput) {
    return { passed: false, message: 'Could not determine npm version' };
  }

  const currentVersion = parseVersion(versionOutput);
  const requiredVersion = parseVersion(minVersion);

  if (!currentVersion || !requiredVersion) {
    return { passed: true, version: versionOutput }; // Be lenient with npm
  }

  const comparison = compareVersions(currentVersion, requiredVersion);

  return {
    passed: true, // Don't fail on npm version
    version: versionOutput,
    message: comparison < 0 ? `Consider upgrading npm: npm install -g npm@latest` : undefined,
  };
}

export async function checkPostgreSQL(_minVersion = '14.0.0'): Promise<CheckResult> {
  if (!hasCommand('psql')) {
    return {
      passed: false,
      message: 'PostgreSQL (psql) not found',
      installInstructions: 'Install PostgreSQL from https://www.postgresql.org/download/',
    };
  }

  const versionOutput = getCommandVersion('psql', '--version');
  if (!versionOutput) {
    return { passed: true, version: 'unknown' };
  }

  return { passed: true, version: versionOutput };
}

export async function checkRedis(_minVersion = '6.0.0'): Promise<CheckResult> {
  if (!hasCommand('redis-cli')) {
    return {
      passed: false,
      message: 'Redis (redis-cli) not found',
      installInstructions: 'Install Redis from https://redis.io/download',
    };
  }

  const versionOutput = getCommandVersion('redis-cli', '--version');
  if (!versionOutput) {
    return { passed: true, version: 'unknown' };
  }

  return { passed: true, version: versionOutput };
}

export async function checkDocker(): Promise<CheckResult> {
  if (!hasCommand('docker')) {
    return {
      passed: false,
      message: 'Docker not found',
      installInstructions: 'Install Docker from https://docs.docker.com/get-docker/',
    };
  }

  const versionOutput = getCommandVersion('docker', '--version');
  return { passed: true, version: versionOutput || 'unknown' };
}

export async function checkDockerCompose(): Promise<CheckResult> {
  // Check for docker-compose or docker compose
  const hasDockerCompose = hasCommand('docker-compose');
  const hasDockerComposePlugin = hasCommand('docker') && getCommandVersion('docker', 'compose version') !== null;

  if (!hasDockerCompose && !hasDockerComposePlugin) {
    return {
      passed: false,
      message: 'Docker Compose not found',
      installInstructions: 'Install Docker Compose from https://docs.docker.com/compose/install/',
    };
  }

  const versionOutput = hasDockerCompose
    ? getCommandVersion('docker-compose', '--version')
    : getCommandVersion('docker', 'compose version');

  return { passed: true, version: versionOutput || 'unknown' };
}

export async function checkTmux(): Promise<CheckResult> {
  if (!hasCommand('tmux')) {
    return {
      passed: false,
      message: 'tmux not found (required for dev command)',
      installInstructions: 'Install tmux: brew install tmux (macOS) or apt install tmux (Ubuntu)',
    };
  }

  const versionOutput = getCommandVersion('tmux', '-V');
  return { passed: true, version: versionOutput || 'unknown' };
}

export async function checkGit(): Promise<CheckResult> {
  if (!hasCommand('git')) {
    return {
      passed: false,
      message: 'Git not found',
      installInstructions: 'Install Git from https://git-scm.com/downloads',
    };
  }

  const versionOutput = getCommandVersion('git', '--version');
  return { passed: true, version: versionOutput || 'unknown' };
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3 || username.length > 63) {
    return { valid: false, error: 'Username must be 3-63 characters' };
  }

  if (!/^[a-zA-Z]/.test(username)) {
    return { valid: false, error: 'Username must start with a letter' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }

  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push(`Minimum 12 characters (current: ${password.length})`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Must include uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Must include lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Must include digit');
  }

  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Must include special character');
  }

  // Check against common passwords
  const commonPasswords = ['password', 'admin', '123456', 'qwerty'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password is too common');
  }

  return { valid: errors.length === 0, errors };
}
