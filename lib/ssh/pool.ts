import { NodeSSH } from 'node-ssh';
import type { SSHAccount } from './types';

interface PooledConnection {
  connection: NodeSSH;
  account: SSHAccount;
  lastUsed: Date;
  inUse: boolean;
}

export class SSHConnectionPool {
  private static instance: SSHConnectionPool;
  private pool: Map<string, PooledConnection> = new Map();
  private readonly maxIdleTime = 5 * 60 * 1000; // 5 minutes
  private readonly cleanupInterval = 60 * 1000; // 1 minute
  private cleanupTimer?: NodeJS.Timeout;

  private constructor() {
    this.startCleanupTimer();
  }

  static getInstance(): SSHConnectionPool {
    if (!this.instance) {
      this.instance = new SSHConnectionPool();
    }
    return this.instance;
  }

  private getKey(account: SSHAccount): string {
    return `${account.username}@${account.host}:${account.port || 22}`;
  }

  async acquire(account: SSHAccount): Promise<NodeSSH> {
    const key = this.getKey(account);
    const pooled = this.pool.get(key);

    if (pooled && !pooled.inUse && pooled.connection.isConnected()) {
      pooled.inUse = true;
      pooled.lastUsed = new Date();
      return pooled.connection;
    }

    const ssh = new NodeSSH();
    await ssh.connect({
      host: account.host,
      port: account.port || 22,
      username: account.username,
      password: account.password,
      privateKey: account.privateKey,
      passphrase: account.passphrase,
      readyTimeout: account.timeout || 30000,
    });

    this.pool.set(key, {
      connection: ssh,
      account,
      lastUsed: new Date(),
      inUse: true,
    });

    return ssh;
  }

  release(account: SSHAccount): void {
    const key = this.getKey(account);
    const pooled = this.pool.get(key);

    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = new Date();
    }
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, pooled] of this.pool.entries()) {
      const idleTime = now - pooled.lastUsed.getTime();

      if (!pooled.inUse && idleTime > this.maxIdleTime) {
        pooled.connection.dispose();
        this.pool.delete(key);
      }
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  async closeAll(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    for (const pooled of this.pool.values()) {
      pooled.connection.dispose();
    }

    this.pool.clear();
  }

  getStats() {
    const total = this.pool.size;
    let inUse = 0;

    for (const pooled of this.pool.values()) {
      if (pooled.inUse) inUse++;
    }

    return { total, inUse, idle: total - inUse };
  }
}
