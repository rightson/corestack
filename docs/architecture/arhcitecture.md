# Architecture

## Overview

Core Stack is a modern full-stack application built with Next.js, featuring type-safe APIs, real-time communication, and background job processing.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                               │
│   Browser (React) + CLI (Commander.js)                                  │
└───────────────────────────┬─────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        tRPC Client              WebSocket Client
              │                         │
              ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS SERVER (port 3000)                           │
│  ┌─────────────────┐    ┌──────────────┐    ┌────────────────┐         │
│  │  tRPC Routers   │    │  Drizzle ORM │    │  Auth Service  │         │
│  │  - user.*       │    │  - Schema    │    │  - JWT         │         │
│  │  - post.*       │    │  - Queries   │    │  - LDAP        │         │
│  │  - auth.*       │    └──────┬───────┘    └────────────────┘         │
│  │  - project.*    │           │                                        │
│  └─────────────────┘           │                                        │
│                                │                                        │
│  ┌────────────────────────────┴───────────────────────┐                 │
│  │         Queue Manager (BullMQ)                     │                 │
│  │  - default  │  - email  │  - processing            │                 │
│  └────────────────────────────┬───────────────────────┘                 │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼────────────────────┐
        │                       │                    │
        ▼                       ▼                    ▼
┌───────────────┐      ┌────────────────┐   ┌──────────────────┐
│  PostgreSQL   │      │     Redis      │   │  WebSocket       │
│  (port 5432)  │      │  (port 6379)   │   │  Server          │
│  - users      │      │  - Cache       │   │  (port 3001)     │
│  - posts      │      │  - Queues      │   └──────────────────┘
│  - projects   │      └────────────────┘
└───────────────┘
```

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router and Turbopack
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **tRPC** - End-to-end type-safe API client

### Backend
- **tRPC** - Type-safe API server
- **Drizzle ORM** - Type-safe PostgreSQL ORM
- **Next.js API Routes** - Server-side handlers
- **BullMQ** - Redis-based task queue
- **WebSocket (ws)** - Real-time bidirectional communication

### Observability
- **Pino** - High-performance structured logging
- **Prometheus** - Metrics collection and monitoring
- **Health Checks** - Kubernetes-compatible liveness/readiness probes

### Authentication
- **JWT** - Token-based authentication
- **LDAP** - Enterprise directory authentication
- **bcrypt** - Password hashing

### Data Layer
- **PostgreSQL** - Relational database
- **Redis** - Cache and queue backend

### CLI
- **Commander.js** - Command-line interface

## Project Structure

```
corestack/
├── app/                    # Next.js app directory
│   ├── api/               # API routes (tRPC, queue)
│   ├── login/            # Login page
│   ├── projects/         # Projects dashboard
│   └── page.tsx          # Home page
├── components/            # React components
├── lib/                   # Shared libraries
│   ├── auth/             # Authentication (JWT, LDAP)
│   ├── db/               # Database & schema
│   ├── observability/    # Logging, metrics, health checks
│   ├── trpc/             # tRPC configuration
│   ├── websocket/        # WebSocket client
│   └── queue/            # Queue configuration
├── server/                # Server-side code
│   ├── routers/          # tRPC routers
│   ├── queue/            # Queue workers
│   └── websocket.ts      # WebSocket server
├── cli/                   # CLI client
├── docs/                  # Documentation
└── scripts/               # Utility scripts
```

## Core Components

### tRPC Routers
Type-safe API endpoints handling business logic:
- `auth.*` - Authentication and authorization
- `user.*` - User management
- `post.*` - Post/content management
- `project.*` - Project management

### Background Jobs
BullMQ queues for async processing:
- `default` - General purpose jobs
- `email` - Email sending jobs
- `processing` - Data processing jobs

### WebSocket Server
Real-time communication for:
- Live updates
- Chat/messaging
- Notifications
- Channel-based pub/sub

### Observability and Monitoring

Production-grade observability features:

**Structured Logging**
- JSON-based logs in production
- Pretty-printed logs in development
- Context-aware child loggers
- Integrated across all services (tRPC, WebSocket, queues)

**Health Checks**
- `/api/health/live` - Liveness probe
- `/api/health/ready` - Readiness probe (checks database, Redis)
- `/api/health/startup` - Startup probe

**Prometheus Metrics**
- `/api/metrics` - Metrics endpoint
- HTTP request rates and latency
- tRPC procedure performance
- WebSocket connection and message metrics
- Queue job processing times
- Database query performance
- System resources (CPU, memory, event loop)

See [Observability Documentation](../features/observability.md) for detailed configuration.

## Detailed Documentation

For detailed architecture information, see:
- [Request Flow](./request-flow.md) - How API calls flow through the system
- [WebSocket Flow](./websocket-flow.md) - Real-time message handling
- [Job Processing Flow](./job-flow.md) - Background job execution
- [Authentication Flow](./auth-flow.md) - Login and token management
- [Data Flow](./data-flow.md) - Database queries and caching

## Key Features

✅ **Type Safety** - End-to-end TypeScript with tRPC
✅ **Real-time** - WebSocket support for live updates
✅ **Async Processing** - Background jobs with BullMQ
✅ **Authentication** - Email/password + LDAP support
✅ **Database** - Type-safe queries with Drizzle ORM
✅ **CLI Client** - Command-line access to all features
✅ **Observability** - Structured logging, health checks, and Prometheus metrics
✅ **Production-Ready** - Comprehensive monitoring and uptime tracking
