# SSH Remote Operations Architecture

## Overview

This document describes the architecture for remote SSH command execution functionality integrated into the lightweight-web-seed stack. The system provides transparent, type-safe remote file operations via tRPC with connection pooling, error handling, and audit logging.

## Design Goals

1. **Transparent API**: Developers use simple methods without thinking about SSH complexity
2. **Type Safety**: Full TypeScript support with Zod validation
3. **Security**: AES-256 encrypted credentials, JWT authentication, audit logging
4. **Performance**: Connection pooling for efficient resource usage
5. **Reliability**: Automatic retry with configurable error notifications
6. **Scalability**: Support multiple SSH accounts per project

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Browser Component (components/SSHFileManager.tsx)                    │
│   ┌──────────────────────────────────────────────────────┐             │
│   │ trpc.ssh.copy.useMutation()                          │             │
│   │ trpc.ssh.mkdir.useMutation()                         │             │
│   │ trpc.sshConfig.createAccount.useMutation()           │             │
│   └──────────────────────────────────────────────────────┘             │
│                             │                                           │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         tRPC LAYER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  tRPC Client (lib/trpc/client.ts)                                      │
│       │                                                                 │
│       │ HTTP POST /api/trpc/ssh.copy                                   │
│       │ HTTP POST /api/trpc/ssh.mkdir                                  │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────┐           │
│  │  SSH Router (server/routers/ssh.ts)                     │           │
│  │  ┌─────────────┬────────────────┬──────────────────┐    │           │
│  │  │ copy()      │ mkdir()        │ writeFile()      │    │           │
│  │  │ move()      │ symlink()      │ readFile()       │    │           │
│  │  │ remove()    │ chmod()        │ appendFile()     │    │           │
│  │  └─────────────┴────────────────┴──────────────────┘    │           │
│  └─────────────────────────────────────────────────────────┘           │
│                              │                                          │
│  ┌─────────────────────────────────────────────────────────┐           │
│  │  SSH Config Router (server/routers/ssh-config.ts)       │           │
│  │  ┌─────────────────┬───────────────────────────────┐    │           │
│  │  │ createAccount() │ linkToProject()               │    │           │
│  │  │ listAccounts()  │ setErrorNotification()        │    │           │
│  │  └─────────────────┴───────────────────────────────┘    │           │
│  └─────────────────────────────────────────────────────────┘           │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │  SSH Connection Pool (lib/ssh/pool.ts)                   │          │
│  │  ┌───────────────────────────────────────────────────┐   │          │
│  │  │ acquire() - Get/create connection                 │   │          │
│  │  │ release() - Return connection to pool             │   │          │
│  │  │ cleanup() - Remove idle connections               │   │          │
│  │  │                                                    │   │          │
│  │  │ Pool: Map<connectionKey, PooledConnection>        │   │          │
│  │  │   - connection: NodeSSH                           │   │          │
│  │  │   - lastUsed: Date                                │   │          │
│  │  │   - inUse: boolean                                │   │          │
│  │  └───────────────────────────────────────────────────┘   │          │
│  └──────────────────────────────────────────────────────────┘          │
│                              │                                          │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │  SSH File Operations (lib/ssh/operations.ts)             │          │
│  │  ┌────────────────────────────────────────────────────┐  │          │
│  │  │ File Operations:                                   │  │          │
│  │  │  - copy(source, dest, account)                     │  │          │
│  │  │  - move(source, dest, account)                     │  │          │
│  │  │  - remove(path, recursive, account)                │  │          │
│  │  │                                                     │  │          │
│  │  │ Directory Operations:                              │  │          │
│  │  │  - mkdir(path, recursive, account)                 │  │          │
│  │  │  - listDir(path, account)                          │  │          │
│  │  │                                                     │  │          │
│  │  │ Link Operations:                                   │  │          │
│  │  │  - symlink(target, linkPath, account)              │  │          │
│  │  │  - hardlink(target, linkPath, account)             │  │          │
│  │  │                                                     │  │          │
│  │  │ File Content:                                      │  │          │
│  │  │  - readFile(path, account)                         │  │          │
│  │  │  - writeFile(path, content, account)               │  │          │
│  │  │  - appendFile(path, content, account)              │  │          │
│  │  │                                                     │  │          │
│  │  │ File Metadata:                                     │  │          │
│  │  │  - chmod(path, mode, account)                      │  │          │
│  │  │  - chown(path, owner, group, account)              │  │          │
│  │  │  - touch(path, account)                            │  │          │
│  │  │  - exists(path, account)                           │  │          │
│  │  │  - stat(path, account)                             │  │          │
│  │  └────────────────────────────────────────────────────┘  │          │
│  └──────────────────────────────────────────────────────────┘          │
│                              │                                          │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │  AES Crypto (lib/crypto/aes.ts)                          │          │
│  │  ┌────────────────────────────────────────────────────┐  │          │
│  │  │ encrypt(text) - AES-256-CBC encryption             │  │          │
│  │  │ decrypt(text) - AES-256-CBC decryption             │  │          │
│  │  │ Algorithm: aes-256-cbc with random IV              │  │          │
│  │  └────────────────────────────────────────────────────┘  │          │
│  └──────────────────────────────────────────────────────────┘          │
│                              │                                          │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │  Error Notifier (lib/notifications/email.ts)             │          │
│  │  ┌────────────────────────────────────────────────────┐  │          │
│  │  │ notifyError(operation, error, account, config)     │  │          │
│  │  │ Uses BullMQ EMAIL queue                            │  │          │
│  │  │ Supports custom handlers                           │  │          │
│  │  └────────────────────────────────────────────────────┘  │          │
│  └──────────────────────────────────────────────────────────┘          │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                    │
├──────────────────────┬──────────────────────┬───────────────────────────┤
│                      │                      │                           │
│  PostgreSQL          │  Redis               │  Remote SSH Servers       │
│  (port 5432)         │  (port 6379)         │  (user-configured)        │
│                      │                      │                           │
│  ┌────────────────┐  │  ┌────────────────┐  │  ┌──────────────────┐    │
│  │ ssh_accounts   │  │  │ BullMQ queues  │  │  │ SSH Connection   │    │
│  │ - accountName  │  │  │ - EMAIL queue  │  │  │                  │    │
│  │ - host/port    │  │  │   (for error   │  │  │ File Operations: │    │
│  │ - username     │  │  │   notifications)│  │  │ - cp, mv, rm     │    │
│  │ - encrypted    │  │  └────────────────┘  │  │ - mkdir, ln -s   │    │
│  │   credentials  │  │                      │  │ - touch, chmod   │    │
│  │                │  │                      │  │ - cat, echo      │    │
│  ├────────────────┤  │                      │  └──────────────────┘    │
│  │ project_ssh_   │  │                      │                           │
│  │  configs       │  │                      │                           │
│  │ - projectId    │  │                      │                           │
│  │ - sshAccountId │  │                      │                           │
│  │ - configAlias  │  │                      │                           │
│  │                │  │                      │                           │
│  ├────────────────┤  │                      │                           │
│  │ ssh_operation_ │  │                      │                           │
│  │  logs          │  │                      │                           │
│  │ - operation    │  │                      │                           │
│  │ - success      │  │                      │                           │
│  │ - stdout/stderr│  │                      │                           │
│  │                │  │                      │                           │
│  ├────────────────┤  │                      │                           │
│  │ ssh_error_     │  │                      │                           │
│  │  notifications │  │                      │                           │
│  │ - emailAddr    │  │                      │                           │
│  │ - maxRetries   │  │                      │                           │
│  │ - customHandler│  │                      │                           │
│  └────────────────┘  │                      │                           │
│                      │                      │                           │
└──────────────────────┴──────────────────────┴───────────────────────────┘
```

## Request Flow

### SSH File Operation Flow

```
Component
    │
    │ trpc.ssh.copy({ projectId: 1, configAlias: "production", source: "/a", dest: "/b" })
    ▼
tRPC Client
    │
    │ HTTP POST /api/trpc/ssh.copy
    ▼
SSH Router (server/routers/ssh.ts)
    │
    │ 1. Resolve SSH account using resolveSSHAccount()
    │    - Check if accountName provided → use directly
    │    - Check if projectId + configAlias → query project_ssh_configs
    │    - Check if projectId only → query for isDefault=true
    │    - Throw error if no resolution method provided
    │
    │ 2. Get SSH account from DB by resolved accountId/accountName
    │ 3. Decrypt credentials using AESCrypto
    │ 4. Get error notification config
    │ 5. Execute with retry wrapper
    ▼
executeWithRetry()
    │
    │ For attempt 1 to maxRetries:
    ├─► SSHFileOperations.copy()
    │       │
    │       ├─► SSHConnectionPool.acquire()
    │       │       │
    │       │       ├─► Check pool for existing connection
    │       │       │   - Key: username@host:port
    │       │       │   - Reuse if available and not in use
    │       │       │
    │       │       └─► Create new connection if needed
    │       │           - NodeSSH.connect()
    │       │           - Add to pool
    │       │
    │       ├─► Execute command via SSH
    │       │   ssh.execCommand(`cp "${source}" "${dest}"`)
    │       │
    │       └─► SSHConnectionPool.release()
    │               - Mark connection as available
    │               - Update lastUsed timestamp
    │
    ├─► On Success:
    │   │
    │   ├─► Log to ssh_operation_logs (success=true)
    │   └─► Return result
    │
    └─► On Failure:
        │
        ├─► Retry with exponential backoff
        │   - Wait: retryDelay * 2^attempt
        │
        └─► After all retries failed:
            │
            ├─► Log to ssh_operation_logs (success=false)
            │
            └─► Send error notification
                │
                ├─► Custom handler (if configured)
                │   - Execute custom handler function
                │
                └─► Default: Email via BullMQ
                    - QueueManager.addJob('EMAIL', ...)
                    - Email to configured addresses
```

### Connection Pool Lifecycle

```
Initial State: Pool is empty
    │
    │ First request for user@host:port
    ▼
Pool.acquire()
    │
    ├─► Check pool: No connection exists
    │
    └─► Create new SSH connection
        │
        ├─► NodeSSH.connect({ host, username, password/key })
        │
        └─► Add to pool
            pool.set(key, {
              connection: ssh,
              account: {...},
              lastUsed: Date.now(),
              inUse: true
            })

Subsequent requests for same host
    │
    ▼
Pool.acquire()
    │
    ├─► Check pool: Connection exists
    │
    ├─► Check if in use: No
    │
    ├─► Check if connected: Yes
    │
    └─► Reuse connection
        - Mark inUse = true
        - Update lastUsed
        - Return existing connection

Operation complete
    │
    ▼
Pool.release()
    │
    └─► Mark inUse = false
        Update lastUsed = Date.now()

Background cleanup (every 60s)
    │
    ▼
Pool.cleanup()
    │
    ├─► For each connection in pool:
    │   │
    │   ├─► If not in use
    │   │   AND idle > 5 minutes
    │   │
    │   └─► Dispose connection
    │       Remove from pool
```

## Key Components

### 1. SSH Account Management
- Global account registry with unique names
- AES-256 encrypted credential storage
- Support for password and private key authentication
- Per-account configuration (basePath, timeout)

### 2. Project Integration
- Many-to-many relationship: Projects ↔ SSH Accounts
- Config aliases for easy reference (e.g., "production", "staging")
- Project-specific base path overrides
- Default configuration per project (`isDefault=true`)
- **Flexible account resolution** supporting three methods:
  1. Direct account name lookup
  2. Project + config alias resolution
  3. Project default account resolution

### 2.1 Account Resolution Logic

The `resolveSSHAccount()` helper provides intelligent account selection:

```typescript
async function resolveSSHAccount(input: {
  accountName?: string;
  projectId?: number;
  configAlias?: string;
}): Promise<SSHAccount> {
  // Priority 1: Direct account name (backwards compatible)
  if (input.accountName) {
    const account = await db
      .select()
      .from(sshAccounts)
      .where(and(
        eq(sshAccounts.accountName, input.accountName),
        eq(sshAccounts.isActive, true)
      ))
      .limit(1);

    if (!account[0]) {
      throw new Error(`SSH account '${input.accountName}' not found`);
    }

    return decryptAccount(account[0]);
  }

  // Priority 2: Project + config alias
  if (input.projectId && input.configAlias) {
    const config = await db
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

    if (!config[0]) {
      throw new Error(
        `No SSH config found for project ${input.projectId} with alias '${input.configAlias}'`
      );
    }

    return decryptAccount(config[0].account);
  }

  // Priority 3: Project default account
  if (input.projectId) {
    const config = await db
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

    if (!config[0]) {
      throw new Error(
        `No default SSH account configured for project ${input.projectId}`
      );
    }

    return decryptAccount(config[0].account);
  }

  throw new Error(
    'Must provide either accountName, or projectId with optional configAlias'
  );
}
```

**Resolution Examples:**

```typescript
// Method 1: Direct account name
const account = await resolveSSHAccount({ accountName: 'prod-web-01' });

// Method 2: Project + config alias
const account = await resolveSSHAccount({
  projectId: 1,
  configAlias: 'production'
});

// Method 3: Project default
const account = await resolveSSHAccount({ projectId: 1 });
```

### 3. Connection Pooling
- Singleton pool manager
- Connection reuse based on username@host:port
- Automatic cleanup of idle connections (5 min timeout)
- Thread-safe connection acquisition/release

### 4. Error Handling
- Configurable retry attempts (default: 3)
- Exponential backoff between retries
- Error notification via email (BullMQ)
- Custom error handler support

### 5. Audit Logging
- All operations logged to database
- Track success/failure, execution time
- Store operation parameters
- Link to project and SSH account

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Network                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - SSH over TCP (port 22 or custom)                   │  │
│  │ - Encrypted SSH tunnel                                │  │
│  │ - Public key or password authentication              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 2: Application Authentication                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - JWT token required for tRPC operations             │  │
│  │ - User must be authenticated to use SSH functions    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 3: Credential Storage                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - AES-256-CBC encryption                              │  │
│  │ - Random IV per encryption                            │  │
│  │ - Encryption key from environment variable            │  │
│  │ - Never expose credentials to client                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 4: Input Validation                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - Zod schema validation for all inputs               │  │
│  │ - Path traversal prevention                          │  │
│  │ - Command injection prevention                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 5: Audit & Monitoring                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ - All operations logged to database                  │  │
│  │ - Track which user performed which operation         │  │
│  │ - Error notifications for failed operations          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### New Dependencies
- **node-ssh** (^13.1.0) - High-level SSH client wrapper
- **ssh2** (^1.15.0) - Low-level SSH2 protocol implementation

### Existing Stack Integration
- **tRPC** - Type-safe API endpoints
- **Drizzle ORM** - Database operations
- **PostgreSQL** - Credential and log storage
- **BullMQ/Redis** - Error notification queue
- **Zod** - Input validation
- **AES-256-CBC** - Credential encryption

## Next Steps

See related documentation:
- [SSH Database Schema](./SSH_DATABASE.md)
- [SSH API Design](./SSH_API.md)
- [SSH Security](./SSH_SECURITY.md)
- [SSH Implementation Plan](./SSH_IMPLEMENTATION.md)
