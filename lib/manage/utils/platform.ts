import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

export type Platform = 'darwin' | 'linux' | 'win32';
export type Distribution = 'macos' | 'ubuntu' | 'debian' | 'rhel' | 'centos' | 'fedora' | 'unknown';
export type PackageManager = 'brew' | 'apt' | 'yum' | 'dnf' | 'unknown';

export interface PlatformInfo {
  platform: Platform;
  distribution: Distribution;
  version: string;
  architecture: string;
  packageManager: PackageManager;
}

export async function detectPlatform(): Promise<PlatformInfo> {
  const platform = process.platform as Platform;
  const architecture = process.arch;

  let distribution: Distribution = 'unknown';
  let version = '';
  let packageManager: PackageManager = 'unknown';

  if (platform === 'darwin') {
    distribution = 'macos';
    version = getMacOSVersion();
    packageManager = hasCommand('brew') ? 'brew' : 'unknown';
  } else if (platform === 'linux') {
    const osRelease = readOSRelease();
    distribution = detectLinuxDistribution(osRelease);
    version = osRelease.VERSION_ID || osRelease.VERSION || '';
    packageManager = detectPackageManager(distribution);
  }

  return { platform, distribution, version, architecture, packageManager };
}

function getMacOSVersion(): string {
  try {
    const version = execSync('sw_vers -productVersion', { encoding: 'utf-8' }).trim();
    return version;
  } catch {
    return 'unknown';
  }
}

function readOSRelease(): Record<string, string> {
  const osReleasePaths = ['/etc/os-release', '/usr/lib/os-release'];

  for (const path of osReleasePaths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        const result: Record<string, string> = {};

        content.split('\n').forEach(line => {
          const match = line.match(/^([A-Z_]+)=(.*)$/);
          if (match) {
            result[match[1]] = match[2].replace(/^["']|["']$/g, '');
          }
        });

        return result;
      } catch {
        continue;
      }
    }
  }

  return {};
}

function detectLinuxDistribution(osRelease: Record<string, string>): Distribution {
  const id = (osRelease.ID || '').toLowerCase();
  const idLike = (osRelease.ID_LIKE || '').toLowerCase();

  if (id === 'ubuntu') return 'ubuntu';
  if (id === 'debian') return 'debian';
  if (id === 'rhel' || id === 'redhat') return 'rhel';
  if (id === 'centos') return 'centos';
  if (id === 'fedora') return 'fedora';

  // Check ID_LIKE for derivatives
  if (idLike.includes('ubuntu') || idLike.includes('debian')) return 'debian';
  if (idLike.includes('rhel') || idLike.includes('fedora')) return 'rhel';

  return 'unknown';
}

function detectPackageManager(distribution: Distribution): PackageManager {
  switch (distribution) {
    case 'ubuntu':
    case 'debian':
      return 'apt';
    case 'rhel':
    case 'centos':
    case 'fedora':
      return hasCommand('dnf') ? 'dnf' : 'yum';
    default:
      return 'unknown';
  }
}

export function hasCommand(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function getCommandVersion(command: string, versionFlag = '--version'): string | null {
  try {
    const output = execSync(`${command} ${versionFlag}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return output.trim();
  } catch {
    return null;
  }
}

export function parseVersion(versionString: string): { major: number; minor: number; patch: number } | null {
  const match = versionString.match(/(\d+)\.(\d+)\.(\d+)/);
  if (match) {
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
    };
  }
  return null;
}

export function compareVersions(
  version1: { major: number; minor: number; patch: number },
  version2: { major: number; minor: number; patch: number }
): number {
  if (version1.major !== version2.major) return version1.major - version2.major;
  if (version1.minor !== version2.minor) return version1.minor - version2.minor;
  return version1.patch - version2.patch;
}
