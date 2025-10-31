# SSH Implementation Plan

## Overview

This document provides a step-by-step implementation plan for the SSH remote operations feature.

## Phase 1: Foundation (Core Infrastructure)

### 1.1 Install Dependencies

```bash
npm install node-ssh@^13.1.0 ssh2@^1.15.0
npm install -D @types/ssh2@^1.11.0
```

### 1.2 Setup Encryption Key

```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
echo "SSH_ENCRYPTION_KEY=your_generated_key_here" >> .env
```

### 1.3 Create Type Definitions

**File:** `lib/ssh/types.ts`

```typescript
export interface SSHAccount {
  id?: number;
  accountName: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  basePath?: string;
  timeout: number;
}

export interface SSHOperationResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  code?: number;
  message?: string;
  executionTime?: number;
  data?: any;
}
```

**Checklist:**
- [ ] Create `lib/ssh/types.ts`
- [ ] Export all type definitions
- [ ] Verify TypeScript compilation

---

### 1.4 Implement AES Encryption

**File:** `lib/crypto/aes.ts`

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export class AESCrypto {
  private static getKey(): Buffer {
    const key = process.env.SSH_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
      throw new Error('SSH_ENCRYPTION_KEY must be a 64-character hex string');
    }
    return Buffer.from(key, 'hex');
  }

  static encrypt(text: string): string {
    if (!text) return '';

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this.getKey();

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedText: string): string {
    if (!encryptedText) return '';

    const [ivHex, encryptedData] = encryptedText.split(':');
    if (!ivHex || !encryptedData) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const key = this.getKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
```

**Checklist:**
- [ ] Create `lib/crypto/aes.ts`
- [ ] Implement `encrypt()` method
- [ ] Implement `decrypt()` method
- [ ] Add error handling
- [ ] Test encryption/decryption roundtrip
- [ ] Add `generateKey()` helper

---

### 1.5 Update Database Schema

**File:** `lib/db/schema.ts`

Add the following tables:

```typescript
import { pgTable, serial, varchar, integer, text, timestamp, boolean, jsonb, unique } from 'drizzle-orm/pg-core';

// SSH Accounts
export const sshAccounts = pgTable('ssh_accounts', {
  id: serial('id').primaryKey(),
  accountName: varchar('account_name', { length: 255 }).notNull().unique(),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').notNull().default(22),
  username: varchar('username', { length: 255 }).notNull(),

  encryptedPassword: text('encrypted_password'),
  encryptedPrivateKey: text('encrypted_private_key'),
  encryptedPassphrase: text('encrypted_passphrase'),

  authMethod: varchar('auth_method', { length: 50 }).notNull(),
  basePath: varchar('base_path', { length: 500 }),
  timeout: integer('timeout').default(30000),

  description: text('description'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

// Project SSH Configurations
export const projectSshConfigs = pgTable('project_ssh_configs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  sshAccountId: integer('ssh_account_id').references(() => sshAccounts.id, { onDelete: 'cascade' }).notNull(),
  configAlias: varchar('config_alias', { length: 100 }).notNull(),
  overrideBasePath: varchar('override_base_path', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
}, (table) => ({
  uniqueProjectAlias: unique().on(table.projectId, table.configAlias),
}));

// SSH Operation Logs
export const sshOperationLogs = pgTable('ssh_operation_logs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  sshAccountId: integer('ssh_account_id').references(() => sshAccounts.id),
  operation: varchar('operation', { length: 100 }).notNull(),
  parameters: jsonb('parameters'),
  success: boolean('success').notNull(),
  stdout: text('stdout'),
  stderr: text('stderr'),
  errorMessage: text('error_message'),
  executionTime: integer('execution_time'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// SSH Error Notifications
export const sshErrorNotifications = pgTable('ssh_error_notifications', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  sshAccountId: integer('ssh_account_id').references(() => sshAccounts.id, { onDelete: 'cascade' }),
  notifyOnError: boolean('notify_on_error').default(true).notNull(),
  emailAddresses: text('email_addresses').notNull(),
  customHandler: varchar('custom_handler', { length: 255 }),
  customHandlerConfig: jsonb('custom_handler_config'),
  maxRetries: integer('max_retries').default(3).notNull(),
  retryDelay: integer('retry_delay').default(1000).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueProjectAccount: unique().on(table.projectId, table.sshAccountId),
}));
```

**Checklist:**
- [ ] Add tables to `lib/db/schema.ts`
- [ ] Run `npm run db:push` to apply schema
- [ ] Verify tables created in PostgreSQL
- [ ] Test foreign key constraints

---

## Phase 2: SSH Services

### 2.1 Connection Pool Manager

**File:** `lib/ssh/pool.ts`

```typescript
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
```

**Checklist:**
- [ ] Create `lib/ssh/pool.ts`
- [ ] Implement singleton pattern
- [ ] Add connection pooling logic
- [ ] Add cleanup timer
- [ ] Test connection reuse
- [ ] Add stats method for monitoring

---

### 2.2 SSH File Operations

**File:** `lib/ssh/operations.ts`

Implement all file operations using the connection pool. See full implementation in the architecture document.

**Key Methods:**
- [ ] `copy(source, dest, account)`
- [ ] `move(source, dest, account)`
- [ ] `remove(path, recursive, account)`
- [ ] `mkdir(path, recursive, account)`
- [ ] `symlink(target, linkPath, account)`
- [ ] `hardlink(target, linkPath, account)`
- [ ] `touch(path, account)`
- [ ] `chmod(path, mode, account)`
- [ ] `chown(path, owner, group, account)`
- [ ] `readFile(path, account)`
- [ ] `writeFile(path, content, account)`
- [ ] `appendFile(path, content, account)`
- [ ] `exists(path, account)`
- [ ] `listDir(path, account)`
- [ ] `stat(path, account)`

---

### 2.3 Email Notification System

**File:** `lib/notifications/email.ts`

```typescript
import { QueueManager } from '@/lib/queue';
import type { SSHOperationResult, SSHAccount } from '@/lib/ssh/types';

export interface EmailNotificationConfig {
  emailAddresses: string[];
  projectName?: string;
  accountName?: string;
}

export class SSHErrorNotifier {
  static async notifyError(
    operation: string,
    error: SSHOperationResult,
    account: SSHAccount,
    config: EmailNotificationConfig
  ): Promise<void> {
    const emailContent = this.formatErrorEmail(operation, error, account, config);

    await QueueManager.addJob('EMAIL', 'ssh-error-notification', {
      to: config.emailAddresses,
      subject: `SSH Operation Failed: ${operation}`,
      body: emailContent,
      priority: 'high',
    });
  }

  private static formatErrorEmail(
    operation: string,
    error: SSHOperationResult,
    account: SSHAccount,
    config: EmailNotificationConfig
  ): string {
    return `
SSH Operation Failed

Project: ${config.projectName || 'N/A'}
Account: ${config.accountName || account.username}
Host: ${account.host}:${account.port || 22}
Operation: ${operation}

Error Details:
${error.message || 'Unknown error'}

STDERR:
${error.stderr || 'N/A'}

Execution Time: ${error.executionTime || 0}ms
Timestamp: ${new Date().toISOString()}
    `.trim();
  }
}
```

**Checklist:**
- [ ] Create `lib/notifications/email.ts`
- [ ] Implement error notification
- [ ] Format email content
- [ ] Integrate with BullMQ

---

## Phase 3: tRPC Routers

### 3.1 SSH Configuration Router

**File:** `server/routers/ssh-config.ts`

Implement all configuration endpoints. See full implementation in API design document.

**Key Procedures:**
- [ ] `createAccount`
- [ ] `updateAccount`
- [ ] `deleteAccount`
- [ ] `listAccounts`
- [ ] `getAccount` (server-side only)
- [ ] `linkToProject`
- [ ] `unlinkFromProject`
- [ ] `getProjectConfigs`
- [ ] `setErrorNotification`

---

### 3.2 Account Resolution Helper

**File:** `server/lib/ssh-resolver.ts`

Implement the core account resolution logic that supports multiple resolution methods.

```typescript
import { db } from '@/lib/db';
import { sshAccounts, projectSshConfigs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { AESCrypto } from '@/lib/crypto/aes';
import type { SSHAccount } from '@/lib/ssh/types';

interface ResolveInput {
  accountName?: string;
  projectId?: number;
  configAlias?: string;
}

/**
 * Resolve SSH account from multiple input methods
 * Priority: accountName > projectId+configAlias > projectId (default)
 */
export async function resolveSSHAccount(input: ResolveInput): Promise<SSHAccount> {
  // Method 1: Direct account name lookup
  if (input.accountName) {
    const [account] = await db
      .select()
      .from(sshAccounts)
      .where(and(
        eq(sshAccounts.accountName, input.accountName),
        eq(sshAccounts.isActive, true)
      ))
      .limit(1);

    if (!account) {
      throw new Error(`SSH account '${input.accountName}' not found or inactive`);
    }

    return decryptSSHAccount(account);
  }

  // Method 2: Project + config alias resolution
  if (input.projectId && input.configAlias) {
    const [result] = await db
      .select({
        account: sshAccounts,
        config: projectSshConfigs,
      })
      .from(projectSshConfigs)
      .innerJoin(sshAccounts, eq(projectSshConfigs.sshAccountId, sshAccounts.id))
      .where(and(
        eq(projectSshConfigs.projectId, input.projectId),
        eq(projectSshConfigs.configAlias, input.configAlias),
        eq(sshAccounts.isActive, true)
      ))
      .limit(1);

    if (!result) {
      throw new Error(
        `No SSH config found for project ${input.projectId} with alias '${input.configAlias}'`
      );
    }

    return decryptSSHAccount(result.account);
  }

  // Method 3: Project default account
  if (input.projectId) {
    const [result] = await db
      .select({
        account: sshAccounts,
        config: projectSshConfigs,
      })
      .from(projectSshConfigs)
      .innerJoin(sshAccounts, eq(projectSshConfigs.sshAccountId, sshAccounts.id))
      .where(and(
        eq(projectSshConfigs.projectId, input.projectId),
        eq(projectSshConfigs.isDefault, true),
        eq(sshAccounts.isActive, true)
      ))
      .limit(1);

    if (!result) {
      throw new Error(
        `No default SSH account configured for project ${input.projectId}`
      );
    }

    return decryptSSHAccount(result.account);
  }

  // No valid resolution method provided
  throw new Error(
    'Must provide either accountName, or projectId with optional configAlias'
  );
}

/**
 * Decrypt SSH account credentials
 */
function decryptSSHAccount(account: any): SSHAccount {
  return {
    id: account.id,
    accountName: account.accountName,
    host: account.host,
    port: account.port || 22,
    username: account.username,
    password: account.encryptedPassword
      ? AESCrypto.decrypt(account.encryptedPassword)
      : undefined,
    privateKey: account.encryptedPrivateKey
      ? AESCrypto.decrypt(account.encryptedPrivateKey)
      : undefined,
    passphrase: account.encryptedPassphrase
      ? AESCrypto.decrypt(account.encryptedPassphrase)
      : undefined,
    basePath: account.basePath,
    timeout: account.timeout || 30000,
  };
}
```

**Checklist:**
- [ ] Create `server/lib/ssh-resolver.ts`
- [ ] Implement `resolveSSHAccount()` with three resolution methods
- [ ] Implement `decryptSSHAccount()` helper
- [ ] Add comprehensive error messages
- [ ] Test all three resolution paths
- [ ] Add TypeScript types

---

### 3.3 SSH Operations Router

**File:** `server/routers/ssh.ts`

Implement all SSH operation endpoints using the new account resolution.

**Updated Zod Schema:**
```typescript
import { z } from 'zod';

// Base schema for account resolution (used in all operations)
const accountResolutionSchema = z.object({
  // Method 1: Direct account name
  accountName: z.string().optional(),

  // Method 2 & 3: Project-based resolution
  projectId: z.number().int().positive().optional(),
  configAlias: z.string().optional(),
}).refine(
  (data) => data.accountName || data.projectId,
  {
    message: 'Either accountName or projectId must be provided',
  }
);

// Example: Copy operation schema
const copySchema = accountResolutionSchema.extend({
  source: z.string().min(1),
  dest: z.string().min(1),
});
```

**Updated Router Implementation:**
```typescript
import { router, protectedProcedure } from '@/lib/trpc/trpc';
import { resolveSSHAccount } from '@/server/lib/ssh-resolver';
import { SSHFileOperations } from '@/lib/ssh/operations';

export const sshRouter = router({
  copy: protectedProcedure
    .input(copySchema)
    .mutation(async ({ input }) => {
      // Resolve SSH account using new helper
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      // Execute operation
      const operations = new SSHFileOperations();
      return await executeWithRetry(
        () => operations.copy(input.source, input.dest, account),
        account,
        'copy',
        input
      );
    }),

  // ... other operations follow same pattern
});
```

**Key Features:**
- [ ] Update Zod validation schemas with account resolution
- [ ] Use `resolveSSHAccount()` in all operations
- [ ] Update `executeWithRetry` wrapper
- [ ] Implement all file operation procedures
- [ ] Add operation logging with resolved account
- [ ] Error notifications

---

### 3.4 Update App Router

**File:** `server/routers/_app.ts`

```typescript
import { router } from '@/lib/trpc/trpc';
import { userRouter } from './user';
import { postRouter } from './post';
import { authRouter } from './auth';
import { projectRouter } from './project';
import { sshConfigRouter } from './ssh-config';
import { sshRouter } from './ssh';

export const appRouter = router({
  user: userRouter,
  post: postRouter,
  auth: authRouter,
  project: projectRouter,
  sshConfig: sshConfigRouter,
  ssh: sshRouter,
});

export type AppRouter = typeof appRouter;
```

**Checklist:**
- [ ] Import SSH routers
- [ ] Add to app router
- [ ] Verify type exports

---

## Phase 4: Testing

### 4.1 Unit Tests

**File:** `__tests__/ssh/aes.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { AESCrypto } from '@/lib/crypto/aes';

describe('AESCrypto', () => {
  it('should encrypt and decrypt correctly', () => {
    const plaintext = 'mySecretPassword123';
    const encrypted = AESCrypto.encrypt(plaintext);
    const decrypted = AESCrypto.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':');
  });

  it('should generate different ciphertexts for same input', () => {
    const plaintext = 'test';
    const encrypted1 = AESCrypto.encrypt(plaintext);
    const encrypted2 = AESCrypto.encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);
  });
});
```

**Checklist:**
- [ ] Test AES encryption/decryption
- [ ] Test connection pool
- [ ] Test SSH operations (with mock)
- [ ] Test tRPC endpoints

---

### 4.2 Integration Tests

**File:** `__tests__/integration/ssh.test.ts`

Test with a real SSH server (use Docker for test environment).

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { sshAccounts } from '@/lib/db/schema';
import { SSHFileOperations } from '@/lib/ssh/operations';
import { AESCrypto } from '@/lib/crypto/aes';

describe('SSH Integration', () => {
  let testAccountId: number;

  beforeAll(async () => {
    // Create test SSH account
    const [account] = await db.insert(sshAccounts).values({
      accountName: 'test-ssh',
      host: 'localhost',
      port: 2222,
      username: 'testuser',
      encryptedPassword: AESCrypto.encrypt('testpass'),
      authMethod: 'password',
    }).returning();

    testAccountId = account.id;
  });

  it('should create directory via SSH', async () => {
    const operations = new SSHFileOperations();
    const result = await operations.mkdir(
      '/tmp/test-dir',
      true,
      getTestAccount()
    );

    expect(result.success).toBe(true);
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(sshAccounts).where(eq(sshAccounts.id, testAccountId));
  });
});
```

**Checklist:**
- [ ] Set up test SSH server
- [ ] Test all file operations
- [ ] Test error handling
- [ ] Test retry logic
- [ ] Test notifications

---

## Phase 5: Documentation & Examples

### 5.1 Update Main README

Add SSH operations section to main README.md.

### 5.2 Create Usage Examples

**File:** `examples/ssh-deployment.ts`

```typescript
import { trpc } from '@/lib/trpc/client';

async function deployApplication() {
  const accountName = 'prod-web-01';
  const version = '1.0.0';
  const releasePath = `/var/www/app/releases/${version}`;

  // 1. Create release directory
  await trpc.ssh.mkdir.mutate({
    accountName,
    path: releasePath,
    recursive: true,
  });

  // 2. Copy application files
  await trpc.ssh.copy.mutate({
    accountName,
    source: '/tmp/build/app.js',
    dest: `${releasePath}/app.js`,
  });

  // 3. Update current symlink
  await trpc.ssh.symlink.mutate({
    accountName,
    target: releasePath,
    linkPath: '/var/www/app/current',
  });

  // 4. Touch deployed marker
  await trpc.ssh.touch.mutate({
    accountName,
    path: '/var/www/app/.deployed',
  });

  console.log('Deployment complete!');
}
```

**Checklist:**
- [ ] Create deployment example
- [ ] Create backup example
- [ ] Create configuration management example
- [ ] Add to documentation

---

## Phase 6: Production Deployment

### 6.1 Environment Setup

```bash
# Production .env
SSH_ENCRYPTION_KEY=<generate-new-key-for-production>
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### 6.2 Migration

```bash
# Generate migration
npm run db:generate

# Review migration files
# Apply to production
npm run db:migrate
```

### 6.3 Security Hardening

- [ ] Review all SSH server configurations
- [ ] Set up IP whitelisting
- [ ] Configure fail2ban
- [ ] Enable audit logging
- [ ] Set up monitoring alerts
- [ ] Configure error notifications

### 6.4 Monitoring

- [ ] Set up dashboard for SSH operations
- [ ] Monitor connection pool statistics
- [ ] Track operation success rates
- [ ] Alert on repeated failures
- [ ] Monitor execution times

---

## Implementation Timeline

### Week 1: Foundation
- Days 1-2: Dependencies, types, encryption
- Days 3-4: Database schema and migration
- Day 5: Connection pool

### Week 2: Core Services
- Days 1-3: SSH file operations
- Days 4-5: Error notification system

### Week 3: API Layer
- Days 1-2: SSH config router
- Days 3-4: SSH operations router
- Day 5: Integration and testing

### Week 4: Testing & Documentation
- Days 1-2: Unit and integration tests
- Days 3-4: Documentation and examples
- Day 5: Production deployment preparation

---

## Testing Checklist

### Functionality
- [ ] Create SSH account with password auth
- [ ] Create SSH account with key auth
- [ ] Link account to project
- [ ] Execute all file operations
- [ ] Test retry logic
- [ ] Test error notifications
- [ ] Test connection pooling
- [ ] Test concurrent operations

### Security
- [ ] Verify credentials are encrypted
- [ ] Test input validation
- [ ] Test path traversal prevention
- [ ] Verify audit logging
- [ ] Test authentication requirements

### Performance
- [ ] Test connection reuse
- [ ] Measure operation latency
- [ ] Test under load
- [ ] Verify cleanup of idle connections

### Error Handling
- [ ] Test with invalid credentials
- [ ] Test with unreachable host
- [ ] Test with permission errors
- [ ] Verify error notifications sent

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate Rollback:**
   ```bash
   # Revert database migration
   npm run db:rollback

   # Revert code changes
   git revert <commit-hash>
   git push
   ```

2. **Disable Feature:**
   ```typescript
   // Add feature flag
   const SSH_FEATURE_ENABLED = process.env.SSH_FEATURE_ENABLED === 'true';

   if (!SSH_FEATURE_ENABLED) {
     throw new Error('SSH feature is disabled');
   }
   ```

3. **Data Cleanup:**
   ```sql
   -- If needed, remove SSH data
   DELETE FROM ssh_operation_logs;
   DELETE FROM project_ssh_configs;
   DELETE FROM ssh_error_notifications;
   DELETE FROM ssh_accounts;
   ```

---

## Success Criteria

- [ ] All database tables created and indexed
- [ ] All file operations working correctly
- [ ] Connection pooling functional
- [ ] Error notifications working
- [ ] Audit logging complete
- [ ] Security measures in place
- [ ] Documentation complete
- [ ] Tests passing (>80% coverage)
- [ ] Production deployment successful
- [ ] No security vulnerabilities

---

## Related Documentation

- [SSH Architecture](./SSH_architecture.md)
- [SSH Database Schema](./SSH_database.md)
- [SSH API Design](./SSH_api.md)
- [SSH Security](./SSH_SECURITY.md)
