# SSH Remote Operations - Design Documentation

## Overview

This directory contains comprehensive design documentation for the SSH remote operations feature integrated into the lightweight-web-seed stack.

The SSH remote operations system provides transparent, type-safe remote file operations via tRPC with connection pooling, automatic retry, error handling, and audit logging.

## Quick Start

For developers new to this feature, we recommend reading the documentation in this order:

1. **[Architecture](./SSH_ARCHITECTURE.md)** - System overview and design goals
2. **[Database Schema](./SSH_DATABASE.md)** - Data model and relationships
3. **[API Design](./SSH_API.md)** - tRPC endpoints and usage patterns
4. **[Security](./SSH_SECURITY.md)** - Security measures and best practices
5. **[Implementation Plan](./SSH_IMPLEMENTATION.md)** - Step-by-step implementation guide

## Documentation Index

### 📐 SSH_ARCHITECTURE.md
**What it covers:**
- System architecture diagrams
- Request flow diagrams
- Connection pool lifecycle
- Technology stack
- Component breakdown

**Read this when:**
- Starting implementation
- Understanding system design
- Reviewing technical approach

---

### 🗄️ SSH_DATABASE.md
**What it covers:**
- Database schema with all tables
- Entity relationships
- AES encryption details
- Migration strategy
- Sample queries
- Data retention policies

**Read this when:**
- Setting up database schema
- Understanding data model
- Writing database queries
- Planning migrations

---

### 🚀 SSH_API.md
**What it covers:**
- Complete tRPC API reference
- All endpoint specifications
- Input/output types
- Usage examples
- Error handling
- Usage patterns (direct, OO-style, server-side)

**Read this when:**
- Using SSH operations in code
- Building new features
- Understanding API contracts
- Troubleshooting API issues

---

### 🔐 SSH_SECURITY.md
**What it covers:**
- Security layers (6 layers)
- Credential encryption
- Authentication & authorization
- Input validation
- Common vulnerabilities & mitigations
- Incident response
- Compliance considerations

**Read this when:**
- Implementing security measures
- Conducting security reviews
- Responding to incidents
- Ensuring compliance

---

### 📋 SSH_IMPLEMENTATION.md
**What it covers:**
- Step-by-step implementation plan
- Code templates for all components
- Testing strategy
- Production deployment checklist
- Timeline estimates
- Rollback procedures

**Read this when:**
- Starting implementation
- Tracking implementation progress
- Deploying to production
- Planning sprints

---

## Feature Highlights

### ✨ Key Features

1. **Transparent API**
   - Simple function calls: `trpc.ssh.copy(...)`
   - No SSH complexity exposed to developers

2. **Type Safety**
   - Full TypeScript support
   - Zod validation for all inputs
   - End-to-end type safety via tRPC

3. **Connection Pooling**
   - Automatic connection reuse
   - Efficient resource management
   - Idle connection cleanup

4. **Error Handling**
   - Automatic retry with exponential backoff
   - Email notifications on failure
   - Custom error handlers supported

5. **Security**
   - AES-256 encrypted credentials
   - Input validation and sanitization
   - Comprehensive audit logging

6. **Multi-tenancy**
   - Multiple SSH accounts per project
   - Project-specific configurations
   - Globally unique account names

## Example Usage

### Basic File Operations

```typescript
// Create directory
await trpc.ssh.mkdir.mutate({
  accountName: 'prod-web-01',
  path: '/var/www/app/releases/v1.0.0',
  recursive: true,
});

// Copy file
await trpc.ssh.copy.mutate({
  accountName: 'prod-web-01',
  source: '/tmp/app.js',
  dest: '/var/www/app/releases/v1.0.0/app.js',
});

// Create symlink
await trpc.ssh.symlink.mutate({
  accountName: 'prod-web-01',
  target: '/var/www/app/releases/v1.0.0',
  linkPath: '/var/www/app/current',
});

// Read file
const result = await trpc.ssh.readFile.useQuery({
  accountName: 'prod-web-01',
  path: '/var/www/app/config.json',
});
```

### OO-Style Wrapper

```typescript
class RemoteConnection {
  constructor(private accountName: string, private trpc: any) {}

  async mkdir(path: string) {
    return this.trpc.ssh.mkdir.mutate({
      accountName: this.accountName,
      path,
      recursive: true,
    });
  }

  async copy(source: string, dest: string) {
    return this.trpc.ssh.copy.mutate({
      accountName: this.accountName,
      source,
      dest,
    });
  }
}

// Usage
const remote = new RemoteConnection('prod-web-01', trpc);
await remote.mkdir('/var/www/app');
await remote.copy('/tmp/file.txt', '/var/www/app/file.txt');
```

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                  Client Application                     │
│  trpc.ssh.copy() / trpc.sshConfig.createAccount()      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    tRPC Layer                           │
│  SSH Router          │     SSH Config Router            │
│  - copy()            │     - createAccount()            │
│  - mkdir()           │     - linkToProject()            │
│  - readFile()        │     - setErrorNotification()     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                 Service Layer                           │
│  Connection Pool  │  File Operations  │  Error Notifier │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  Data Layer                             │
│  PostgreSQL          │  Redis           │  Remote SSH   │
│  (Credentials,Logs)  │  (Queue)         │  (Operations) │
└─────────────────────────────────────────────────────────┘
```

## Database Schema Overview

**Core Tables:**

1. **ssh_accounts** - Store SSH credentials (encrypted)
   - Globally unique account names
   - Support password and key-based auth
   - Connection settings and metadata

2. **project_ssh_configs** - Link projects to SSH accounts
   - Many-to-many relationship
   - Configuration aliases (e.g., "production", "staging")
   - Project-specific overrides

3. **ssh_operation_logs** - Audit trail
   - All operations logged
   - Success/failure tracking
   - Execution metrics

4. **ssh_error_notifications** - Error handling config
   - Email notification settings
   - Retry configuration
   - Custom handler support

## API Overview

### SSH Configuration (sshConfig.*)

- `createAccount()` - Create new SSH account
- `listAccounts()` - List all accounts
- `linkToProject()` - Link account to project
- `getProjectConfigs()` - Get project's SSH configs
- `setErrorNotification()` - Configure error handling

### SSH Operations (ssh.*)

**File Operations:**
- `copy()`, `move()`, `remove()`

**Directory Operations:**
- `mkdir()`, `listDir()`

**Link Operations:**
- `symlink()`, `hardlink()`

**File Content:**
- `readFile()`, `writeFile()`, `appendFile()`

**File Metadata:**
- `touch()`, `chmod()`, `chown()`, `stat()`, `exists()`

## Security Highlights

### 6 Security Layers

1. **Network** - SSH encrypted tunnel
2. **Authentication** - JWT tokens required
3. **Credential Encryption** - AES-256-CBC
4. **Input Validation** - Zod schemas, path sanitization
5. **Connection Security** - Pool management, timeouts
6. **Audit Logging** - Complete operation history

### Best Practices

✅ Use SSH keys over passwords
✅ Store encryption key in secret manager
✅ Enable audit logging
✅ Configure error notifications
✅ Regular security reviews
✅ Monitor for suspicious patterns

## Implementation Phases

**Phase 1:** Foundation (1 week)
- Dependencies, types, encryption, database

**Phase 2:** SSH Services (1 week)
- Connection pool, file operations, notifications

**Phase 3:** API Layer (1 week)
- tRPC routers and integration

**Phase 4:** Testing & Docs (1 week)
- Tests, examples, production deployment

## Getting Started with Implementation

1. Read [Implementation Plan](./SSH_IMPLEMENTATION.md)
2. Install dependencies: `npm install node-ssh ssh2`
3. Generate encryption key (see implementation plan)
4. Follow phase-by-phase implementation
5. Run tests at each phase
6. Deploy to production with checklist

## Contributing

When adding new features:

1. Update relevant design documents
2. Add API documentation with examples
3. Update security considerations
4. Add tests
5. Update implementation checklist

## Related Documentation

- [Main Architecture](./ARCHITECTURE.md)
- [Database Guide](./DATABASE.md)
- [API Documentation](./API.md)
- [Authentication](./AUTHENTICATION.md)

## Questions?

- Check the design documents for detailed information
- Review code examples in SSH_API.md
- Consult security guidelines in SSH_SECURITY.md
- Follow implementation plan for step-by-step guidance

---

**Last Updated:** 2025-10-21
**Version:** 1.0
**Status:** Design Complete, Ready for Implementation
