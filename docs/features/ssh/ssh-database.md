# SSH Database Schema

## Overview

This document describes the database schema for SSH remote operations functionality. All tables use Drizzle ORM with PostgreSQL.

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Database Tables                             │
└─────────────────────────────────────────────────────────────────────┘

         ┌──────────────┐
         │   users      │
         │──────────────│
         │ id (PK)      │
         │ name         │
         │ email        │
         └──────────────┘
                │
                │ createdBy (FK)
                │
         ┌──────▼───────────────────────────┐
         │   ssh_accounts                   │
         │──────────────────────────────────│
         │ id (PK)                          │
         │ account_name (UNIQUE)            │◄───────┐
         │ host                             │        │
         │ port                             │        │
         │ username                         │        │
         │ encrypted_password               │        │
         │ encrypted_private_key            │        │
         │ encrypted_passphrase             │        │
         │ auth_method                      │        │
         │ base_path                        │        │
         │ timeout                          │        │
         │ description                      │        │
         │ created_by (FK → users.id)       │        │
         │ created_at                       │        │
         │ updated_at                       │        │
         │ is_active                        │        │
         └──────────────┬───────────────────┘        │
                        │                            │
                        │ ssh_account_id (FK)        │
                        │                            │
         ┌──────────────┴───────────────────┐        │
         │   project_ssh_configs            │        │
         │──────────────────────────────────│        │
         │ id (PK)                          │        │
         │ project_id (FK → projects.id)    │        │
         │ ssh_account_id (FK)              │────────┘
         │ config_alias                     │
         │ override_base_path               │
         │ created_at                       │
         │ is_default                       │
         │ UNIQUE(project_id, config_alias) │
         └──────────────┬───────────────────┘
                        │
                        │ project_id (FK)
                        │
                 ┌──────▼──────┐
                 │  projects   │
                 │─────────────│
                 │ id (PK)     │
                 │ name        │
                 │ owner_id    │
                 └─────────────┘


         ┌──────────────────────────────────┐
         │   ssh_operation_logs             │
         │──────────────────────────────────│
         │ id (PK)                          │
         │ project_id (FK → projects.id)    │
         │ ssh_account_id (FK)              │
         │ operation                        │
         │ parameters (JSONB)               │
         │ success                          │
         │ stdout                           │
         │ stderr                           │
         │ error_message                    │
         │ execution_time                   │
         │ created_at                       │
         └──────────────────────────────────┘


         ┌──────────────────────────────────┐
         │   ssh_error_notifications        │
         │──────────────────────────────────│
         │ id (PK)                          │
         │ project_id (FK → projects.id)    │
         │ ssh_account_id (FK)              │
         │ notify_on_error                  │
         │ email_addresses                  │
         │ custom_handler                   │
         │ custom_handler_config (JSONB)    │
         │ max_retries                      │
         │ retry_delay                      │
         │ created_at                       │
         │ updated_at                       │
         │ UNIQUE(project_id, ssh_account_id)│
         └──────────────────────────────────┘
```

## Table Definitions

### 1. ssh_accounts

Stores SSH account credentials with AES-256 encryption. Account names are globally unique across the system.

```typescript
{
  id: serial (primary key),
  account_name: varchar(255) NOT NULL UNIQUE,  // Globally unique identifier
  host: varchar(255) NOT NULL,
  port: integer NOT NULL DEFAULT 22,
  username: varchar(255) NOT NULL,

  // Encrypted credentials (AES-256-CBC)
  encrypted_password: text NULL,              // For password auth
  encrypted_private_key: text NULL,           // For key-based auth
  encrypted_passphrase: text NULL,            // For encrypted keys

  auth_method: varchar(50) NOT NULL,          // 'password' | 'privateKey'

  // Connection settings
  base_path: varchar(500) NULL,               // Default remote directory
  timeout: integer DEFAULT 30000,             // Connection timeout (ms)

  // Metadata
  description: text NULL,
  created_by: integer (FK → users.id) NULL,
  created_at: timestamp NOT NULL DEFAULT now(),
  updated_at: timestamp NOT NULL DEFAULT now(),
  is_active: boolean NOT NULL DEFAULT true
}
```

**Indexes:**
- Primary key on `id`
- Unique index on `account_name`
- Index on `host` for searching by host
- Index on `is_active` for filtering active accounts

**Example Records:**
```sql
-- Production web server
INSERT INTO ssh_accounts VALUES (
  1,
  'prod-web-01',
  'web1.example.com',
  22,
  'deploy',
  'encrypted_password_here',
  NULL,
  NULL,
  'password',
  '/var/www/app',
  30000,
  'Production web server 1',
  1,  -- created by user 1
  NOW(),
  NOW(),
  true
);

-- Staging server with key auth
INSERT INTO ssh_accounts VALUES (
  2,
  'staging-web',
  'staging.example.com',
  2222,
  'deploy',
  NULL,
  'encrypted_private_key_here',
  'encrypted_passphrase_here',
  'privateKey',
  '/home/deploy/app',
  30000,
  'Staging environment',
  1,
  NOW(),
  NOW(),
  true
);
```

### 2. project_ssh_configs

Links projects to SSH accounts with optional configuration overrides. Each project can have multiple SSH configurations with unique aliases.

```typescript
{
  id: serial (primary key),
  project_id: integer NOT NULL (FK → projects.id, CASCADE),
  ssh_account_id: integer NOT NULL (FK → ssh_accounts.id, CASCADE),

  config_alias: varchar(100) NOT NULL,        // e.g., 'production', 'staging', 'backup'
  override_base_path: varchar(500) NULL,      // Project-specific path override

  created_at: timestamp NOT NULL DEFAULT now(),
  is_default: boolean NOT NULL DEFAULT false, // One default per project

  UNIQUE(project_id, config_alias)
}
```

**Indexes:**
- Primary key on `id`
- Unique index on `(project_id, config_alias)`
- Index on `project_id` for project lookups
- Index on `ssh_account_id` for account lookups

**Example Records:**
```sql
-- Project 1 has multiple environments
INSERT INTO project_ssh_configs VALUES
  (1, 1, 1, 'production', NULL, NOW(), true),      -- Default config
  (2, 1, 2, 'staging', NULL, NOW(), false),
  (3, 1, 3, 'backup', '/var/backups/project1', NOW(), false);

-- Project 2 uses different account
INSERT INTO project_ssh_configs VALUES
  (4, 2, 4, 'production', '/var/www/project2', NOW(), true);
```

**Query Patterns for Account Resolution:**

```typescript
// 1. Get account by direct account name
const [account] = await db
  .select()
  .from(sshAccounts)
  .where(and(
    eq(sshAccounts.accountName, 'prod-web-01'),
    eq(sshAccounts.isActive, true)
  ))
  .limit(1);

// 2. Get account by project + config alias (RECOMMENDED)
const [config] = await db
  .select({
    account: sshAccounts,
    config: projectSshConfigs,
  })
  .from(projectSshConfigs)
  .innerJoin(sshAccounts, eq(projectSshConfigs.sshAccountId, sshAccounts.id))
  .where(and(
    eq(projectSshConfigs.projectId, 1),
    eq(projectSshConfigs.configAlias, 'production'),
    eq(sshAccounts.isActive, true)
  ))
  .limit(1);

// 3. Get default account for project
const [defaultConfig] = await db
  .select({
    account: sshAccounts,
    config: projectSshConfigs,
  })
  .from(projectSshConfigs)
  .innerJoin(sshAccounts, eq(projectSshConfigs.sshAccountId, sshAccounts.id))
  .where(and(
    eq(projectSshConfigs.projectId, 1),
    eq(projectSshConfigs.isDefault, true),
    eq(sshAccounts.isActive, true)
  ))
  .limit(1);

// 4. List all SSH configs for a project
const configs = await db
  .select({
    account: sshAccounts,
    config: projectSshConfigs,
  })
  .from(projectSshConfigs)
  .innerJoin(sshAccounts, eq(projectSshConfigs.sshAccountId, sshAccounts.id))
  .where(and(
    eq(projectSshConfigs.projectId, 1),
    eq(sshAccounts.isActive, true)
  ))
  .orderBy(desc(projectSshConfigs.isDefault));  // Default first
```

**Important Indexes for Performance:**
- Index on `(project_id, config_alias)` for quick alias resolution
- Index on `(project_id, is_default)` for default account lookup
- Index on `account_name` for direct name resolution

### 3. ssh_operation_logs

Audit trail for all SSH operations. Stores parameters, results, and execution metrics.

```typescript
{
  id: serial (primary key),
  project_id: integer NULL (FK → projects.id),      // Optional project context
  ssh_account_id: integer NULL (FK → ssh_accounts.id),

  operation: varchar(100) NOT NULL,                 // 'copy', 'mkdir', 'writeFile', etc.
  parameters: jsonb NULL,                           // Operation parameters as JSON

  success: boolean NOT NULL,
  stdout: text NULL,                                // Command output
  stderr: text NULL,                                // Error output
  error_message: text NULL,                         // Friendly error message
  execution_time: integer NULL,                     // Milliseconds

  created_at: timestamp NOT NULL DEFAULT now()
}
```

**Indexes:**
- Primary key on `id`
- Index on `project_id` for project-specific logs
- Index on `ssh_account_id` for account-specific logs
- Index on `created_at` for time-based queries
- Index on `success` for error analysis
- Index on `operation` for operation-specific queries

**Example Records:**
```sql
-- Successful copy operation
INSERT INTO ssh_operation_logs VALUES (
  1,
  1,              -- project_id
  1,              -- ssh_account_id
  'copy',
  '{"source": "/tmp/file.txt", "dest": "/var/www/app/file.txt"}',
  true,
  '',
  '',
  NULL,
  245,            -- 245ms
  NOW()
);

-- Failed mkdir operation
INSERT INTO ssh_operation_logs VALUES (
  2,
  1,
  1,
  'mkdir',
  '{"path": "/root/restricted", "recursive": true}',
  false,
  '',
  'mkdir: cannot create directory: Permission denied',
  'SSH mkdir failed: Permission denied',
  156,
  NOW()
);
```

**Query Examples:**
```sql
-- Get recent failures for a project
SELECT * FROM ssh_operation_logs
WHERE project_id = 1 AND success = false
ORDER BY created_at DESC
LIMIT 10;

-- Get average execution time by operation
SELECT operation, AVG(execution_time) as avg_time
FROM ssh_operation_logs
WHERE success = true
GROUP BY operation;

-- Get error rate by account
SELECT
  ssh_account_id,
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failures
FROM ssh_operation_logs
GROUP BY ssh_account_id;
```

### 4. ssh_error_notifications

Configuration for error handling and notifications per project/account combination.

```typescript
{
  id: serial (primary key),
  project_id: integer NULL (FK → projects.id, CASCADE),
  ssh_account_id: integer NULL (FK → ssh_accounts.id, CASCADE),

  // Notification settings
  notify_on_error: boolean NOT NULL DEFAULT true,
  email_addresses: text NOT NULL,                   // Comma-separated emails

  // Custom handler (future extensibility)
  custom_handler: varchar(255) NULL,                // Handler function name
  custom_handler_config: jsonb NULL,                // Handler configuration

  // Retry settings
  max_retries: integer NOT NULL DEFAULT 3,
  retry_delay: integer NOT NULL DEFAULT 1000,       // Milliseconds

  created_at: timestamp NOT NULL DEFAULT now(),
  updated_at: timestamp NOT NULL DEFAULT now(),

  UNIQUE(project_id, ssh_account_id)
}
```

**Indexes:**
- Primary key on `id`
- Unique index on `(project_id, ssh_account_id)`
- Index on `project_id`
- Index on `ssh_account_id`

**Example Records:**
```sql
-- Project-specific notification
INSERT INTO ssh_error_notifications VALUES (
  1,
  1,              -- project_id
  1,              -- ssh_account_id
  true,
  'devops@example.com,alerts@example.com',
  NULL,
  NULL,
  3,              -- max retries
  1000,           -- 1 second delay
  NOW(),
  NOW()
);

-- Account-level notification (applies to all projects)
INSERT INTO ssh_error_notifications VALUES (
  2,
  NULL,           -- All projects
  2,              -- Specific account
  true,
  'admin@example.com',
  'slackNotification',  -- Custom handler
  '{"channel": "#ssh-alerts", "webhook": "https://..."}',
  5,
  2000,
  NOW(),
  NOW()
);
```

## Encryption Details

### AES-256-CBC Encryption

**Format:**
```
encrypted_value = IV:ENCRYPTED_DATA
```

**Process:**
```typescript
// Encryption
const iv = crypto.randomBytes(16);                    // Random 16-byte IV
const key = Buffer.from(process.env.SSH_ENCRYPTION_KEY, 'hex');  // 32-byte key
const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
const encrypted = cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex');
const result = iv.toString('hex') + ':' + encrypted;

// Decryption
const [ivHex, encryptedData] = result.split(':');
const iv = Buffer.from(ivHex, 'hex');
const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
const plaintext = decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8');
```

**Environment Setup:**
```bash
# Generate encryption key (run once)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
SSH_ENCRYPTION_KEY=your_64_character_hex_key_here
```

## Relationships

### One-to-Many
- `users` → `ssh_accounts` (created_by)
- `ssh_accounts` → `project_ssh_configs`
- `projects` → `project_ssh_configs`
- `ssh_accounts` → `ssh_operation_logs`
- `projects` → `ssh_operation_logs`

### Many-to-Many
- `projects` ↔ `ssh_accounts` (through `project_ssh_configs`)

### Constraints
- ON DELETE CASCADE for project relationships (deleting project removes configs)
- ON DELETE CASCADE for account relationships (deleting account removes configs)
- UNIQUE constraint on `(project_id, config_alias)` prevents duplicate aliases
- UNIQUE constraint on `(project_id, ssh_account_id)` in notifications

## Migration Strategy

### Development
```bash
# 1. Update schema in lib/db/schema.ts
# 2. Push changes to database
npm run db:push
```

### Production
```bash
# 1. Generate migration
npm run db:generate

# 2. Review migration files in drizzle/ directory

# 3. Apply migration
npm run db:migrate
```

## Data Retention

### Operation Logs
- Recommend partitioning by month for large-scale deployments
- Consider archiving logs older than 90 days

```sql
-- Archive old logs (example)
CREATE TABLE ssh_operation_logs_archive AS
SELECT * FROM ssh_operation_logs
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM ssh_operation_logs
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Inactive Accounts
```sql
-- Find unused accounts
SELECT a.* FROM ssh_accounts a
LEFT JOIN ssh_operation_logs l ON a.id = l.ssh_account_id
WHERE l.id IS NULL
  AND a.created_at < NOW() - INTERVAL '180 days';
```

## Security Considerations

1. **Credential Storage**
   - Never store plaintext passwords
   - Encryption key must be securely managed
   - Rotate encryption keys periodically

2. **Access Control**
   - Implement row-level security if needed
   - Restrict access to ssh_accounts table
   - Audit log access

3. **Audit Trail**
   - Immutable operation logs
   - Track all credential access
   - Monitor for suspicious patterns

## Sample Queries

### Get all SSH configs for a project
```typescript
const configs = await db
  .select({
    config: projectSshConfigs,
    account: {
      id: sshAccounts.id,
      accountName: sshAccounts.accountName,
      host: sshAccounts.host,
      port: sshAccounts.port,
      username: sshAccounts.username,
    },
  })
  .from(projectSshConfigs)
  .innerJoin(sshAccounts, eq(projectSshConfigs.sshAccountId, sshAccounts.id))
  .where(eq(projectSshConfigs.projectId, projectId));
```

### Get decrypted SSH account
```typescript
const [account] = await db
  .select()
  .from(sshAccounts)
  .where(eq(sshAccounts.accountName, 'prod-web-01'));

const decrypted = {
  ...account,
  password: account.encryptedPassword
    ? AESCrypto.decrypt(account.encryptedPassword)
    : undefined,
  privateKey: account.encryptedPrivateKey
    ? AESCrypto.decrypt(account.encryptedPrivateKey)
    : undefined,
};
```

### Get recent operation logs with account info
```typescript
const logs = await db
  .select({
    log: sshOperationLogs,
    account: {
      accountName: sshAccounts.accountName,
      host: sshAccounts.host,
    },
  })
  .from(sshOperationLogs)
  .innerJoin(sshAccounts, eq(sshOperationLogs.sshAccountId, sshAccounts.id))
  .where(eq(sshOperationLogs.projectId, projectId))
  .orderBy(desc(sshOperationLogs.createdAt))
  .limit(50);
```

## Next Steps

- [SSH Architecture](./SSH_architecture.md)
- [SSH API Design](./SSH_api.md)
- [SSH Security](./SSH_SECURITY.md)
- [SSH Implementation Plan](./SSH_IMPLEMENTATION.md)
