# SSH Security Guide

## Overview

This document outlines the security measures, best practices, and considerations for the SSH remote operations system.

## Security Layers

### Layer 1: Network Security

```
┌─────────────────────────────────────────────────────────┐
│                  Network Layer Security                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Client Application                                     │
│       │                                                 │
│       │ HTTPS (TLS 1.2+)                               │
│       ▼                                                 │
│  Next.js Server (port 3000)                            │
│       │                                                 │
│       │ SSH Protocol (encrypted tunnel)                │
│       ▼                                                 │
│  Remote SSH Server (port 22 or custom)                 │
│       │                                                 │
│       │ - Public key authentication (preferred)        │
│       │ - Password authentication (with strong policy) │
│       │ - SSH key passphrase protection                │
│       │                                                 │
└─────────────────────────────────────────────────────────┘
```

**Best Practices:**
- Use SSH key-based authentication over passwords
- Disable root login on remote servers
- Use non-standard SSH ports when possible
- Implement IP whitelisting on remote servers
- Use fail2ban or similar brute-force protection

### Layer 2: Authentication & Authorization

```
┌─────────────────────────────────────────────────────────┐
│           Application Authentication Layer              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. User Authentication (LDAP or Email/Password)        │
│     - JWT token issued on successful login             │
│     - Token stored in httpOnly cookie                  │
│                                                         │
│  2. tRPC Request Authorization                          │
│     - JWT token verified in tRPC context               │
│     - User identity attached to request context        │
│                                                         │
│  3. Resource Authorization (Future Enhancement)         │
│     - Check user permissions for SSH operations        │
│     - Verify project membership                        │
│     - Role-based access control (RBAC)                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// lib/trpc/context.ts
export async function createContext({ req }: { req: Request }) {
  // Extract JWT token from request
  const token = extractToken(req);

  // Verify token
  const user = token ? await verifyToken(token) : null;

  return {
    db,
    user, // Available in all procedures
  };
}

// server/routers/ssh.ts - Protected procedure example
const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Use in SSH operations
export const sshRouter = router({
  copy: protectedProcedure
    .input(copySchema)
    .mutation(async ({ input, ctx }) => {
      // ctx.user is guaranteed to exist
      // Check if user has permission for this SSH account/project
      await verifyUserPermission(ctx.user.id, input.accountName);

      // Execute operation
      return executeSSHOperation(...);
    }),
});
```

### Layer 3: Credential Encryption

```
┌─────────────────────────────────────────────────────────┐
│              Credential Encryption Layer                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Algorithm: AES-256-CBC                                 │
│  Key Size: 256 bits (32 bytes)                         │
│  IV: Random 16 bytes per encryption                    │
│                                                         │
│  Encrypted Format:                                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │ IV (16 bytes) : Encrypted Data (variable length) │   │
│  │   (hex)       :        (hex)                      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Storage:                                               │
│  - Encryption key in environment variable              │
│  - Never commit key to version control                 │
│  - Rotate key periodically                             │
│  - Use secret management service in production         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Management:**

```bash
# Generate encryption key (do this ONCE)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output: 64-character hex string
# Example: a1b2c3d4e5f6...

# Add to .env (NEVER commit this file)
SSH_ENCRYPTION_KEY=your_generated_key_here

# For production, use secret management:
# - AWS Secrets Manager
# - HashiCorp Vault
# - Azure Key Vault
# - Google Secret Manager
```

**Encryption Implementation:**

```typescript
// lib/crypto/aes.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.SSH_ENCRYPTION_KEY!;

export class AESCrypto {
  static encrypt(text: string): string {
    // Validate encryption key
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
      throw new Error('Invalid encryption key');
    }

    // Generate random IV
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');

    // Encrypt
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedText: string): string {
    // Split IV and data
    const [ivHex, encryptedData] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');

    // Decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

**Key Rotation:**

```typescript
// scripts/rotate-encryption-key.ts
import { db } from '@/lib/db';
import { sshAccounts } from '@/lib/db/schema';
import { AESCrypto } from '@/lib/crypto/aes';

async function rotateEncryptionKey(newKey: string) {
  const oldKey = process.env.SSH_ENCRYPTION_KEY;

  // Get all accounts
  const accounts = await db.select().from(sshAccounts);

  // Re-encrypt with new key
  for (const account of accounts) {
    // Decrypt with old key
    const oldCrypto = new AESCrypto(oldKey);
    const password = account.encryptedPassword
      ? oldCrypto.decrypt(account.encryptedPassword)
      : null;

    // Encrypt with new key
    const newCrypto = new AESCrypto(newKey);
    const newEncrypted = password ? newCrypto.encrypt(password) : null;

    // Update database
    await db.update(sshAccounts)
      .set({ encryptedPassword: newEncrypted })
      .where(eq(sshAccounts.id, account.id));
  }

  console.log(`Rotated encryption key for ${accounts.length} accounts`);
}
```

### Layer 4: Input Validation

```
┌─────────────────────────────────────────────────────────┐
│              Input Validation Layer                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Threat: Command Injection                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Malicious input:                                   │ │
│  │   path = "/tmp; rm -rf /"                         │ │
│  │                                                    │ │
│  │ Prevention:                                        │ │
│  │   1. Zod schema validation                        │ │
│  │   2. Escape special characters                    │ │
│  │   3. Use double quotes around paths               │ │
│  │   4. Avoid shell execution when possible          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  Threat: Path Traversal                                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Malicious input:                                   │ │
│  │   path = "../../etc/passwd"                       │ │
│  │                                                    │ │
│  │ Prevention:                                        │ │
│  │   1. Validate path format                         │ │
│  │   2. Disallow .. in paths                         │ │
│  │   3. Use absolute paths only                      │ │
│  │   4. Implement path whitelist (basePath)          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Validation Implementation:**

```typescript
// server/routers/ssh.ts
import { z } from 'zod';

// Path validation schema
const pathSchema = z.string()
  .min(1)
  .max(1000)
  .refine((path) => {
    // Reject paths with ..
    if (path.includes('..')) {
      return false;
    }
    // Require absolute paths
    if (!path.startsWith('/')) {
      return false;
    }
    // Reject dangerous characters
    const dangerous = [';', '|', '&', '$', '`', '\n', '\r'];
    return !dangerous.some(char => path.includes(char));
  }, {
    message: 'Invalid path: must be absolute and not contain dangerous characters'
  });

// Operation input validation
const copySchema = z.object({
  accountName: z.string().min(1).max(255),
  projectId: z.number().optional(),
  source: pathSchema,
  dest: pathSchema,
});

// Escape function for shell commands
function escapeShellArg(arg: string): string {
  // Already validated by Zod, but add extra safety
  return arg.replace(/["\\]/g, '\\$&');
}

// Execute with proper escaping
async function executeCopy(source: string, dest: string, ssh: NodeSSH) {
  const escapedSource = escapeShellArg(source);
  const escapedDest = escapeShellArg(dest);

  // Use double quotes to prevent word splitting
  const command = `cp "${escapedSource}" "${escapedDest}"`;

  return ssh.execCommand(command);
}
```

### Layer 5: Connection Security

```
┌─────────────────────────────────────────────────────────┐
│           SSH Connection Security Layer                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Connection Pool Management:                            │
│  ┌────────────────────────────────────────────────────┐ │
│  │ - Maximum idle time: 5 minutes                     │ │
│  │ - Automatic cleanup of stale connections           │ │
│  │ - Connection reuse for efficiency                  │ │
│  │ - Thread-safe acquire/release                      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  SSH Configuration Hardening:                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ - Disable password auth (prefer keys)              │ │
│  │ - Use strong key algorithms (Ed25519, RSA 4096)   │ │
│  │ - Set connection timeout                           │ │
│  │ - Verify host keys                                 │ │
│  │ - Limit concurrent connections                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Secure SSH Configuration:**

```typescript
// lib/ssh/pool.ts
const ssh = new NodeSSH();
await ssh.connect({
  host: account.host,
  port: account.port || 22,
  username: account.username,

  // Prefer key-based auth
  privateKey: account.privateKey,
  passphrase: account.passphrase,

  // Fallback to password (less secure)
  password: account.password,

  // Security settings
  readyTimeout: account.timeout || 30000,
  keepaliveInterval: 10000,
  keepaliveCountMax: 3,

  // Algorithms preference (most secure first)
  algorithms: {
    kex: [
      'curve25519-sha256',
      'diffie-hellman-group-exchange-sha256'
    ],
    cipher: [
      'aes256-gcm@openssh.com',
      'aes256-ctr'
    ],
    hmac: [
      'hmac-sha2-512',
      'hmac-sha2-256'
    ],
  },

  // Host key verification (prevent MITM)
  hostVerifier: (hashedKey) => {
    // In production, verify against known hosts
    // For now, accept all (WARNING: insecure)
    return true;
  },
});
```

### Layer 6: Audit Logging

```
┌─────────────────────────────────────────────────────────┐
│                 Audit Logging Layer                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  What to Log:                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ - Every SSH operation (success and failure)        │ │
│  │ - User who initiated the operation                 │ │
│  │ - Timestamp and execution time                     │ │
│  │ - Operation parameters (paths, etc.)               │ │
│  │ - Command output (stdout/stderr)                   │ │
│  │ - SSH account used                                 │ │
│  │ - Project context                                  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  Log Storage:                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ - PostgreSQL table: ssh_operation_logs             │ │
│  │ - Immutable (no updates/deletes)                   │ │
│  │ - Partitioned by date for performance              │ │
│  │ - Archived after retention period                  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  Monitoring & Alerts:                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │ - Alert on repeated failures                       │ │
│  │ - Monitor for suspicious patterns                  │ │
│  │ - Track unusual operation volumes                  │ │
│  │ - Email notifications for critical errors          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Logging Implementation:**

```typescript
// server/routers/ssh.ts
async function executeWithRetry(
  accountName: string,
  projectId: number | undefined,
  operation: string,
  params: any,
  executor: () => Promise<any>
) {
  const startTime = Date.now();

  try {
    const result = await executor();

    // Log success
    await db.insert(sshOperationLogs).values({
      projectId,
      sshAccountId: account.id,
      operation,
      parameters: params,
      success: true,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      executionTime: Date.now() - startTime,
      createdAt: new Date(),
    });

    return result;
  } catch (error) {
    // Log failure
    await db.insert(sshOperationLogs).values({
      projectId,
      sshAccountId: account.id,
      operation,
      parameters: params,
      success: false,
      stderr: error.message,
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
      createdAt: new Date(),
    });

    throw error;
  }
}
```

## Security Checklist

### Pre-deployment

- [ ] Generate strong encryption key (32 bytes)
- [ ] Store encryption key in secure secret manager
- [ ] Configure JWT authentication
- [ ] Set up HTTPS/TLS for production
- [ ] Review and harden SSH server configurations
- [ ] Implement IP whitelisting on remote servers
- [ ] Configure fail2ban or similar protection
- [ ] Set up monitoring and alerting

### SSH Account Setup

- [ ] Use SSH keys instead of passwords when possible
- [ ] Protect private keys with strong passphrases
- [ ] Use dedicated service accounts (not root)
- [ ] Limit permissions on remote servers (principle of least privilege)
- [ ] Set appropriate base paths to restrict operations
- [ ] Configure connection timeouts
- [ ] Test error notification settings

### Code Security

- [ ] Validate all inputs with Zod schemas
- [ ] Escape shell arguments
- [ ] Use absolute paths only
- [ ] Prevent path traversal attacks
- [ ] Implement rate limiting
- [ ] Add CSRF protection
- [ ] Review audit logs regularly

### Database Security

- [ ] Encrypt database backups
- [ ] Restrict database access
- [ ] Use read-only replicas for queries when possible
- [ ] Implement row-level security if needed
- [ ] Regular security audits of logs

## Common Vulnerabilities & Mitigations

### 1. Command Injection

**Vulnerability:**
```typescript
// DANGEROUS - DO NOT DO THIS
const path = input.path; // User input: "; rm -rf /"
await ssh.execCommand(`rm ${path}`);
// Executes: rm ; rm -rf /
```

**Mitigation:**
```typescript
// SAFE - Use validation and escaping
const pathSchema = z.string().regex(/^\/[a-zA-Z0-9/_-]+$/);
const path = pathSchema.parse(input.path);
await ssh.execCommand(`rm "${path}"`);
```

### 2. Path Traversal

**Vulnerability:**
```typescript
// DANGEROUS
const file = input.file; // User input: "../../etc/passwd"
await ssh.execCommand(`cat /var/www/app/${file}`);
// Accesses: /etc/passwd
```

**Mitigation:**
```typescript
// SAFE
const pathSchema = z.string()
  .refine(p => !p.includes('..') && p.startsWith('/'));
const file = pathSchema.parse(input.file);
```

### 3. Credential Exposure

**Vulnerability:**
```typescript
// DANGEROUS - Exposing credentials to client
export const sshRouter = router({
  getAccount: publicProcedure.query(async () => {
    const account = await db.select().from(sshAccounts);
    // Returns encrypted password to client!
    return account;
  }),
});
```

**Mitigation:**
```typescript
// SAFE - Never send credentials to client
export const sshRouter = router({
  listAccounts: publicProcedure.query(async () => {
    const accounts = await db.select({
      id: sshAccounts.id,
      accountName: sshAccounts.accountName,
      host: sshAccounts.host,
      // Exclude all encrypted fields
    }).from(sshAccounts);
    return accounts;
  }),
});
```

### 4. Insufficient Authorization

**Vulnerability:**
```typescript
// DANGEROUS - Any authenticated user can access any SSH account
export const sshRouter = router({
  copy: publicProcedure.mutation(async ({ input }) => {
    // No permission check!
    return executeSSH(input.accountName);
  }),
});
```

**Mitigation:**
```typescript
// SAFE - Check user permissions
export const sshRouter = router({
  copy: protectedProcedure.mutation(async ({ input, ctx }) => {
    // Verify user has access to this SSH account
    const hasAccess = await verifySSHAccess(
      ctx.user.id,
      input.accountName,
      input.projectId
    );

    if (!hasAccess) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    return executeSSH(input.accountName);
  }),
});
```

## Incident Response

### If Encryption Key is Compromised

1. **Immediate Actions:**
   - Generate new encryption key
   - Rotate all SSH passwords/keys
   - Re-encrypt all credentials with new key
   - Review audit logs for suspicious activity

2. **Investigation:**
   - Determine scope of compromise
   - Check remote servers for unauthorized access
   - Review recent SSH operations

3. **Remediation:**
   - Update all affected credentials
   - Notify affected parties
   - Document incident and lessons learned

### If Unauthorized Access Detected

1. **Immediate Actions:**
   - Disable affected SSH accounts
   - Revoke compromised JWT tokens
   - Block suspicious IP addresses

2. **Investigation:**
   - Review audit logs
   - Check for data exfiltration
   - Identify attack vector

3. **Remediation:**
   - Patch vulnerabilities
   - Reset credentials
   - Implement additional security controls

## Compliance Considerations

### Data Protection
- **GDPR**: Audit logs may contain personal data
- **SOC 2**: Implement access controls and audit trails
- **HIPAA**: Additional encryption for sensitive data

### Audit Requirements
- Retain logs for compliance period
- Implement tamper-evident logging
- Regular security audits

## Next Steps

- [SSH Architecture](./SSH_architecture.md)
- [SSH Database Schema](./SSH_database.md)
- [SSH API Design](./SSH_api.md)
- [SSH Implementation Plan](./SSH_IMPLEMENTATION.md)
