# Lightweight Web Seed - Codebase Exploration Summary
*For Non-Docker/K8s Developers*

Generated: 2025-10-30

---

## Executive Summary

This is a **production-grade full-stack TypeScript application** combining:
- **Frontend:** Next.js 15 with React 19 and Tailwind CSS
- **Backend:** tRPC type-safe API with Drizzle ORM
- **Services:** WebSocket server, background job queue (BullMQ), SSH operations
- **Database:** PostgreSQL 16 with 10 interconnected tables
- **Observability:** Pino logging + Prometheus metrics

**Target Audience:** Non-Docker developers who want to run PostgreSQL and Redis locally rather than in containers.

---

## Key Project Facts

| Item | Value |
|------|-------|
| **Node.js Requirement** | 18+ |
| **Package Manager** | npm |
| **TypeScript** | Strict mode enabled |
| **Main Framework** | Next.js 15 (App Router) |
| **API Framework** | tRPC 11 |
| **ORM** | Drizzle ORM 0.44.6 |
| **Database** | PostgreSQL 16 |
| **Cache/Queue Backend** | Redis 7 |
| **Default Port** | 3000 (Web) + 3001 (WebSocket) |
| **Authentication** | Email/password + LDAP |
| **Real-time Communication** | WebSocket (ws library) |
| **Background Jobs** | BullMQ (Redis-based) |
| **Monitoring** | Pino (logging) + Prometheus (metrics) |

---

## 1. PROJECT STRUCTURE

### Root-Level Files
```
/home/user/lightweight-web-seed/
├── package.json              # 74 lines - Dependencies & npm scripts
├── tsconfig.json             # TypeScript configuration
├── next.config.ts            # Next.js configuration
├── eslint.config.mjs         # ESLint rules (Next.js + TypeScript)
├── postcss.config.mjs        # Tailwind CSS PostCSS config
├── drizzle.config.ts         # Drizzle ORM migration config
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore patterns
├── .husky/                   # Git hooks (pre-push)
├── docker-compose.yml        # Local service definitions
└── README.md                 # Main project documentation
```

### Application Directories

#### `app/` - Next.js Application (React Frontend)
```
app/
├── api/
│   ├── trpc/[trpc]/route.ts         # tRPC endpoint handler
│   ├── health/
│   │   ├── startup/route.ts          # Startup health check
│   │   ├── live/route.ts             # Liveness probe
│   │   └── ready/route.ts            # Readiness probe
│   ├── metrics/route.ts              # Prometheus metrics endpoint
│   └── queue/add/route.ts            # Queue job endpoint
├── login/page.tsx                    # Authentication page
├── projects/                         # Project management pages
├── layout.tsx                        # Root layout wrapper
├── page.tsx                          # Home page
└── globals.css                       # Global styles
```

#### `components/` - React Components
```
components/
├── UserList.tsx              # User management UI (3047 lines)
├── WebSocketDemo.tsx         # WebSocket testing UI
└── TaskQueueDemo.tsx         # Queue job testing UI
```

#### `lib/` - Shared Libraries (Core Logic)
```
lib/
├── auth/                     # Authentication services
│   ├── service.ts            # Main auth logic (154 lines)
│   ├── jwt.ts                # JWT token signing/verification
│   ├── password.ts           # bcryptjs hashing utilities
│   └── ldap.ts               # LDAP directory integration
│
├── db/                       # Database layer
│   ├── index.ts              # Drizzle client setup
│   └── schema.ts             # PostgreSQL schema definitions
│
├── trpc/                     # tRPC API framework
│   ├── trpc.ts               # tRPC instance + observability middleware
│   ├── context.ts            # Request context setup
│   └── client.ts             # Frontend tRPC client
│
├── queue/                    # Task queue management
│   ├── index.ts              # QueueManager class (3 queues)
│   └── config.ts             # Redis configuration
│
├── websocket/                # WebSocket utilities
│   └── client.ts             # WebSocket client wrapper
│
├── crypto/                   # Encryption utilities
│   └── aes.ts                # AES encryption/decryption
│
├── ssh/                      # SSH operations
│   ├── types.ts              # Type definitions
│   ├── pool.ts               # Connection pooling
│   └── operations.ts         # Remote command execution
│
├── notifications/            # Alert system
│   └── email.ts              # Email sending
│
└── observability/            # Production monitoring
    ├── logger.ts             # Pino structured logger
    ├── metrics.ts            # Prometheus metric definitions
    └── health.ts             # Health check endpoints
```

#### `server/` - Backend Services
```
server/
├── routers/                  # tRPC endpoint definitions
│   ├── _app.ts               # Router composition
│   ├── user.ts               # User CRUD operations
│   ├── post.ts               # Post CRUD operations
│   ├── auth.ts               # Authentication endpoints
│   ├── project.ts            # Project management (8964 lines)
│   ├── ssh-config.ts         # SSH configuration (10358 lines)
│   └── ssh.ts                # SSH operations (13650 lines)
│
├── queue/                    # Background job processing
│   └── worker.ts             # BullMQ worker with 3 queue handlers
│
└── websocket.ts              # Standalone WebSocket server (187 lines)
```

#### `cli/` - Command-Line Interface
```
cli/
└── index.ts                  # Commander.js CLI application
```

#### `scripts/` - Utility Scripts
```
scripts/
└── seed.ts                   # Database seeding script
```

#### `docs/` - Documentation
```
docs/
├── README.md                 # Documentation index
├── architecture/             # System design docs
│   ├── ARCHITECTURE.md       # (100% complete)
│   ├── API.md                # (100% complete)
│   ├── DATABASE.md           # (95% complete)
│   ├── AUTHENTICATION.md     # (100% complete)
│   ├── DEVELOPMENT.md        # (100% complete)
│   ├── DEPLOYMENT.md         # (60% complete)
│   ├── WEBSOCKET.md          # (100% complete)
│   ├── TASK_QUEUE.md         # (100% complete)
│   ├── CLI.md                # (100% complete)
│   ├── SSH.md                # (100% complete)
│   └── Flow diagrams
├── features/                 # Implemented feature guides
└── evaluation/               # Technology research (Bun adoption)
```

---

## 2. TECHNOLOGIES BREAKDOWN

### Frontend Stack
- **Next.js 15.5.6** - React meta-framework with App Router
- **React 19.1.0** - UI library
- **Tailwind CSS 4** - Utility CSS with PostCSS
- **TypeScript 5** - Type safety

### Backend/API Stack
- **tRPC 11.0.0** - End-to-end typesafe API
- **SuperJSON** - Enhanced JSON serialization for complex types
- **@tanstack/react-query 5.90.5** - Server state management

### Database Stack
- **Drizzle ORM 0.44.6** - Type-safe SQL query builder
- **Drizzle Kit 0.31.5** - Schema management and migrations
- **postgres 3.4.7** - PostgreSQL client library
- **PostgreSQL 16** - Primary database (Alpine Docker image)

### Authentication
- **jose 6.1.0** - JWT operations (sign/verify)
- **bcryptjs 3.0.2** - Password hashing (Bcrypt)
- **ldap-authentication 3.3.6** - LDAP/Active Directory support

### Real-time & Background Jobs
- **ws 8.18.3** - WebSocket server library
- **BullMQ 5.61.0** - Redis-based task queue
- **ioredis 5.8.1** - Redis client
- **Redis 7** - In-memory data store (Alpine Docker image)

### Observability & Logging
- **pino 10.1.0** - Structured JSON logging
- **pino-pretty 13.1.2** - Pretty-print logger (dev mode)
- **prom-client 15.1.3** - Prometheus metrics collection

### SSH & Remote Operations
- **node-ssh 13.2.1** - SSH client wrapper
- **ssh2 1.17.0** - SSH protocol implementation

### CLI & DevOps
- **commander 14.0.1** - CLI argument parsing
- **tsx 4.20.6** - TypeScript runner (no build step)
- **dotenv 17.2.3** - Environment variable loader

### Data Validation
- **zod 4.1.12** - TypeScript-first schema validation

### Development Tools
- **ESLint 9** - JavaScript/TypeScript linter
- **Husky 9.1.7** - Git hooks manager
- **lint-staged 16.2.6** - Pre-commit linting
- **TypeScript** - Type checking compiler

---

## 3. DOCUMENTATION STATUS

### 100% Complete (Production Ready)
- Architecture Overview
- API Reference (tRPC endpoints)
- Authentication Setup (Email + LDAP)
- Development Workflow
- WebSocket Guide
- Task Queue Guide
- CLI Reference
- SSH Remote Operations

### 95% Complete
- Database Schema Guide (generated but not finalized)

### 60% Complete
- Deployment Guide (local Docker done, production CI/CD pending)

### 0% (Planning Phase)
- Bun Runtime Adoption

All documentation is located in `/home/user/lightweight-web-seed/docs/`

---

## 4. NPM SCRIPTS & BUILD PIPELINE

### Development Scripts
```bash
npm run dev              # Start Next.js dev server (Turbopack)
npm run build            # Production build
npm start                # Run production build
```

### Code Quality
```bash
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix ESLint issues
npm run type-check       # TypeScript checking (no emit)
npm test                 # Tests (placeholder: no tests configured)
```

### Database Management
```bash
npm run db:push          # Push schema to DB (dev - no migrations)
npm run db:generate      # Create migration files
npm run db:migrate       # Apply migrations (production)
npm run db:studio        # Open Drizzle Studio GUI
npm run db:seed          # Seed database with initial data
```

### Services
```bash
npm run ws:server        # Start WebSocket server on port 3001
npm run queue:worker     # Start background job worker
npm run cli              # Run CLI client
npm run prepare          # Setup Husky git hooks
```

### Build Configuration
- **Turbopack:** Used for fast builds (both dev and production)
- **TypeScript Strict:** ES2017 target, strict mode on
- **Module System:** ESNext with bundler resolution
- **Path Alias:** `@/*` maps to project root

### Pre-push Git Hook
File: `/home/user/lightweight-web-seed/.husky/pre-push`
```bash
npm run type-check       # Must pass TypeScript checks
npm test                 # Must pass tests (placeholder)
```

---

## 5. DATABASE ARCHITECTURE

### Database: PostgreSQL 16
**Connection String Format:**
```
postgresql://username:password@host:port/database
```

**Drizzle Config File:** `/home/user/lightweight-web-seed/drizzle.config.ts`

### Database Schema (10 Tables)

#### Core Tables
1. **users** - User accounts
   - Columns: id, username, name, email, password (hashed), authType, mustChangePassword, createdAt, updatedAt, lastLogin
   - Constraints: unique(username), unique(email)

2. **posts** - Blog/content posts
   - Columns: id, title, content, authorId (FK->users), createdAt, updatedAt

3. **tasks** - Background job tracking
   - Columns: id, name, status, data (JSONB), result (JSONB), createdAt, completedAt

#### Project Management
4. **projects** - Projects
   - Columns: id, projectVersion, projectCode, name, description, ownerId (FK->users), status, visibility, metadata (JSONB), timestamps

5. **projectMembers** - Project collaborators
   - Columns: id, projectId (FK), userId (FK), role, joinedAt
   - Roles: owner, admin, member, viewer

6. **permissionRequests** - Access request workflow
   - Columns: id, projectId (FK), userId (FK), status (pending/approved/rejected), timestamps, resolvedBy (FK)

#### SSH Operations
7. **sshAccounts** - SSH connection profiles
   - Columns: id, accountName, host, port, username, encrypted credentials, authMethod, basePath, timeout, isActive, timestamps

8. **projectSshConfigs** - SSH config assignments
   - Columns: id, projectId (FK cascade), sshAccountId (FK cascade), configAlias, overridePath, isDefault, timestamp
   - Constraint: unique(projectId, configAlias)

9. **sshOperationLogs** - Audit trail
   - Columns: id, projectId (FK), sshAccountId (FK), operation, parameters (JSONB), success, stdout, stderr, errorMessage, executionTime, timestamp

10. **sshErrorNotifications** - Error alert configuration
    - Columns: id, projectId (FK cascade), sshAccountId (FK cascade), notifyOnError, emailAddresses, customHandler, customConfig (JSONB), maxRetries, retryDelay, timestamps
    - Constraint: unique(projectId, sshAccountId)

### Database Client
File: `/home/user/lightweight-web-seed/lib/db/index.ts`
```typescript
export const db = drizzle(queryClient, { schema })
```
- Uses postgres client for connections
- Drizzle ORM for type-safe queries
- Automatic schema typing

### Initialization Steps
1. Local PostgreSQL must be running
2. Set `DATABASE_URL` in `.env`
3. Run `npm run db:push` to apply schema
4. Run `npm run db:seed` to add initial data

---

## 6. ENVIRONMENT VARIABLES & CONFIG

### Environment File: `.env.example`
Location: `/home/user/lightweight-web-seed/.env.example`

**Required Variables:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb
REDIS_URL=redis://localhost:6379
PORT=3000
WS_PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production-make-it-long-and-random
SSH_ENCRYPTION_KEY=<random-32-byte-hex>
```

**Optional Variables (LDAP):**
```env
LDAP_URL=ldap://your-ldap-server:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
LDAP_USERNAME_ATTRIBUTE=uid
```

**Optional Variables (Logging):**
```env
LOG_LEVEL=debug  # trace|debug|info|warn|error|fatal
```

### Configuration Files

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript compiler settings (strict mode, ES2017 target) |
| `next.config.ts` | Next.js framework configuration |
| `eslint.config.mjs` | ESLint rules (flat config format) |
| `postcss.config.mjs` | Tailwind CSS processing |
| `drizzle.config.ts` | Database migration configuration |
| `.env.example` | Environment variable template |
| `.gitignore` | Git exclusions (node_modules, .next, .env) |
| `.husky/pre-push` | Git hook script |
| `docker-compose.yml` | Local service definitions (PostgreSQL, Redis) |

---

## 7. TESTING SETUP

### Current Status
**No tests are configured.** The test script is a placeholder:
```json
"test": "echo \"No tests configured yet\" && exit 0"
```

### Testing Infrastructure Available
- TypeScript support (strict mode)
- ESLint for code quality
- Type checking with `npm run type-check`
- Pre-push hooks (will run type-check)

### Code Quality Tools
- **ESLint 9** - Linting with Next.js + TypeScript configs
- **lint-staged** - Pre-commit file linting
- **Husky** - Git hook execution
- **TypeScript** - Type safety validation

### Recommended Testing Framework (Not Yet Implemented)
- **Jest** or **Vitest** - Unit and integration tests
- **React Testing Library** - Component testing
- **Supertest** - API route testing
- **MSW (Mock Service Worker)** - API mocking

### Quality Gate
Pre-push validation requires:
1. TypeScript strict compilation (must pass)
2. Tests (currently placeholder)

---

## 8. ADDITIONAL FEATURES

### Authentication System
**File:** `/home/user/lightweight-web-seed/lib/auth/service.ts` (154 lines)

**Supported Methods:**
- Email/password with bcryptjs hashing
- LDAP/Active Directory integration
- JWT tokens with 24-hour expiration

**Default Test User:**
- Username: `root`
- Password: `Must-Changed` (must be changed in production)

### WebSocket Server
**File:** `/home/user/lightweight-web-seed/server/websocket.ts` (187 lines)

**Features:**
- Standalone service on port 3001
- Channel-based subscriptions
- Client-to-client broadcasting
- Ping/pong heartbeat
- Prometheus metrics tracking
- Graceful shutdown handling

**Commands:**
```bash
npm run ws:server
```

### Task Queue (BullMQ)
**Files:** 
- Manager: `/home/user/lightweight-web-seed/lib/queue/index.ts`
- Worker: `/home/user/lightweight-web-seed/server/queue/worker.ts`
- Config: `/home/user/lightweight-web-seed/lib/queue/config.ts`

**Features:**
- Three queues: DEFAULT, EMAIL, PROCESSING
- Redis-backed persistence
- Job retry logic
- Priority support
- Prometheus metrics

**Commands:**
```bash
npm run queue:worker
```

### SSH Operations
**Features:**
- SSH connection pooling
- Encrypted credential storage (AES)
- Operation audit logging
- Error notifications
- Password + key-based authentication

### Observability Stack

**Logging (Pino):** `/home/user/lightweight-web-seed/lib/observability/logger.ts`
- Structured JSON logs
- Development: pretty-printed
- Production: JSON format
- Context-aware child loggers

**Metrics (Prometheus):** `/home/user/lightweight-web-seed/lib/observability/metrics.ts`
- HTTP request metrics
- tRPC procedure metrics
- WebSocket connection metrics
- Queue job metrics
- Prometheus endpoint: `/api/metrics`

**Health Checks:** `/home/user/lightweight-web-seed/lib/observability/health.ts`
- `/api/health/startup` - Startup probe
- `/api/health/live` - Liveness probe
- `/api/health/ready` - Readiness probe

### CLI Client
**File:** `/home/user/lightweight-web-seed/cli/index.ts`

**Commands:**
```bash
npm run cli user list                              # List users
npm run cli user create "name" "email"             # Create user
npm run cli user get <id>                          # Get user
npm run cli user delete <id>                       # Delete user
npm run cli post list                              # List posts
npm run cli post create "title" "[content]"        # Create post
npm run cli ws listen <channel>                    # Listen WebSocket
npm run cli ws send <channel> "message"            # Send message
```

---

## 9. LOCAL DEVELOPMENT SETUP (Non-Docker)

### Prerequisites
- Node.js 18+
- PostgreSQL 16 (local installation, not Docker)
- Redis 7 (local installation, not Docker)
- npm or yarn

### Setup Steps

**Step 1: Install Dependencies**
```bash
cd /home/user/lightweight-web-seed
npm install
```

**Step 2: Create Environment File**
```bash
cp .env.example .env
# Edit .env with your local database/Redis URLs
```

**Step 3: Start Local Services**
```bash
# PostgreSQL 16 must be running on localhost:5432
# Redis 7 must be running on localhost:6379
# Verify with: psql -U postgres -h localhost
#              redis-cli ping
```

**Step 4: Initialize Database**
```bash
npm run db:push          # Apply schema
npm run db:seed          # Seed initial data
```

**Step 5: Start Development Servers** (3 separate terminals)
```bash
# Terminal 1: Web application (http://localhost:3000)
npm run dev

# Terminal 2: WebSocket server (ws://localhost:3001)
npm run ws:server

# Terminal 3: Background job worker
npm run queue:worker
```

**Step 6: Access Application**
- Web UI: http://localhost:3000
- Login: username `root`, password `Must-Changed`
- API: http://localhost:3000/api/trpc
- WebSocket: ws://localhost:3001
- Metrics: http://localhost:3000/api/metrics
- Health: http://localhost:3000/api/health/live

### Development Practices
```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Production build test
npm run build
npm start

# Database operations
npm run db:studio        # Open Drizzle GUI
npm run db:generate      # Create migrations
```

---

## 10. SUMMARY TABLE

| Category | Technology | Version | Status |
|----------|-----------|---------|--------|
| **Frontend Framework** | Next.js | 15.5.6 | Production |
| **UI Library** | React | 19.1.0 | Production |
| **Styling** | Tailwind CSS | 4 | Production |
| **Language** | TypeScript | 5 | Strict Mode |
| **API Framework** | tRPC | 11.0.0 | Production |
| **ORM** | Drizzle | 0.44.6 | Production |
| **Primary Database** | PostgreSQL | 16 | 10 tables |
| **Cache/Queue** | Redis | 7 | BullMQ queues |
| **WebSocket** | ws library | 8.18.3 | Production |
| **Authentication** | JWT + bcrypt | - | Email + LDAP |
| **Logging** | Pino | 10.1.0 | Structured JSON |
| **Monitoring** | Prometheus | prom-client 15.1.3 | /api/metrics |
| **CLI** | Commander.js | 14.0.1 | Production |
| **SSH** | ssh2 | 1.17.0 | Pooled + Encrypted |
| **Testing** | None | - | Ready for setup |
| **Linting** | ESLint | 9 | Next.js config |
| **Build Tool** | Turbopack | - | Via Next.js |

---

## 11. KEY FILE PATHS (Absolute)

### Configuration
- `/home/user/lightweight-web-seed/package.json` - Dependencies
- `/home/user/lightweight-web-seed/tsconfig.json` - TypeScript config
- `/home/user/lightweight-web-seed/next.config.ts` - Next.js config
- `/home/user/lightweight-web-seed/eslint.config.mjs` - Linting rules
- `/home/user/lightweight-web-seed/drizzle.config.ts` - DB migrations
- `/home/user/lightweight-web-seed/.env.example` - Env template

### Database
- `/home/user/lightweight-web-seed/lib/db/schema.ts` - Schema definitions
- `/home/user/lightweight-web-seed/lib/db/index.ts` - DB client

### Authentication
- `/home/user/lightweight-web-seed/lib/auth/service.ts` - Auth logic
- `/home/user/lightweight-web-seed/lib/auth/jwt.ts` - JWT handling
- `/home/user/lightweight-web-seed/lib/auth/ldap.ts` - LDAP integration

### API
- `/home/user/lightweight-web-seed/lib/trpc/trpc.ts` - tRPC setup
- `/home/user/lightweight-web-seed/server/routers/_app.ts` - Root router
- `/home/user/lightweight-web-seed/app/api/trpc/[trpc]/route.ts` - tRPC endpoint

### Real-time
- `/home/user/lightweight-web-seed/server/websocket.ts` - WebSocket server
- `/home/user/lightweight-web-seed/lib/queue/index.ts` - Queue manager
- `/home/user/lightweight-web-seed/server/queue/worker.ts` - Queue worker

### Observability
- `/home/user/lightweight-web-seed/lib/observability/logger.ts` - Pino logger
- `/home/user/lightweight-web-seed/lib/observability/metrics.ts` - Prometheus metrics
- `/home/user/lightweight-web-seed/lib/observability/health.ts` - Health checks

### CLI
- `/home/user/lightweight-web-seed/cli/index.ts` - CLI commands

### Documentation
- `/home/user/lightweight-web-seed/docs/` - All documentation
- `/home/user/lightweight-web-seed/README.md` - Main README

---

## 12. QUICK REFERENCE COMMANDS

```bash
# Setup
npm install
cp .env.example .env

# Development (3 terminals)
npm run dev              # Terminal 1: Web app
npm run ws:server        # Terminal 2: WebSocket
npm run queue:worker     # Terminal 3: Queue worker

# Database
npm run db:push          # Apply schema
npm run db:seed          # Add test data
npm run db:studio        # Open GUI editor

# Code Quality
npm run type-check       # TypeScript validation
npm run lint             # Check code
npm run lint:fix         # Auto-fix issues
npm run build            # Production build

# Testing (User/Post/WebSocket)
npm run cli user list    # List users
npm run cli ws listen demo    # WebSocket listen
```

---

## Next Steps

For creating a Non-Docker development guide, focus on:
1. PostgreSQL + Redis local installation
2. Environment setup (.env)
3. Database initialization workflow
4. Three-terminal service startup
5. Development best practices
6. tRPC endpoint usage examples
7. WebSocket integration guide
8. Queue job implementation

All documentation foundation exists in `/docs/` directory.
