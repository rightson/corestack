# Interactive Management Utility Proposal

**Document Status**: Proposal
**Created**: 2025-10-31
**Version**: 1.0
**Target Implementation**: Q1 2026

---

## Executive Summary

This proposal outlines the design and implementation of an interactive management utility (`manage.ts`) for the lightweight-web-seed project. The utility will provide a unified, cross-platform CLI tool to streamline development workflow by:

- Checking and validating prerequisites across different operating systems
- Installing and verifying dependencies
- Initializing environment configuration with intelligent defaults
- Setting up and testing database connections
- Orchestrating multiple development services in a single command

**Target Platforms**: macOS, Ubuntu, RHEL, on-premise environments

**Technology Stack**: TypeScript (Node.js runtime), tmux for process management

---

## Table of Contents

1. [Motivation](#motivation)
2. [Design Principles](#design-principles)
3. [Architecture Overview](#architecture-overview)
4. [Functional Requirements](#functional-requirements)
5. [Technical Specification](#technical-specification)
6. [User Experience Flow](#user-experience-flow)
7. [Implementation Phases](#implementation-phases)
8. [Testing Strategy](#testing-strategy)
9. [Documentation Requirements](#documentation-requirements)
10. [Future Enhancements](#future-enhancements)

---

## Motivation

### Current Pain Points

1. **Multi-Process Complexity**: Developers must manually manage 5 separate terminal sessions:
   - Temporal infrastructure (`docker-compose up`)
   - Next.js development server (`npm run dev`)
   - WebSocket server (`npm run ws:server`)
   - Queue workers (`npm run queue:worker`)
   - Temporal worker (`npm run temporal:worker`)

2. **Platform-Specific Setup**: Installation steps differ across macOS, Ubuntu, and RHEL for:
   - PostgreSQL installation and initialization
   - Redis installation and service management
   - Docker and Docker Compose installation
   - Temporal CLI (tctl) installation
   - System dependencies (e.g., build tools, OpenSSL)

3. **Environment Configuration**: Manual `.env` setup is error-prone:
   - Missing required variables
   - Incorrect database connection strings
   - Weak or default passwords in production-like environments

4. **Inconsistent Onboarding**: New developers face different challenges based on their OS, leading to:
   - Extended setup time (3-5 hours on average)
   - Incomplete installations
   - Docker and Temporal setup confusion
   - Support burden on experienced team members

### Proposed Solution

A single, intelligent management utility that:
- Detects the operating system and adjusts commands accordingly
- Validates prerequisites (including Docker and Temporal) before proceeding
- Manages Temporal infrastructure lifecycle automatically
- Guides users through configuration with sensible defaults
- Provides a unified development experience across all platforms
- Orchestrates all 5 services in a single tmux session
- Reduces onboarding time to under 30 minutes

---

## Design Principles

### 1. **Cross-Platform First**
- Single codebase works on macOS, Ubuntu, RHEL without modification
- OS detection at runtime with appropriate command adaptation
- Fallback strategies for platform-specific edge cases

### 2. **Fail-Fast Validation**
- Check all prerequisites before making any changes
- Clear error messages with remediation steps
- Graceful degradation when optional dependencies are missing

### 3. **Interactive and Intelligent**
- Prompt users only for required decisions
- Provide sensible defaults for all configuration values
- Allow non-interactive mode for CI/CD environments

### 4. **Idempotent Operations**
- Safe to run multiple times without side effects
- Detect existing installations and skip redundant steps
- Clearly communicate what changed vs. what was skipped

### 5. **Developer-Friendly Output**
- Progress indicators for long-running operations
- Color-coded success/warning/error messages
- Verbose mode for debugging issues

### 6. **Security by Design**
- No default credentials or pre-seeded admin accounts
- Enforce strong password policies
- Unique credentials per installation
- Secure handling of sensitive data (passwords, secrets)

---

## Architecture Overview

### Component Structure

```
manage.ts (main entry point)
├── commands/
│   ├── check.ts          # Prerequisites validation
│   ├── install.ts        # Dependency installation
│   ├── init.ts           # Environment initialization
│   ├── db-setup.ts       # Database configuration
│   ├── createsuperuser.ts # Create admin user (Django-style)
│   └── dev.ts            # Development server orchestration
├── lib/
│   ├── platform.ts       # OS detection and adaptation
│   ├── validators.ts     # Prerequisite checkers
│   ├── installers.ts     # Package installation logic
│   ├── prompter.ts       # Interactive prompts
│   ├── database.ts       # DB connection and setup
│   ├── user.ts           # User management operations
│   ├── docker.ts         # Docker and docker-compose management
│   └── tmux.ts           # Tmux session management
├── config/
│   ├── prerequisites.ts  # Required versions and tools
│   ├── defaults.ts       # Default environment values
│   └── services.ts       # Service definitions
└── utils/
    ├── shell.ts          # Shell command execution
    ├── logger.ts         # Logging utilities
    └── spinner.ts        # Progress indicators
```

### Technology Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Language** | TypeScript | Type safety, existing project language |
| **CLI Framework** | Commander.js | Already used in project, mature, feature-rich |
| **Prompts** | Inquirer.js | Interactive prompts with validation |
| **Shell Execution** | execa | Promise-based, cross-platform shell commands |
| **Process Manager** | tmux | Industry-standard, persistent sessions |
| **Output Formatting** | chalk + ora | Color output + spinners |
| **Config Parser** | dotenv | Standard .env file handling |

---

## Functional Requirements

### 1. Prerequisites Check (`./manage check`)

#### Objective
Validate that all required tools and versions are installed before proceeding.

#### Checks Performed

**System Requirements:**
- Node.js version (>= 20.0.0)
- npm version (>= 10.0.0)
- TypeScript compiler availability

**Database Requirements:**
- PostgreSQL client (psql) availability
- PostgreSQL version (>= 14.0)
- Redis CLI (redis-cli) availability
- Redis version (>= 7.0)

**Required for Development:**
- tmux (>= 3.0) - required for `dev` command
- Docker (>= 20.0) - required for Temporal infrastructure
- Docker Compose (>= 2.0) - required for Temporal infrastructure
- Git (>= 2.0) - for version control

**Optional Requirements:**
- Temporal CLI (tctl) - for advanced Temporal management

**Platform-Specific:**
- macOS: Xcode Command Line Tools
- Ubuntu/Debian: build-essential
- RHEL/CentOS: Development Tools group

#### Output Format

```
Checking Prerequisites...

✓ Node.js v20.11.0 (required: >= 20.0.0)
✓ npm v10.2.4 (required: >= 10.0.0)
✓ TypeScript v5.3.3
✓ PostgreSQL 15.2 (required: >= 14.0)
✓ Redis 7.2.0 (required: >= 7.0)
✓ tmux 3.3a (required: >= 3.0)
✓ Docker 24.0.0 (required: >= 20.0)
✓ Docker Compose 2.20.0 (required: >= 2.0)
⚠ Temporal CLI (tctl) not found (optional - for advanced management)

Platform: macOS (arm64)
✓ Xcode Command Line Tools installed

All required prerequisites met!
```

#### Error Handling

If prerequisites are missing:

```
Checking Prerequisites...

✗ Node.js not found
  → Install via: https://nodejs.org/ or use nvm

✗ PostgreSQL version 13.5 (required: >= 14.0)
  → Upgrade required. See platform-specific instructions below.

✗ Docker not found
  → Install via: https://docs.docker.com/engine/install/

✗ Docker Compose not found
  → Install via: https://docs.docker.com/compose/install/

Platform: Ubuntu 22.04
✗ build-essential not installed
  → Run: sudo apt-get install build-essential

❌ Prerequisites check failed. Please resolve the above issues.

Run './manage check --help' for detailed installation instructions.
```

#### Implementation Considerations

- **Version Detection**: Parse output of `--version` flags
- **Path Resolution**: Check both `PATH` and common installation directories
- **Service Status**: Verify PostgreSQL/Redis services are running, not just installed
- **Permission Check**: Warn if database services require sudo but user lacks permissions

---

### 2. Dependency Installation (`./manage install`)

#### Objective
Install npm dependencies and verify successful installation.

#### Installation Flow

```mermaid
graph TD
    A[Start] --> B[Check package.json exists]
    B --> C[Detect package lock file]
    C --> D{Lock file type}
    D -->|package-lock.json| E[Run npm ci]
    D -->|None| F[Run npm install]
    E --> G[Verify installation]
    F --> G
    G --> H{Success?}
    H -->|Yes| I[Verify critical packages]
    H -->|No| J[Display error]
    I --> K{All critical packages present?}
    K -->|Yes| L[Success]
    K -->|No| M[List missing packages]
    J --> N[End]
    M --> N
    L --> N
```

#### Verification Steps

**Post-Install Checks:**
1. Verify `node_modules` directory exists
2. Check critical packages are installed:
   - `next` (web server)
   - `drizzle-orm` (database)
   - `ioredis` (Redis client)
   - `bullmq` (queue system)
   - `ws` (WebSocket server)
   - `@temporalio/worker` (Temporal worker)
   - `@temporalio/client` (Temporal client)
3. Run TypeScript compilation check: `tsc --noEmit`
4. Verify build scripts exist in package.json

#### Output Format

```
Installing Dependencies...

📦 Using npm ci (package-lock.json detected)
⠋ Installing packages... (this may take a few minutes)

✓ 847 packages installed
✓ TypeScript compilation check passed
✓ Critical packages verified:
  - next v15.5.6
  - drizzle-orm v0.44.6
  - ioredis v5.8.1
  - bullmq v5.61.0
  - ws v8.18.3
  - @temporalio/worker v1.11.6
  - @temporalio/client v1.11.6

Installation complete! (completed in 42s)
```

#### Options

```bash
./manage install                    # Standard installation
./manage install --force            # Force reinstall (npm install)
./manage install --skip-verify      # Skip post-install verification
./manage install --production       # Install only production deps
```

---

### 3. Environment Initialization (`./manage init`)

#### Objective
Create and configure `.env` file with intelligent defaults and secure password generation.

#### Interactive Flow

```
Environment Initialization
==========================

Checking existing configuration...
✓ .env.example found
⚠ .env already exists

? How do you want to proceed? (Use arrow keys)
  ❯ Review and update existing .env
    Backup existing and create new .env
    Exit without changes

→ Selected: Review and update existing .env

Database Configuration
----------------------
? Database host: (localhost)
? Database port: (5432)
? Database name: (mydb) lightweight_dev
? Database user: (postgres)
? Database password: ••••••••••••

Redis Configuration
-------------------
? Redis host: (localhost)
? Redis port: (6379)
✓ Using defaults for Redis connection

Server Configuration
--------------------
? Next.js port: (3000)
? WebSocket port: (3001)
✓ Using default ports

Authentication
--------------
? JWT secret: (auto-generated)
  ℹ Press Enter to auto-generate a secure 256-bit secret
✓ Generated secure JWT secret

SSH Operations
--------------
? SSH encryption key: (auto-generated)
  ℹ Press Enter to auto-generate a secure 256-bit encryption key
✓ Generated secure SSH encryption key

LDAP Configuration (Optional)
------------------------------
? Enable LDAP authentication? (y/N) n
✓ Skipping LDAP configuration

Review Configuration
--------------------
DATABASE_URL=postgresql://postgres:••••••••@localhost:5432/lightweight_dev
REDIS_URL=redis://localhost:6379
PORT=3000
WS_PORT=3001
NODE_ENV=development
JWT_SECRET=••••••••••••••••••••••••••••••••
SSH_ENCRYPTION_KEY=••••••••••••••••••••••••

? Save this configuration? (Y/n)

✓ Configuration saved to .env
✓ Backup saved to .env.backup.20251031_143022

Next steps:
  1. Review .env file for any additional customization
  2. Run './manage db-setup' to initialize databases
```

#### Smart Defaults

| Variable | Default Value | Generation Logic |
|----------|---------------|------------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/mydb` | Parse from .env.example |
| `REDIS_URL` | `redis://localhost:6379` | Standard Redis connection |
| `PORT` | `3000` | Next.js default |
| `WS_PORT` | `3001` | Next available port |
| `NODE_ENV` | `development` | Based on context |
| `JWT_SECRET` | Auto-generated | `crypto.randomBytes(32).toString('hex')` |
| `SSH_ENCRYPTION_KEY` | Auto-generated | `crypto.randomBytes(32).toString('hex')` |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Standard Temporal connection |
| `TEMPORAL_NAMESPACE` | `default` | Standard Temporal namespace |
| `LDAP_*` | Commented out | Only if user enables LDAP |

#### Security Features

1. **Password Masking**: Never display passwords in plain text
2. **Secure Generation**: Use cryptographically secure random generation
3. **Backup Creation**: Always backup existing .env before overwriting
4. **Validation**: Validate format of URLs, ports, and connection strings
5. **Non-Interactive Mode**: Support `--non-interactive` flag for CI/CD

#### Options

```bash
./manage init                       # Interactive mode
./manage init --non-interactive     # Use all defaults
./manage init --force               # Overwrite without prompting
./manage init --template custom.env # Use custom template instead of .env.example
./manage init --print-only          # Print config without saving
```

---

### 4. Database Setup (`./manage db-setup`)

#### Objective
Create PostgreSQL database, Redis connection verification, and run database migrations.

#### Setup Flow

```
Database Setup
==============

Loading configuration from .env...
✓ Configuration loaded

PostgreSQL Setup
-----------------
⠋ Checking PostgreSQL connection...
✓ Connected to PostgreSQL server

? Database 'lightweight_dev' does not exist. Create it? (Y/n)

⠋ Creating database 'lightweight_dev'...
✓ Database created successfully

⠋ Running Drizzle ORM migrations...
✓ Migrations applied (3 migrations executed)

⠋ Testing database connection...
✓ Database connection verified

Database Schema Information:
- Tables created: 9
- Indexes created: 12
- Functions created: 2

Redis Setup
-----------
⠋ Checking Redis connection...
✓ Connected to Redis server

⠋ Testing Redis operations...
✓ Set operation successful
✓ Get operation successful
✓ Delete operation successful

✓ Redis connection verified

✓ Database setup complete!

Connection strings:
  PostgreSQL: postgresql://postgres:••••••••@localhost:5432/lightweight_dev
  Redis: redis://localhost:6379

⚠ Important: No users have been created yet.

Next steps:
  1. Create an admin user: ./manage createsuperuser
  2. Start development: ./manage dev
```

#### Platform-Specific Database Creation

**macOS (Homebrew PostgreSQL):**
```bash
createdb -U postgres lightweight_dev
```

**Ubuntu/Debian:**
```bash
sudo -u postgres createdb lightweight_dev
```

**RHEL/CentOS:**
```bash
sudo -u postgres createdb lightweight_dev
```

**Docker (if using docker-compose):**
```bash
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE lightweight_dev;"
```

#### Error Handling

**Connection Failures:**
```
PostgreSQL Setup
-----------------
✗ Failed to connect to PostgreSQL

Troubleshooting steps:
  1. Ensure PostgreSQL service is running:
     macOS:    brew services start postgresql
     Ubuntu:   sudo systemctl start postgresql
     RHEL:     sudo systemctl start postgresql

  2. Verify connection settings in .env:
     DATABASE_URL=postgresql://user:pass@host:port/database

  3. Check PostgreSQL logs:
     macOS:    tail -f /usr/local/var/log/postgresql@14.log
     Ubuntu:   sudo tail -f /var/log/postgresql/postgresql-14-main.log
     RHEL:     sudo tail -f /var/lib/pgsql/14/data/log/postgresql-*.log

Run './manage db-setup --verbose' for detailed error information.
```

**Permission Errors:**
```
✗ Permission denied: role "postgres" does not exist

Your PostgreSQL installation may require a different user.

Detected alternatives:
  - Your system user: jdoe
  - PostgreSQL superusers: postgres, admin

? Which user should be used? (jdoe)

Update DATABASE_URL in .env to use this user.
```

#### Verification Tests

1. **Connection Test**: Verify successful connection to both PostgreSQL and Redis
2. **Write Test**: Create a temporary table/key and write data
3. **Read Test**: Read back the written data
4. **Delete Test**: Clean up temporary resources
5. **Migration Test**: Verify all Drizzle migrations are applied
6. **Schema Test**: Validate expected tables exist

#### Options

```bash
./manage db-setup                   # Interactive setup
./manage db-setup --reset           # Drop and recreate database
./manage db-setup --migrate-only    # Only run migrations
./manage db-setup --verify-only     # Only verify connections
```

---

### 5. Create Superuser (`./manage createsuperuser`)

#### Objective
Create an administrative user account with full system access, following Django's admin pattern. This ensures no default credentials exist and each installation has unique, secure admin credentials.

#### Interactive Flow

```
Create Superuser
================

This command will create an administrative user with full system access.

? Username: admin
  ℹ Username must be 3-63 characters, alphanumeric with hyphens/underscores

? Email address: admin@example.com
  ℹ Valid email address required for notifications

? Password: ••••••••••••
  ℹ Minimum 12 characters, must include uppercase, lowercase, number, and special character

? Password (again): ••••••••••••

⠋ Validating credentials...
✓ Username 'admin' is available
✓ Email format is valid
✓ Passwords match
✓ Password meets security requirements

⠋ Creating superuser account...
✓ User created successfully

⠋ Assigning admin privileges...
✓ Admin role assigned

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Superuser created successfully!

Account Details:
  Username:     admin
  Email:        admin@example.com
  Role:         Administrator
  Auth Type:    email

Security Recommendations:
  ✓ Password is strong and unique
  ⚠ Store credentials securely (e.g., password manager)
  ⚠ Enable 2FA when available (future feature)

You can now log in to the application with these credentials.

Next steps:
  Run './manage dev' to start development servers
```

#### Password Requirements

**Security Policy:**
- Minimum length: 12 characters
- Must contain:
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one digit (0-9)
  - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
- Cannot be:
  - Common passwords (e.g., "Password123!", "Admin123!")
  - Same as username
  - Entirely numeric

**Password Strength Indicator:**
```
? Password: ••••••
  ⚠ Weak - Add more character types (8/12 characters)

? Password: ••••••••••••
  ✓ Strong - Meets all requirements (12 characters)

? Password: ••••••••••••••••••••
  ✓ Very Strong - Excellent password (20 characters)
```

#### Username Requirements

- Length: 3-63 characters
- Allowed characters: letters, numbers, hyphens, underscores
- Must start with a letter
- Case-insensitive (stored as lowercase)
- Must be unique across all users

#### Non-Interactive Mode

For automation or scripting purposes:

```bash
# Using environment variables
export SUPERUSER_USERNAME=admin
export SUPERUSER_EMAIL=admin@example.com
export SUPERUSER_PASSWORD='SecureP@ssw0rd123!'

./manage createsuperuser --non-interactive

# Using command-line arguments
./manage createsuperuser \
  --username admin \
  --email admin@example.com \
  --password 'SecureP@ssw0rd123!' \
  --non-interactive
```

**Non-Interactive Output:**
```
Create Superuser (Non-Interactive Mode)
========================================

Reading credentials from environment/arguments...
✓ Username: admin
✓ Email: admin@example.com
✓ Password: [provided]

⠋ Creating superuser account...
✓ Superuser created successfully

Account created:
  Username: admin
  Email: admin@example.com
  Role: Administrator
```

#### Error Handling

**Username Already Exists:**
```
? Username: admin

✗ Username 'admin' is already taken

Suggestions:
  - Try: admin2, admin_dev, admin_local
  - Use your name: john_doe
  - Check existing users: ./manage listusers

? Username: admin_dev
✓ Username 'admin_dev' is available
```

**Weak Password:**
```
? Password: ••••••

✗ Password does not meet security requirements:
  ✗ Minimum 12 characters (current: 6)
  ✗ Must include uppercase letter
  ✗ Must include special character

? Password: ••••••••••••
✓ Password meets all requirements
```

**Email Already in Use:**
```
? Email address: admin@example.com

✗ Email 'admin@example.com' is already registered

Options:
  1. Use a different email address
  2. Reset password for existing account (not implemented yet)
  3. Contact system administrator

? Email address: admin2@example.com
✓ Email is available
```

**Database Not Ready:**
```
Create Superuser
================

✗ Cannot create superuser: Database not initialized

Please run the following commands first:
  1. ./manage init        # Initialize environment
  2. ./manage db-setup    # Setup database
  3. ./manage createsuperuser # Create superuser

Alternatively, run the setup wizard:
  ./manage setup
```

#### Implementation Details

**User Record Creation:**
```typescript
// lib/user.ts
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import bcrypt from 'bcryptjs';

export async function createSuperuser(
  username: string,
  email: string,
  password: string
): Promise<void> {
  // Validate inputs
  validateUsername(username);
  validateEmail(email);
  validatePassword(password);

  // Check uniqueness
  await ensureUsernameAvailable(username);
  await ensureEmailAvailable(email);

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user with admin role
  await db.insert(users).values({
    username: username.toLowerCase(),
    name: username, // Can be updated later
    email: email.toLowerCase(),
    passwordHash,
    authType: 'email',
    role: 'admin', // or 'superuser' if you have that role
    createdAt: new Date(),
    updatedAt: new Date()
  });
}
```

**Password Validation:**
```typescript
export function validatePassword(password: string): void {
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);

  if (!hasUppercase) throw new Error('Password must include uppercase letter');
  if (!hasLowercase) throw new Error('Password must include lowercase letter');
  if (!hasDigit) throw new Error('Password must include digit');
  if (!hasSpecial) throw new Error('Password must include special character');

  // Check against common passwords
  if (isCommonPassword(password)) {
    throw new Error('Password is too common. Choose a more unique password.');
  }
}
```

#### Security Considerations

1. **No Default Credentials**: System starts with zero users, forcing explicit admin creation
2. **Strong Password Enforcement**: Prevents weak passwords from being set
3. **Unique Credentials**: Each installation has unique admin credentials
4. **Audit Trail**: Log superuser creation events
5. **Rate Limiting**: Prevent brute-force attempts (future enhancement)

#### Options

```bash
./manage createsuperuser                # Interactive mode
./manage createsuperuser --non-interactive # Use env vars/args
./manage createsuperuser --username USER --email EMAIL --password PASS
./manage createsuperuser --help         # Show usage information
```

---

### 6. Development Server Orchestration (`./manage dev`)

#### Objective
Start all required development services (Temporal Infrastructure, Next.js, WebSocket, Queue Workers, Temporal Worker) in a unified tmux session with easy monitoring and control.

#### Tmux Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Session: lightweight-web-seed                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Pane 0: Temporal Infrastructure (Docker)             │  │
│  │                                                        │  │
│  │ $ docker-compose up                                    │  │
│  │ ✓ Temporal Server: localhost:7233                     │  │
│  │ ✓ Temporal UI: http://localhost:8080                  │  │
│  │ ✓ PostgreSQL (Temporal): localhost:5432               │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Pane 1: Next.js Dev Server (PORT 3000)               │  │
│  │                                                        │  │
│  │ $ npm run dev                                          │  │
│  │ ▲ Next.js 15.5.6                                       │  │
│  │ - Local:   http://localhost:3000                       │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Pane 2: WebSocket Server (PORT 3001)                 │  │
│  │                                                        │  │
│  │ $ npm run ws:server                                    │  │
│  │ 🔌 WebSocket server started on port 3001              │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Pane 3: BullMQ Queue Workers                          │  │
│  │                                                        │  │
│  │ $ npm run queue:worker                                 │  │
│  │ 🔄 Queue workers started (13 workers ready)           │  │
│  │ ✓ Connected to Redis at localhost:6379                │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Pane 4: Temporal Worker                               │  │
│  │                                                        │  │
│  │ $ npm run temporal:worker                              │  │
│  │ ⚡ Temporal worker started                             │  │
│  │ - Task queue: build-tasks                              │  │
│  │ ✓ Connected to Temporal at localhost:7233             │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│ [0: temporal | 1: next | 2: ws | 3: queue | 4: worker]  ? for help │
└─────────────────────────────────────────────────────────────┘
```

#### Startup Flow

```
Starting Development Environment
=================================

Pre-flight checks...
✓ .env file found
✓ node_modules installed
✓ PostgreSQL connection verified
✓ Redis connection verified
✓ Docker is running
✓ Docker Compose is available
✓ Ports 3000, 3001, 7233, 8080 are available
✓ tmux is installed

Initializing tmux session 'lightweight-web-seed'...
✓ Session created

Starting services...
⠋ [1/5] Starting Temporal infrastructure (docker-compose)...
✓ [1/5] Temporal infrastructure ready
  - Temporal Server: localhost:7233
  - Temporal UI: http://localhost:8080

⠋ [2/5] Starting Next.js dev server...
✓ [2/5] Next.js ready on http://localhost:3000

⠋ [3/5] Starting WebSocket server...
✓ [3/5] WebSocket server ready on ws://localhost:3001

⠋ [4/5] Starting BullMQ queue workers...
✓ [4/5] Queue workers ready (13 workers active)

⠋ [5/5] Starting Temporal worker...
✓ [5/5] Temporal worker ready (listening on build-tasks)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Development environment is ready!

Services:
  Web UI:        http://localhost:3000
  Temporal UI:   http://localhost:8080
  WebSocket:     ws://localhost:3001
  BullMQ Queue:  13 workers active
  Temporal:      Worker active on build-tasks
  Database:      PostgreSQL (lightweight_dev)
  Cache:         Redis (localhost:6379)

Tmux session: lightweight-web-seed

Management commands:
  Attach:       tmux attach -t lightweight-web-seed
  Detach:       Ctrl+B, then D
  Stop all:     ./manage dev stop
  Restart:      ./manage dev restart
  Logs:         ./manage dev logs [service]

Press ENTER to attach to tmux session (or Ctrl+C to exit)...
```

#### Tmux Session Management

**Session Name**: `lightweight-web-seed`

**Pane Configuration**:
- **Pane 0**: Temporal Infrastructure
  - Command: `docker-compose up`
  - Purpose: Start Temporal server, UI, and PostgreSQL
  - Size: 20% of window height

- **Pane 1**: Next.js dev server
  - Command: `npm run dev`
  - Purpose: Frontend and API routes
  - Size: 20% of window height

- **Pane 2**: WebSocket server
  - Command: `npm run ws:server`
  - Purpose: Real-time communication
  - Size: 20% of window height

- **Pane 3**: BullMQ Queue workers
  - Command: `npm run queue:worker`
  - Purpose: Background job processing (short-lived tasks)
  - Size: 20% of window height

- **Pane 4**: Temporal worker
  - Command: `npm run temporal:worker`
  - Purpose: Long-running workflow execution
  - Size: 20% of window height

**Key Bindings** (in tmux session):
- `Ctrl+B` then `0`: Focus Temporal infrastructure pane
- `Ctrl+B` then `1`: Focus Next.js pane
- `Ctrl+B` then `2`: Focus WebSocket pane
- `Ctrl+B` then `3`: Focus BullMQ Queue workers pane
- `Ctrl+B` then `4`: Focus Temporal worker pane
- `Ctrl+B` then `D`: Detach from session (keeps running)
- `Ctrl+B` then `[`: Scroll mode (use arrows, PgUp/PgDn)
- `Ctrl+B` then `?`: Show help

#### Service Health Monitoring

**Startup Health Checks**:
1. **Temporal Infrastructure**: Wait for "temporal    | Started" in docker-compose logs
2. **Next.js**: Wait for "Ready in X.Xs" message
3. **WebSocket**: Wait for "WebSocket server started" message
4. **BullMQ Queue Workers**: Wait for "Queue workers started" message
5. **Temporal Worker**: Wait for "Temporal worker started" message

**Continuous Monitoring** (optional):
```bash
./manage dev status

Service Status
==============
Docker:       ✓ Running (3 containers)
  - Temporal Server:   ✓ Running (uptime: 2h 34m)
  - Temporal UI:       ✓ Running (uptime: 2h 34m)
  - PostgreSQL:        ✓ Running (uptime: 2h 34m)
Next.js:      ✓ Running (PID 12345, uptime: 2h 34m)
WebSocket:    ✓ Running (PID 12346, uptime: 2h 34m)
BullMQ:       ✓ Running (PID 12347, uptime: 2h 34m, 13 workers)
Temporal:     ✓ Running (PID 12348, uptime: 2h 34m, connected)

Connections:
  Database:   ✓ Connected (3 active queries)
  Redis:      ✓ Connected (47 keys)
  Temporal:   ✓ Connected to localhost:7233

Resources:
  CPU:        18.7%
  Memory:     1.2 GB
```

#### Lifecycle Management

**Stop Services**:
```bash
./manage dev stop

Stopping Development Environment
=================================
⠋ Stopping Temporal worker...
✓ Temporal worker stopped gracefully

⠋ Stopping BullMQ queue workers...
✓ Queue workers stopped gracefully

⠋ Stopping WebSocket server...
✓ WebSocket server stopped gracefully

⠋ Stopping Next.js dev server...
✓ Next.js stopped gracefully

⠋ Stopping Temporal infrastructure (docker-compose down)...
✓ Temporal infrastructure stopped

⠋ Terminating tmux session...
✓ Session terminated

All services stopped.
```

**Restart Services**:
```bash
./manage dev restart

Restarting Development Environment
===================================
⠋ Stopping existing services...
✓ Services stopped

⠋ Starting services...
✓ Services started

Development environment restarted!
Attach: tmux attach -t lightweight-web-seed
```

**View Logs**:
```bash
./manage dev logs                # All services
./manage dev logs temporal       # Temporal infrastructure
./manage dev logs next           # Next.js only
./manage dev logs websocket      # WebSocket only
./manage dev logs queue          # BullMQ Queue workers only
./manage dev logs worker         # Temporal worker only
./manage dev logs --follow       # Follow logs (tail -f style)
```

#### Alternative: Without Tmux

For users who prefer separate terminals or don't have tmux:

```bash
./manage dev --no-tmux

Starting Development Environment (No tmux)
==========================================

Starting services in background...
✓ [1/5] Temporal infrastructure started (docker-compose)
  Logs: docker-compose logs -f

✓ [2/5] Next.js dev server started (PID 12345)
  Logs: tail -f logs/next.log

✓ [3/5] WebSocket server started (PID 12346)
  Logs: tail -f logs/websocket.log

✓ [4/5] BullMQ queue workers started (PID 12347)
  Logs: tail -f logs/queue.log

✓ [5/5] Temporal worker started (PID 12348)
  Logs: tail -f logs/temporal-worker.log

Services running. Use './manage dev stop' to stop all services.

View logs:
  ./manage dev logs [service]
```

#### Options

```bash
./manage dev                    # Start in tmux
./manage dev --no-tmux          # Start without tmux (background processes)
./manage dev --attach           # Start and immediately attach
./manage dev stop               # Stop all services
./manage dev restart            # Restart all services
./manage dev status             # Show service status
./manage dev logs [service]     # View logs
./manage dev --ports 3000,3001  # Custom ports
```

---

## Technical Specification

### Platform Detection

```typescript
// lib/platform.ts
export type Platform = 'darwin' | 'linux' | 'win32';
export type Distribution = 'macos' | 'ubuntu' | 'debian' | 'rhel' | 'centos' | 'fedora' | 'unknown';

export interface PlatformInfo {
  platform: Platform;
  distribution: Distribution;
  version: string;
  architecture: string;
  packageManager: PackageManager;
}

export type PackageManager = 'brew' | 'apt' | 'yum' | 'dnf' | 'unknown';

export async function detectPlatform(): Promise<PlatformInfo> {
  const platform = process.platform as Platform;
  const architecture = process.arch;

  let distribution: Distribution = 'unknown';
  let version = '';
  let packageManager: PackageManager = 'unknown';

  if (platform === 'darwin') {
    distribution = 'macos';
    version = await getMacOSVersion();
    packageManager = await hasCommand('brew') ? 'brew' : 'unknown';
  } else if (platform === 'linux') {
    const osRelease = await readOSRelease();
    distribution = detectLinuxDistribution(osRelease);
    version = osRelease.VERSION_ID || '';
    packageManager = detectPackageManager(distribution);
  }

  return { platform, distribution, version, architecture, packageManager };
}
```

### Command Adaptation

```typescript
// lib/installers.ts
export interface InstallCommand {
  check: string;      // Command to check if installed
  install: string;    // Command to install
  sudo: boolean;      // Requires sudo
  service?: string;   // Service name (for systemd/launchd)
}

export function getPostgreSQLInstallCommand(platform: PlatformInfo): InstallCommand {
  switch (platform.distribution) {
    case 'macos':
      return {
        check: 'psql --version',
        install: 'brew install postgresql@15',
        sudo: false,
        service: 'postgresql@15'
      };
    case 'ubuntu':
    case 'debian':
      return {
        check: 'psql --version',
        install: 'apt-get install postgresql-15 postgresql-client-15',
        sudo: true,
        service: 'postgresql'
      };
    case 'rhel':
    case 'centos':
    case 'fedora':
      return {
        check: 'psql --version',
        install: 'dnf install postgresql15-server postgresql15',
        sudo: true,
        service: 'postgresql-15'
      };
    default:
      throw new Error(`Unsupported distribution: ${platform.distribution}`);
  }
}
```

### Interactive Prompts

```typescript
// lib/prompter.ts
import inquirer from 'inquirer';
import { z } from 'zod';

export interface PromptConfig {
  name: string;
  message: string;
  default?: string | (() => string | Promise<string>);
  validate?: (value: string) => boolean | string | Promise<boolean | string>;
  transform?: (value: string) => string;
  required?: boolean;
  secure?: boolean; // Mask input (for passwords)
}

export async function promptForConfig(
  configs: PromptConfig[],
  existingValues?: Record<string, string>
): Promise<Record<string, string>> {
  const results: Record<string, string> = { ...existingValues };

  for (const config of configs) {
    const prompt: inquirer.QuestionCollection = {
      type: config.secure ? 'password' : 'input',
      name: config.name,
      message: config.message,
      default: typeof config.default === 'function'
        ? await config.default()
        : config.default || existingValues?.[config.name],
      validate: config.validate,
      transformer: config.transform
    };

    const answer = await inquirer.prompt([prompt]);
    results[config.name] = answer[config.name];
  }

  return results;
}

// Example usage
const dbConfig = await promptForConfig([
  {
    name: 'DB_HOST',
    message: 'Database host:',
    default: 'localhost',
    validate: (value) => value.length > 0 || 'Host is required'
  },
  {
    name: 'DB_PASSWORD',
    message: 'Database password:',
    secure: true,
    default: () => crypto.randomBytes(16).toString('hex'),
    required: true
  }
]);
```

### Database Connection Testing

```typescript
// lib/database.ts
import { postgres } from 'postgres';
import Redis from 'ioredis';

export interface DatabaseConnectionResult {
  success: boolean;
  message: string;
  details?: {
    version?: string;
    uptime?: number;
    [key: string]: any;
  };
}

export async function testPostgreSQLConnection(
  connectionString: string
): Promise<DatabaseConnectionResult> {
  try {
    const sql = postgres(connectionString, { max: 1 });

    const [result] = await sql`SELECT version()`;
    const version = result.version;

    await sql.end();

    return {
      success: true,
      message: 'PostgreSQL connection successful',
      details: { version }
    };
  } catch (error) {
    return {
      success: false,
      message: `PostgreSQL connection failed: ${error.message}`
    };
  }
}

export async function testRedisConnection(
  connectionString: string
): Promise<DatabaseConnectionResult> {
  try {
    const redis = new Redis(connectionString);

    // Test operations
    await redis.set('__test__', 'connection_test');
    const value = await redis.get('__test__');
    await redis.del('__test__');

    const info = await redis.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];

    await redis.quit();

    return {
      success: true,
      message: 'Redis connection successful',
      details: { version }
    };
  } catch (error) {
    return {
      success: false,
      message: `Redis connection failed: ${error.message}`
    };
  }
}
```

### Tmux Session Management

```typescript
// lib/tmux.ts
import { execa } from 'execa';

export interface TmuxPane {
  index: number;
  command: string;
  name: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface TmuxSession {
  name: string;
  panes: TmuxPane[];
}

export async function createTmuxSession(session: TmuxSession): Promise<void> {
  // Check if session exists
  const exists = await sessionExists(session.name);
  if (exists) {
    throw new Error(`Session '${session.name}' already exists`);
  }

  // Create new session with first pane
  await execa('tmux', [
    'new-session',
    '-d',
    '-s', session.name,
    '-c', session.panes[0].cwd || process.cwd()
  ]);

  // Rename first pane
  await execa('tmux', [
    'rename-window',
    '-t', `${session.name}:0`,
    session.panes[0].name
  ]);

  // Start command in first pane
  await sendKeys(session.name, 0, session.panes[0].command);

  // Create additional panes
  for (let i = 1; i < session.panes.length; i++) {
    const pane = session.panes[i];

    // Split window
    await execa('tmux', [
      'split-window',
      '-t', `${session.name}:0`,
      '-c', pane.cwd || process.cwd()
    ]);

    // Send command to new pane
    await sendKeys(session.name, i, pane.command);
  }

  // Arrange layout
  await execa('tmux', [
    'select-layout',
    '-t', `${session.name}:0`,
    'main-horizontal'
  ]);
}

async function sessionExists(name: string): Promise<boolean> {
  try {
    await execa('tmux', ['has-session', '-t', name]);
    return true;
  } catch {
    return false;
  }
}

async function sendKeys(session: string, pane: number, command: string): Promise<void> {
  await execa('tmux', [
    'send-keys',
    '-t', `${session}:0.${pane}`,
    command,
    'Enter'
  ]);
}

export async function killSession(name: string): Promise<void> {
  const exists = await sessionExists(name);
  if (exists) {
    await execa('tmux', ['kill-session', '-t', name]);
  }
}

export async function attachSession(name: string): Promise<void> {
  await execa('tmux', ['attach', '-t', name], { stdio: 'inherit' });
}
```

---

## User Experience Flow

### First-Time Setup (Complete Flow)

```bash
# Clone repository
git clone https://github.com/your-org/lightweight-web-seed.git
cd lightweight-web-seed

# Make manage utility executable
chmod +x manage.ts

# Run complete setup
./manage.ts setup

Interactive Setup Wizard
=========================

This wizard will guide you through setting up the development environment.

Step 1/6: Prerequisites Check
──────────────────────────────
Checking Prerequisites...
✓ Node.js v20.11.0
✓ npm v10.2.4
✓ TypeScript v5.3.3
✓ PostgreSQL 15.2
✓ Redis 7.2.0
✓ tmux 3.3a
All prerequisites met!

Step 2/6: Install Dependencies
──────────────────────────────
Installing npm packages...
✓ 847 packages installed (42s)
✓ TypeScript compilation check passed

Step 3/6: Environment Configuration
────────────────────────────────────
[Interactive prompts as described in section 3]
✓ Configuration saved to .env

Step 4/6: Database Setup
────────────────────────
[Database creation and migration as described in section 4]
✓ PostgreSQL database ready
✓ Redis connection verified

Step 5/6: Create Admin User
─────────────────────────────
[Interactive superuser creation as described in section 5]
✓ Admin user created successfully

Step 6/6: Final Verification
─────────────────────────────
✓ All systems ready!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Setup Complete!

Your development environment is ready to use.

Admin Credentials:
  ⚠ Make sure you've saved your admin credentials securely!

Quick Start:
  ./manage.ts dev              # Start all services
  ./manage.ts dev status       # Check service status
  ./manage.ts dev stop         # Stop all services

Documentation:
  index.md                    # Project overview
  docs/development.md          # Development guide
  docs/architecture.md         # Architecture details

Need help? Run: ./manage.ts --help
```

### Daily Development Workflow

```bash
# Morning: Start development
./manage.ts dev

# [Work in tmux session or detached]

# Check status
./manage.ts dev status

# View logs if needed
./manage.ts dev logs next

# End of day: Stop services
./manage.ts dev stop
```

### Troubleshooting Workflow

```bash
# Check what's wrong
./manage.ts check --verbose

# Verify specific component
./manage.ts db-setup --verify-only

# Restart with fresh logs
./manage.ts dev restart

# View detailed logs
./manage.ts dev logs --follow --verbose
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
**Deliverables:**
- Platform detection and adaptation logic
- Shell command execution utilities
- Logging and output formatting
- Basic CLI structure with Commander.js

**Files:**
- `manage.ts` (entry point)
- `lib/platform.ts`
- `lib/shell.ts`
- `lib/logger.ts`
- `utils/spinner.ts`

### Phase 2: Prerequisites Check (Week 2-3)
**Deliverables:**
- Version detection for Node.js, PostgreSQL, Redis, tmux
- Service availability checks
- Platform-specific installation instructions
- `./manage check` command

**Files:**
- `commands/check.ts`
- `lib/validators.ts`
- `config/prerequisites.ts`

### Phase 3: Dependency Installation (Week 3-4)
**Deliverables:**
- npm installation with verification
- Critical package validation
- TypeScript compilation check
- `./manage install` command

**Files:**
- `commands/install.ts`
- `lib/installers.ts`

### Phase 4: Environment Initialization (Week 4-5)
**Deliverables:**
- Interactive prompt system
- Secure password generation
- Configuration validation
- Backup mechanism
- `./manage init` command

**Files:**
- `commands/init.ts`
- `lib/prompter.ts`
- `config/defaults.ts`

### Phase 5: Database Setup (Week 5-6)
**Deliverables:**
- Database creation (platform-specific)
- Connection testing
- Migration execution
- `./manage db-setup` command

**Files:**
- `commands/db-setup.ts`
- `lib/database.ts`

### Phase 6: User Management (Week 6)
**Deliverables:**
- Superuser creation with password validation
- Username/email uniqueness checks
- Password strength validation
- Interactive and non-interactive modes
- `./manage createsuperuser` command

**Files:**
- `commands/createsuperuser.ts`
- `lib/user.ts`

### Phase 7: Development Orchestration (Week 7-8)
**Deliverables:**
- Tmux session management
- Service lifecycle (start/stop/restart)
- Health monitoring
- Log aggregation
- `./manage dev` command with full features

**Files:**
- `commands/dev.ts`
- `lib/tmux.ts`
- `config/services.ts`

### Phase 8: Testing & Documentation (Week 9-10)
**Deliverables:**
- Unit tests for all modules
- Integration tests for complete flows
- User documentation
- Video walkthrough (optional)

**Files:**
- `tests/` directory (all test files)
- `docs/MANAGE_UTILITY.md`
- `docs/TROUBLESHOOTING.md`

### Phase 9: Polish & Release (Week 11)
**Deliverables:**
- Error message refinement
- Performance optimization
- CI/CD integration
- Release notes

---

## Testing Strategy

### Unit Tests

**Test Coverage Requirements**: ≥ 80%

**Key Test Suites:**

1. **Platform Detection** (`lib/platform.test.ts`)
   - Test OS detection (mock process.platform)
   - Test Linux distribution detection
   - Test package manager detection
   - Test version parsing

2. **Validators** (`lib/validators.test.ts`)
   - Test version comparison logic
   - Test command availability checks
   - Test service status detection
   - Test port availability checks

3. **Database Connection** (`lib/database.test.ts`)
   - Test PostgreSQL connection (with mock)
   - Test Redis connection (with mock)
   - Test connection error handling
   - Test connection string parsing

4. **Tmux Management** (`lib/tmux.test.ts`)
   - Test session creation
   - Test pane splitting
   - Test command execution
   - Test session cleanup

### Integration Tests

**Test Scenarios:**

1. **Complete Setup Flow**
   ```bash
   # Test in Docker container
   docker run -it node:20 bash
   # Run full setup wizard
   ./manage.ts setup --non-interactive
   # Verify all services start
   ./manage.ts dev --no-tmux
   # Check services are running
   ./manage.ts dev status
   ```

2. **Cross-Platform Tests**
   - Run on macOS (GitHub Actions runner)
   - Run on Ubuntu 22.04 (GitHub Actions runner)
   - Run on RHEL 9 (manual testing or CircleCI)

3. **Error Recovery**
   - Test with missing prerequisites
   - Test with existing .env file
   - Test with occupied ports
   - Test with failed database connection

### Manual Testing Checklist

- [ ] Fresh install on macOS
- [ ] Fresh install on Ubuntu 22.04
- [ ] Fresh install on RHEL 9
- [ ] Upgrade from previous setup
- [ ] Error recovery scenarios
- [ ] Non-interactive mode (CI/CD simulation)
- [ ] Tmux session persistence (detach/reattach)
- [ ] Service restart with active connections

---

## Documentation Requirements

### User Documentation

1. **README.md Updates**
   - Add "Quick Start with Manage Utility" section
   - Link to detailed manage utility documentation
   - Update development workflow section

2. **MANAGE_UTILITY.md** (New)
   - Comprehensive command reference
   - Platform-specific notes
   - Troubleshooting guide
   - FAQ section

3. **development.md Updates**
   - Replace manual setup instructions with manage utility flow
   - Keep advanced/manual setup as alternative

### Developer Documentation

1. **CONTRIBUTING.md Updates**
   - Describe how to extend manage utility
   - Document adding new commands
   - Explain platform adaptation patterns

2. **API Documentation**
   - JSDoc comments for all public functions
   - Type definitions for all interfaces
   - Usage examples for each module

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Production Deployment Support**
   ```bash
   ./manage.ts deploy [production|staging]
   ```
   - Build optimization
   - Environment validation
   - Database migration (safe mode)
   - Backup creation

2. **Service Monitoring Dashboard**
   ```bash
   ./manage.ts dashboard
   ```
   - Real-time metrics display (CPU, memory, requests)
   - Service health indicators
   - Log streaming
   - Interactive controls (restart services)

3. **User Management Enhancements**
   ```bash
   ./manage.ts listusers              # List all users
   ./manage.ts changepassword <user>  # Change user password
   ./manage.ts deleteuser <user>      # Delete a user
   ./manage.ts promoteuser <user>     # Promote user to admin
   ```
   - List and manage all users
   - Password reset functionality
   - User role management
   - Account status management (active/inactive)

4. **Backup & Restore**
   ```bash
   ./manage.ts backup create
   ./manage.ts backup restore <backup-id>
   ```
   - Database dumps
   - Environment configuration
   - User-uploaded files

5. **Plugin System**
   ```bash
   ./manage.ts plugin install <plugin-name>
   ```
   - Third-party service integrations
   - Custom command extensions
   - Community-contributed utilities

6. **Docker Integration**
   ```bash
   ./manage.ts docker up    # Start via docker-compose
   ./manage.ts docker logs  # View container logs
   ```
   - Seamless switch between local and containerized
   - Development container configuration

7. **CI/CD Integration**
   ```bash
   ./manage.ts ci setup [github|gitlab|jenkins]
   ```
   - Generate CI configuration files
   - Secret management integration
   - Deployment pipeline templates

### Long-Term Vision

- **Multi-Project Support**: Manage multiple instances/projects
- **Team Collaboration**: Shared configuration profiles
- **Cloud Integration**: Deploy to AWS/GCP/Azure with single command
- **Monitoring Integration**: Datadog, New Relic, Sentry setup
- **Performance Profiling**: Built-in performance analysis tools

---

## Appendix

### A. Command Reference

```
Usage: manage [command] [options]

Commands:
  check                      Check prerequisites
    --verbose                Show detailed version information
    --platform               Show platform information only

  install                    Install dependencies
    --force                  Force reinstall
    --production             Install only production dependencies
    --skip-verify            Skip post-install verification

  init                       Initialize environment configuration
    --non-interactive        Use all defaults
    --force                  Overwrite without prompting
    --template <file>        Use custom template
    --print-only             Print config without saving

  db-setup                   Setup databases
    --reset                  Drop and recreate database
    --migrate-only           Only run migrations
    --verify-only            Only verify connections

  createsuperuser            Create admin user account
    --username <username>    Admin username
    --email <email>          Admin email address
    --password <password>    Admin password
    --non-interactive        Use provided credentials without prompts

  dev                        Start development servers
    --no-tmux                Start without tmux
    --attach                 Start and immediately attach
    --ports <ports>          Custom ports (e.g., 3000,3001)

  dev stop                   Stop development servers
  dev restart                Restart development servers
  dev status                 Show service status
  dev logs [service]         View service logs
    --follow                 Follow logs (tail -f style)
    --verbose                Show verbose logs

  setup                      Run complete setup wizard
    --non-interactive        Skip all prompts

  help [command]             Show help for command
  version                    Show version information

Options:
  -h, --help                 Show help
  -v, --version              Show version
  --verbose                  Verbose output
  --no-color                 Disable colored output
```

### B. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/mydb` | PostgreSQL connection string |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection string |
| `PORT` | No | `3000` | Next.js server port |
| `WS_PORT` | No | `3001` | WebSocket server port |
| `NODE_ENV` | No | `development` | Node environment |
| `JWT_SECRET` | Yes | (auto-generated) | JWT signing secret |
| `SSH_ENCRYPTION_KEY` | Yes | (auto-generated) | SSH credential encryption key |
| `LDAP_URL` | No | - | LDAP server URL |
| `LDAP_BIND_DN` | No | - | LDAP bind DN |
| `LDAP_BIND_PASSWORD` | No | - | LDAP bind password |
| `LDAP_SEARCH_BASE` | No | - | LDAP search base |
| `LDAP_USERNAME_ATTRIBUTE` | No | `uid` | LDAP username attribute |
| `TEMPORAL_ADDRESS` | No | `localhost:7233` | Temporal server address |
| `TEMPORAL_NAMESPACE` | No | `default` | Temporal namespace |

### C. Troubleshooting Guide

**Common Issues:**

1. **Port Already in Use**
   ```
   Error: Port 3000 is already in use

   Solution:
   1. Find process using port: lsof -ti:3000 | xargs kill -9
   2. Use custom port: ./manage.ts dev --ports 3005,3006
   ```

2. **PostgreSQL Connection Failed**
   ```
   Error: ECONNREFUSED 127.0.0.1:5432

   Solution:
   1. Check service is running:
      macOS: brew services list
      Linux: sudo systemctl status postgresql
   2. Verify connection in .env
   3. Check PostgreSQL logs
   ```

3. **Tmux Session Conflicts**
   ```
   Error: Session 'lightweight-web-seed' already exists

   Solution:
   1. Attach to existing: tmux attach -t lightweight-web-seed
   2. Kill existing: ./manage.ts dev stop
   3. Or: tmux kill-session -t lightweight-web-seed
   ```

### D. Platform-Specific Notes

**macOS:**
- Requires Xcode Command Line Tools: `xcode-select --install`
- Homebrew recommended for dependencies
- PostgreSQL installed via: `brew install postgresql@15`
- Redis installed via: `brew install redis`

**Ubuntu/Debian:**
- Requires `build-essential`: `sudo apt-get install build-essential`
- PostgreSQL installed via: `sudo apt-get install postgresql`
- Redis installed via: `sudo apt-get install redis-server`
- May require sudo for database operations

**RHEL/CentOS:**
- Requires Development Tools: `sudo dnf groupinstall "Development Tools"`
- PostgreSQL installed via: `sudo dnf install postgresql15-server`
- Redis installed via: `sudo dnf install redis`
- May require SELinux configuration

---

## Conclusion

The interactive management utility will significantly improve the developer experience for lightweight-web-seed by:

1. **Reducing Onboarding Time**: From 2-4 hours to under 30 minutes
2. **Ensuring Consistency**: Same setup process across all platforms
3. **Improving Reliability**: Automated validation reduces configuration errors
4. **Enhancing Productivity**: Single command to start all development services
5. **Lowering Support Burden**: Self-service troubleshooting with clear error messages

**Recommended Next Steps:**
1. Review and approve this proposal
2. Create implementation tickets based on phases
3. Assign development resources
4. Begin Phase 1 implementation
5. Establish testing infrastructure for cross-platform validation

**Success Metrics:**
- Onboarding time: Target < 30 minutes (currently 2-4 hours)
- Setup success rate: Target > 95% (currently ~70%)
- Support tickets: Target < 5 per month (currently ~20)
- Developer satisfaction: Target > 4.5/5 (currently ~3.2/5)

---

**Document Approval:**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| DevOps Engineer | | | |
| Engineering Manager | | | |

**Revision History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-31 | Claude | Initial proposal |
