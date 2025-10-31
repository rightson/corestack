# SSH API Design

## Overview

This document describes the tRPC API endpoints for SSH remote operations. The API is divided into two main routers:

1. **SSH Config Router** - Manage SSH accounts and configurations
2. **SSH Operations Router** - Execute remote file operations

## API Structure

```
appRouter
├── sshConfig.*     (server/routers/ssh-config.ts)
│   ├── createAccount
│   ├── updateAccount
│   ├── deleteAccount
│   ├── listAccounts
│   ├── getAccount
│   ├── linkToProject
│   ├── unlinkFromProject
│   ├── getProjectConfigs
│   └── setErrorNotification
│
└── ssh.*           (server/routers/ssh.ts)
    ├── copy
    ├── move
    ├── remove
    ├── mkdir
    ├── symlink
    ├── hardlink
    ├── touch
    ├── chmod
    ├── chown
    ├── readFile
    ├── writeFile
    ├── appendFile
    ├── exists
    ├── listDir
    └── stat
```

## SSH Config Router

### createAccount

Create a new SSH account with encrypted credentials.

**Type:** Mutation

**Input:**
```typescript
{
  accountName: string;          // Globally unique name
  host: string;
  port?: number;                // Default: 22
  username: string;
  authMethod: 'password' | 'privateKey';
  password?: string;            // For password auth
  privateKey?: string;          // For key-based auth
  passphrase?: string;          // For encrypted keys
  basePath?: string;            // Default remote directory
  timeout?: number;             // Default: 30000ms
  description?: string;
}
```

**Output:**
```typescript
{
  id: number;
  accountName: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  basePath?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
}
```

**Example Usage:**
```typescript
const account = await trpc.sshConfig.createAccount.mutate({
  accountName: 'prod-web-01',
  host: 'web1.example.com',
  port: 22,
  username: 'deploy',
  authMethod: 'password',
  password: 'secret123',
  basePath: '/var/www/app',
  description: 'Production web server',
});
```

**Validation:**
- `accountName` must be unique
- `authMethod` must match provided credentials
- `password` or `privateKey` required based on `authMethod`
- `host` must be valid hostname or IP

---

### updateAccount

Update an existing SSH account.

**Type:** Mutation

**Input:**
```typescript
{
  accountName: string;          // Account to update
  host?: string;
  port?: number;
  username?: string;
  password?: string;            // Updates encrypted password
  privateKey?: string;          // Updates encrypted key
  passphrase?: string;          // Updates encrypted passphrase
  basePath?: string;
  timeout?: number;
  description?: string;
  isActive?: boolean;
}
```

**Output:**
```typescript
{
  id: number;
  accountName: string;
  // ... updated fields
}
```

**Example Usage:**
```typescript
await trpc.sshConfig.updateAccount.mutate({
  accountName: 'prod-web-01',
  description: 'Production web server - updated',
  timeout: 60000,
});
```

---

### deleteAccount

Delete an SSH account (soft delete by setting isActive=false).

**Type:** Mutation

**Input:**
```typescript
{
  accountName: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Example Usage:**
```typescript
await trpc.sshConfig.deleteAccount.mutate({
  accountName: 'old-server',
});
```

---

### listAccounts

List all SSH accounts (without decrypted credentials).

**Type:** Query

**Input:**
```typescript
{
  activeOnly?: boolean;         // Default: true
}
```

**Output:**
```typescript
Array<{
  id: number;
  accountName: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  basePath?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
}>
```

**Example Usage:**
```typescript
const accounts = await trpc.sshConfig.listAccounts.useQuery({
  activeOnly: true,
});
```

---

### getAccount

Get a specific SSH account by name (server-side only, returns decrypted credentials).

**Type:** Query

**Input:**
```typescript
{
  accountName: string;
}
```

**Output:**
```typescript
{
  id: number;
  accountName: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  password?: string;            // Decrypted (server-side only)
  privateKey?: string;          // Decrypted (server-side only)
  passphrase?: string;          // Decrypted (server-side only)
  basePath?: string;
  timeout: number;
  description?: string;
  isActive: boolean;
}
```

**Example Usage (server-side only):**
```typescript
// This should only be called from server-side code
const account = await caller.sshConfig.getAccount({
  accountName: 'prod-web-01'
});
// account.password is decrypted
```

---

### linkToProject

Link an SSH account to a project with an alias.

**Type:** Mutation

**Input:**
```typescript
{
  projectId: number;
  sshAccountId: number;
  configAlias: string;          // e.g., 'production', 'staging'
  overrideBasePath?: string;    // Project-specific path override
  isDefault?: boolean;          // Default config for this project
}
```

**Output:**
```typescript
{
  id: number;
  projectId: number;
  sshAccountId: number;
  configAlias: string;
  overrideBasePath?: string;
  isDefault: boolean;
  createdAt: Date;
}
```

**Example Usage:**
```typescript
await trpc.sshConfig.linkToProject.mutate({
  projectId: 1,
  sshAccountId: 3,
  configAlias: 'production',
  overrideBasePath: '/var/www/myproject',
  isDefault: true,
});
```

**Validation:**
- `(projectId, configAlias)` must be unique
- Only one `isDefault=true` per project

---

### getProjectConfigs

Get all SSH configurations for a project.

**Type:** Query

**Input:**
```typescript
{
  projectId: number;
}
```

**Output:**
```typescript
Array<{
  config: {
    id: number;
    configAlias: string;
    overrideBasePath?: string;
    isDefault: boolean;
  };
  account: {
    id: number;
    accountName: string;
    host: string;
    port: number;
    username: string;
    basePath?: string;
  };
}>
```

**Example Usage:**
```typescript
const configs = await trpc.sshConfig.getProjectConfigs.useQuery({
  projectId: 1,
});

// Use a specific config
const prodConfig = configs.find(c => c.config.configAlias === 'production');
```

---

### setErrorNotification

Configure error notification settings for a project/account combination.

**Type:** Mutation

**Input:**
```typescript
{
  projectId?: number;           // Optional: specific project
  sshAccountId?: number;        // Optional: specific account
  notifyOnError: boolean;
  emailAddresses: string;       // Comma-separated
  customHandler?: string;       // Custom handler name
  customHandlerConfig?: any;    // Handler configuration (JSON)
  maxRetries?: number;          // Default: 3
  retryDelay?: number;          // Default: 1000ms
}
```

**Output:**
```typescript
{
  id: number;
  projectId?: number;
  sshAccountId?: number;
  notifyOnError: boolean;
  emailAddresses: string;
  maxRetries: number;
  retryDelay: number;
  createdAt: Date;
}
```

**Example Usage:**
```typescript
await trpc.sshConfig.setErrorNotification.mutate({
  projectId: 1,
  sshAccountId: 3,
  notifyOnError: true,
  emailAddresses: 'devops@example.com,alerts@example.com',
  maxRetries: 5,
  retryDelay: 2000,
});
```

---

## SSH Operations Router

All operations support **flexible account resolution** using one of three methods:

1. **Direct Account Name**: Specify `accountName` (globally unique)
2. **Project + Config Alias**: Specify `projectId` + `configAlias` (e.g., 'production', 'staging')
3. **Project Default**: Specify only `projectId` (uses `isDefault=true` account)

### Account Resolution Input Pattern

All SSH operations accept this standard input pattern:

```typescript
{
  // Method 1: Direct account name (backwards compatible)
  accountName?: string;

  // Method 2 & 3: Project-based resolution
  projectId?: number;
  configAlias?: string;          // Optional: resolves to specific alias, or default if omitted

  // ... operation-specific parameters
}
```

**Resolution Priority:**
1. If `accountName` is provided → use that account directly
2. If `projectId` + `configAlias` → resolve account from project config
3. If `projectId` only → use default account (`isDefault=true`)
4. Otherwise → throw error

**Validation:**
- At minimum, either `accountName` OR `projectId` must be provided
- `configAlias` requires `projectId`
- If project has no default account and `configAlias` is omitted, operation fails

---

### copy

Copy a file or directory.

**Type:** Mutation

**Input:**
```typescript
{
  // Account Resolution (choose one method)
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  source: string;               // Source path
  dest: string;                 // Destination path
}
```

**Output:**
```typescript
{
  success: boolean;
  stdout?: string;
  stderr?: string;
  message?: string;
  executionTime?: number;       // Milliseconds
}
```

**Example Usage:**

```typescript
// Method 1: Direct account name
const result = await trpc.ssh.copy.mutate({
  accountName: 'prod-web-01',
  source: '/tmp/build/app.js',
  dest: '/var/www/app/app.js',
});

// Method 2: Project + config alias (RECOMMENDED)
const result = await trpc.ssh.copy.mutate({
  projectId: 1,
  configAlias: 'production',
  source: '/tmp/build/app.js',
  dest: '/var/www/app/app.js',
});

// Method 3: Project default account
const result = await trpc.ssh.copy.mutate({
  projectId: 1,  // Uses isDefault=true account
  source: '/tmp/build/app.js',
  dest: '/var/www/app/app.js',
});
```

**Remote Command:**
```bash
cp "/tmp/build/app.js" "/var/www/app/app.js"
```

---

### move

Move or rename a file/directory.

**Type:** Mutation

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  source: string;
  dest: string;
}
```

**Example Usage:**
```typescript
// Using project + config alias
await trpc.ssh.move.mutate({
  projectId: 1,
  configAlias: 'production',
  source: '/var/www/app/old.log',
  dest: '/var/www/app/archive/old.log',
});
```

**Remote Command:**
```bash
mv "/var/www/app/old.log" "/var/www/app/archive/old.log"
```

---

### remove

Remove a file or directory.

**Type:** Mutation

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  path: string;
  recursive?: boolean;          // Default: false
}
```

**Example Usage:**
```typescript
await trpc.ssh.remove.mutate({
  projectId: 1,
  configAlias: 'production',
  path: '/tmp/old-files',
  recursive: true,
});
```

**Remote Command:**
```bash
rm -rf "/tmp/old-files"    # if recursive=true
rm -f "/tmp/file.txt"      # if recursive=false
```

---

### mkdir

Create a directory.

**Type:** Mutation

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  path: string;
  recursive?: boolean;          // Default: true
}
```

**Example Usage:**
```typescript
await trpc.ssh.mkdir.mutate({
  projectId: 1,
  configAlias: 'production',
  path: '/var/www/app/releases/2024-01',
  recursive: true,
});
```

**Remote Command:**
```bash
mkdir -p "/var/www/app/releases/2024-01"    # if recursive=true
mkdir "/var/www/app/new"                    # if recursive=false
```

---

### symlink

Create a symbolic link.

**Type:** Mutation

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  target: string;               // Link target
  linkPath: string;             // Link location
}
```

**Example Usage:**
```typescript
await trpc.ssh.symlink.mutate({
  projectId: 1,
  configAlias: 'production',
  target: '/var/www/app/releases/2024-01',
  linkPath: '/var/www/app/current',
});
```

**Remote Command:**
```bash
ln -sf "/var/www/app/releases/2024-01" "/var/www/app/current"
```

---

### hardlink

Create a hard link.

**Type:** Mutation

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  target: string;
  linkPath: string;
}
```

**Example Usage:**
```typescript
await trpc.ssh.hardlink.mutate({
  projectId: 1,
  configAlias: 'production',
  target: '/var/www/app/file.txt',
  linkPath: '/var/www/app/file-link.txt',
});
```

**Remote Command:**
```bash
ln -f "/var/www/app/file.txt" "/var/www/app/file-link.txt"
```

---

### touch

Create or update file timestamp.

**Type:** Mutation

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  path: string;
}
```

**Example Usage:**
```typescript
await trpc.ssh.touch.mutate({
  projectId: 1,
  configAlias: 'production',
  path: '/var/www/app/.deployed',
});
```

**Remote Command:**
```bash
touch "/var/www/app/.deployed"
```

---

### chmod

Change file permissions.

**Type:** Mutation

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  path: string;
  mode: string;                 // e.g., '755', '644'
}
```

**Example Usage:**
```typescript
await trpc.ssh.chmod.mutate({
  projectId: 1,
  configAlias: 'production',
  path: '/var/www/app/scripts/deploy.sh',
  mode: '755',
});
```

**Remote Command:**
```bash
chmod 755 "/var/www/app/scripts/deploy.sh"
```

---

### chown

Change file ownership.

**Type:** Mutation

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  path: string;
  owner: string;
  group?: string;
}
```

**Example Usage:**
```typescript
await trpc.ssh.chown.mutate({
  projectId: 1,
  configAlias: 'production',
  path: '/var/www/app',
  owner: 'www-data',
  group: 'www-data',
});
```

**Remote Command:**
```bash
chown www-data:www-data "/var/www/app"    # with group
chown www-data "/var/www/app"             # without group
```

---

### readFile

Read file contents.

**Type:** Query

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  path: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  content?: string;
  stderr?: string;
  message?: string;
  executionTime?: number;
}
```

**Example Usage:**
```typescript
const result = await trpc.ssh.readFile.useQuery({
  projectId: 1,
  configAlias: 'production',
  path: '/var/www/app/config.json',
});

if (result.success) {
  const config = JSON.parse(result.content!);
}
```

**Remote Command:**
```bash
cat "/var/www/app/config.json"
```

---

### writeFile

Write content to a file.

**Type:** Mutation

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  path: string;
  content: string;
}
```

**Example Usage:**
```typescript
await trpc.ssh.writeFile.mutate({
  projectId: 1,
  configAlias: 'production',
  path: '/var/www/app/.env',
  content: 'DATABASE_URL=postgres://...\nAPI_KEY=...',
});
```

**Remote Command:**
```bash
cat > "/var/www/app/.env" << 'SSHEOF'
DATABASE_URL=postgres://...
API_KEY=...
SSHEOF
```

---

### appendFile

Append content to a file.

**Type:** Mutation

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  path: string;
  content: string;
}
```

**Example Usage:**
```typescript
await trpc.ssh.appendFile.mutate({
  projectId: 1,
  configAlias: 'production',
  path: '/var/log/app/deploy.log',
  content: `[${new Date().toISOString()}] Deployment completed\n`,
});
```

**Remote Command:**
```bash
cat >> "/var/log/app/deploy.log" << 'SSHEOF'
[2024-01-15T10:30:00Z] Deployment completed
SSHEOF
```

---

### exists

Check if file or directory exists.

**Type:** Query

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  path: string;
}
```

**Output:**
```typescript
boolean
```

**Example Usage:**
```typescript
const exists = await trpc.ssh.exists.useQuery({
  projectId: 1,
  configAlias: 'production',
  path: '/var/www/app/config.json',
});

if (!exists) {
  // Create config file
}
```

**Remote Command:**
```bash
test -e "/var/www/app/config.json" && echo "exists" || echo "not_exists"
```

---

### listDir

List directory contents.

**Type:** Query

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  path: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  files?: string[];             // Array of file listing lines
  stderr?: string;
  message?: string;
}
```

**Example Usage:**
```typescript
const result = await trpc.ssh.listDir.useQuery({
  projectId: 1,
  configAlias: 'production',
  path: '/var/www/app/releases',
});

console.log(result.files);
// [
//   'drwxr-xr-x 5 deploy deploy 4096 Jan 15 10:30 2024-01',
//   'drwxr-xr-x 5 deploy deploy 4096 Jan 14 09:15 2024-01-14',
//   ...
// ]
```

**Remote Command:**
```bash
ls -la "/var/www/app/releases"
```

---

### stat

Get file/directory information.

**Type:** Query

**Input:**
```typescript
{
  // Account Resolution
  accountName?: string;
  projectId?: number;
  configAlias?: string;

  // Operation Parameters
  path: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  stats?: string;               // Output from stat command
  stderr?: string;
  message?: string;
}
```

**Example Usage:**
```typescript
const result = await trpc.ssh.stat.useQuery({
  projectId: 1,
  configAlias: 'production',
  path: '/var/www/app/current',
});

console.log(result.stats);
// File: /var/www/app/current -> /var/www/app/releases/2024-01
// Size: 4096  Blocks: 8  IO Block: 4096  symbolic link
// ...
```

**Remote Command:**
```bash
stat "/var/www/app/current"
```

---

## Error Handling

All operations include automatic retry and error notification based on configuration.

### Error Response Format

```typescript
{
  success: false,
  stderr: "Permission denied",
  message: "SSH copy failed: Permission denied",
  executionTime: 123
}
```

### Retry Behavior

```typescript
// Configured per project/account
{
  maxRetries: 3,
  retryDelay: 1000,  // ms, exponential backoff
}

// Retry sequence:
// Attempt 1: immediate
// Attempt 2: wait 1000ms
// Attempt 3: wait 2000ms
// Attempt 4: wait 4000ms
// If all fail: log error + send notification
```

### Error Notification

When all retries fail:

1. **Log to database** (`ssh_operation_logs`)
2. **Send email** (via BullMQ EMAIL queue)
3. **Execute custom handler** (if configured)

Email format:
```
Subject: SSH Operation Failed: copy

SSH Operation Failed

Project: My Project
Account: prod-web-01
Host: web1.example.com:22
Operation: copy

Error Details:
SSH copy failed: Permission denied

STDERR:
cp: cannot create regular file '/var/www/app/file.txt': Permission denied

Execution Time: 123ms
Timestamp: 2024-01-15T10:30:00.000Z
```

## Usage Patterns

### Pattern 1: Project-based Operations (RECOMMENDED)

```typescript
// In a React component - using project context
const copyFile = trpc.ssh.copy.useMutation();
const createDir = trpc.ssh.mkdir.useMutation();

const handleDeploy = async (projectId: number) => {
  // All operations use the project's 'production' config
  await createDir.mutateAsync({
    projectId,
    configAlias: 'production',
    path: '/var/www/app/releases/v1.0.0',
    recursive: true,
  });

  await copyFile.mutateAsync({
    projectId,
    configAlias: 'production',
    source: '/tmp/bundle.js',
    dest: '/var/www/app/releases/v1.0.0/bundle.js',
  });
};
```

### Pattern 2: Multi-Environment Deployment

```typescript
// Deploy to multiple environments using config aliases
async function deployToEnvironments(projectId: number, version: string) {
  const environments = ['staging', 'production'];

  for (const env of environments) {
    // Create release directory
    await trpc.ssh.mkdir.mutate({
      projectId,
      configAlias: env,
      path: `/var/www/app/releases/${version}`,
      recursive: true,
    });

    // Copy files
    await trpc.ssh.copy.mutate({
      projectId,
      configAlias: env,
      source: '/tmp/bundle.js',
      dest: `/var/www/app/releases/${version}/bundle.js`,
    });

    // Update symlink
    await trpc.ssh.symlink.mutate({
      projectId,
      configAlias: env,
      target: `/var/www/app/releases/${version}`,
      linkPath: '/var/www/app/current',
    });
  }
}
```

### Pattern 3: OO-style Project Wrapper

```typescript
// Project-aware helper class
class ProjectSSH {
  constructor(
    private projectId: number,
    private configAlias: string,
    private trpc: any
  ) {}

  async copy(source: string, dest: string) {
    return this.trpc.ssh.copy.mutate({
      projectId: this.projectId,
      configAlias: this.configAlias,
      source,
      dest,
    });
  }

  async mkdir(path: string, recursive = true) {
    return this.trpc.ssh.mkdir.mutate({
      projectId: this.projectId,
      configAlias: this.configAlias,
      path,
      recursive,
    });
  }

  async deploy(version: string) {
    const releasePath = `/var/www/app/releases/${version}`;
    await this.mkdir(releasePath);
    await this.copy('/tmp/bundle.js', `${releasePath}/bundle.js`);
    await this.trpc.ssh.symlink.mutate({
      projectId: this.projectId,
      configAlias: this.configAlias,
      target: releasePath,
      linkPath: '/var/www/app/current',
    });
  }
}

// Usage
const prodSSH = new ProjectSSH(1, 'production', trpc);
await prodSSH.deploy('v1.0.0');

const stagingSSH = new ProjectSSH(1, 'staging', trpc);
await stagingSSH.deploy('v1.0.0');
```

### Pattern 4: Using Default Project Account

```typescript
// When project has isDefault=true account configured
async function quickDeploy(projectId: number) {
  // No configAlias needed - uses default account
  await trpc.ssh.copy.mutate({
    projectId,  // Automatically resolves to isDefault account
    source: '/tmp/file.txt',
    dest: '/var/www/app/file.txt',
  });
}
```

### Pattern 5: Direct Account Name (Legacy/Admin)

```typescript
// Still supported for admin operations or scripts
// that need to operate across projects
async function adminOperation() {
  await trpc.ssh.copy.mutate({
    accountName: 'prod-web-01',  // Direct account reference
    source: '/tmp/file.txt',
    dest: '/var/www/app/file.txt',
  });
}
```

### Pattern 6: Server-side Orchestration

```typescript
// app/api/deploy/route.ts
import { sshRouter } from '@/server/routers/ssh';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  const { projectId, environment, version } = await request.json();
  const caller = sshRouter.createCaller({ db });

  // Complex deployment workflow using project context
  await caller.mkdir({
    projectId,
    configAlias: environment,
    path: `/var/www/app/releases/${version}`,
    recursive: true,
  });

  await caller.copy({
    projectId,
    configAlias: environment,
    source: '/tmp/bundle.js',
    dest: `/var/www/app/releases/${version}/bundle.js`,
  });

  await caller.symlink({
    projectId,
    configAlias: environment,
    target: `/var/www/app/releases/${version}`,
    linkPath: '/var/www/app/current',
  });

  return Response.json({ success: true });
}
```

## Next Steps

- [SSH Architecture](./SSH_architecture.md)
- [SSH Database Schema](./SSH_database.md)
- [SSH Security](./SSH_SECURITY.md)
- [SSH Implementation Plan](./SSH_IMPLEMENTATION.md)
