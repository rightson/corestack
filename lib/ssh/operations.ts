import { SSHConnectionPool } from './pool';
import type { SSHAccount, SSHOperationResult, FileInfo } from './types';

export class SSHFileOperations {
  private pool: SSHConnectionPool;

  constructor() {
    this.pool = SSHConnectionPool.getInstance();
  }

  private resolvePath(path: string, account: SSHAccount): string {
    if (account.basePath && !path.startsWith('/')) {
      return `${account.basePath}/${path}`;
    }
    if (account.basePath && !path.startsWith(account.basePath)) {
      return `${account.basePath}${path}`;
    }
    return path;
  }

  private async executeOperation<T>(
    account: SSHAccount,
    operation: (ssh: any) => Promise<T>
  ): Promise<SSHOperationResult> {
    const startTime = Date.now();
    let ssh;

    try {
      ssh = await this.pool.acquire(account);
      const data = await operation(ssh);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        message: error.message || 'Unknown error',
        stderr: error.stderr || '',
        code: error.code,
        executionTime,
      };
    } finally {
      if (ssh) {
        this.pool.release(account);
      }
    }
  }

  async copy(source: string, dest: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedSource = this.resolvePath(source, account);
    const resolvedDest = this.resolvePath(dest, account);

    return this.executeOperation(account, async (ssh) => {
      await ssh.execCommand(`cp -r "${resolvedSource}" "${resolvedDest}"`);
      return { source: resolvedSource, dest: resolvedDest };
    });
  }

  async move(source: string, dest: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedSource = this.resolvePath(source, account);
    const resolvedDest = this.resolvePath(dest, account);

    return this.executeOperation(account, async (ssh) => {
      await ssh.execCommand(`mv "${resolvedSource}" "${resolvedDest}"`);
      return { source: resolvedSource, dest: resolvedDest };
    });
  }

  async remove(path: string, recursive: boolean, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedPath = this.resolvePath(path, account);
    const flags = recursive ? '-rf' : '-f';

    return this.executeOperation(account, async (ssh) => {
      await ssh.execCommand(`rm ${flags} "${resolvedPath}"`);
      return { path: resolvedPath };
    });
  }

  async mkdir(path: string, recursive: boolean, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedPath = this.resolvePath(path, account);
    const flags = recursive ? '-p' : '';

    return this.executeOperation(account, async (ssh) => {
      await ssh.execCommand(`mkdir ${flags} "${resolvedPath}"`);
      return { path: resolvedPath };
    });
  }

  async symlink(target: string, linkPath: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedTarget = this.resolvePath(target, account);
    const resolvedLink = this.resolvePath(linkPath, account);

    return this.executeOperation(account, async (ssh) => {
      await ssh.execCommand(`ln -sf "${resolvedTarget}" "${resolvedLink}"`);
      return { target: resolvedTarget, linkPath: resolvedLink };
    });
  }

  async hardlink(target: string, linkPath: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedTarget = this.resolvePath(target, account);
    const resolvedLink = this.resolvePath(linkPath, account);

    return this.executeOperation(account, async (ssh) => {
      await ssh.execCommand(`ln -f "${resolvedTarget}" "${resolvedLink}"`);
      return { target: resolvedTarget, linkPath: resolvedLink };
    });
  }

  async touch(path: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedPath = this.resolvePath(path, account);

    return this.executeOperation(account, async (ssh) => {
      await ssh.execCommand(`touch "${resolvedPath}"`);
      return { path: resolvedPath };
    });
  }

  async chmod(path: string, mode: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedPath = this.resolvePath(path, account);

    return this.executeOperation(account, async (ssh) => {
      await ssh.execCommand(`chmod ${mode} "${resolvedPath}"`);
      return { path: resolvedPath, mode };
    });
  }

  async chown(path: string, owner: string, group: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedPath = this.resolvePath(path, account);
    const ownerGroup = group ? `${owner}:${group}` : owner;

    return this.executeOperation(account, async (ssh) => {
      await ssh.execCommand(`chown ${ownerGroup} "${resolvedPath}"`);
      return { path: resolvedPath, owner, group };
    });
  }

  async readFile(path: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedPath = this.resolvePath(path, account);

    return this.executeOperation(account, async (ssh) => {
      const result = await ssh.execCommand(`cat "${resolvedPath}"`);
      return { content: result.stdout, path: resolvedPath };
    });
  }

  async writeFile(path: string, content: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedPath = this.resolvePath(path, account);

    return this.executeOperation(account, async (ssh) => {
      // Escape single quotes in content
      const escapedContent = content.replace(/'/g, "'\\''");
      await ssh.execCommand(`echo '${escapedContent}' > "${resolvedPath}"`);
      return { path: resolvedPath };
    });
  }

  async appendFile(path: string, content: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedPath = this.resolvePath(path, account);

    return this.executeOperation(account, async (ssh) => {
      // Escape single quotes in content
      const escapedContent = content.replace(/'/g, "'\\''");
      await ssh.execCommand(`echo '${escapedContent}' >> "${resolvedPath}"`);
      return { path: resolvedPath };
    });
  }

  async exists(path: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedPath = this.resolvePath(path, account);

    return this.executeOperation(account, async (ssh) => {
      const result = await ssh.execCommand(`test -e "${resolvedPath}" && echo "exists" || echo "not found"`);
      const exists = result.stdout.trim() === 'exists';
      return { path: resolvedPath, exists };
    });
  }

  async listDir(path: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedPath = this.resolvePath(path, account);

    return this.executeOperation(account, async (ssh) => {
      const result = await ssh.execCommand(`ls -la "${resolvedPath}"`);
      const files = this.parseListDir(result.stdout);
      return { path: resolvedPath, files };
    });
  }

  async stat(path: string, account: SSHAccount): Promise<SSHOperationResult> {
    const resolvedPath = this.resolvePath(path, account);

    return this.executeOperation(account, async (ssh) => {
      const result = await ssh.execCommand(`stat -c '%n|%s|%f|%u|%g|%Y|%X' "${resolvedPath}"`);
      const info = this.parseStat(result.stdout);
      return { path: resolvedPath, info };
    });
  }

  private parseListDir(output: string): string[] {
    const lines = output.split('\n').slice(1); // Skip total line
    return lines
      .filter(line => line.trim())
      .map(line => {
        const parts = line.trim().split(/\s+/);
        return parts[parts.length - 1];
      })
      .filter(name => name !== '.' && name !== '..');
  }

  private parseStat(output: string): Partial<FileInfo> {
    const parts = output.trim().split('|');
    if (parts.length < 7) {
      return {};
    }

    return {
      name: parts[0],
      size: parseInt(parts[1], 10),
      mode: parseInt(parts[2], 16),
      owner: parseInt(parts[3], 10),
      group: parseInt(parts[4], 10),
      modifiedAt: new Date(parseInt(parts[5], 10) * 1000),
      accessedAt: new Date(parseInt(parts[6], 10) * 1000),
    };
  }
}
