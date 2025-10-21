# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                               │
├─────────────────────────┬───────────────────────────────────────────────┤
│                         │                                               │
│   Browser Client        │            CLI Client                         │
│   ┌──────────────┐      │       ┌────────────────┐                      │
│   │ React        │      │       │ Commander.js   │                      │
│   │ Components   │      │       │ (cli/index.ts) │                      │
│   │ (app/*.tsx)  │      │       └────────────────┘                      │
│   │ (components/ │      │                │                              │
│   │  *.tsx)      │      │                │                              │
│   └──────────────┘      │                │                              │
│          │              │                │                              │
│          ├──────────────┼────────────────┴──────────────┐               │
│          │              │                               │               │
└──────────┼──────────────┴───────────────────────────────┼───────────────┘
           │                                              │
           ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                               │
├──────────────────────────┬──────────────────────────────────────────────┤
│                          │                                              │
│  tRPC Client             │         WebSocket Client                     │
│  (lib/trpc/client.ts)    │         (lib/websocket/client.ts)            │
│  (Type-safe)             │         (ws://localhost:3001)                │
│         │                │                  │                           │
│         │ HTTP           │                  │ WebSocket                 │
│         ▼                │                  ▼                           │
│  ┌─────────────┐         │         ┌──────────────────┐                 │
│  │ /api/trpc/* │         │         │  WebSocket       │                 │
│  │ (app/api/   │         │         │  Server          │                 │
│  │  trpc/      │         │         │  (server/        │                 │
│  │  [trpc]/    │         │         │   websocket.ts)  │                 │
│  │  route.ts)  │         │         │  (port 3001)     │                 │
│  └─────────────┘         │         └──────────────────┘                 │
│         │                │                  │                           │
└─────────┼────────────────┴──────────────────┼───────────────────────────┘
          │                                   │
          ▼                                   │
┌─────────────────────────────────────────────┼───────────────────────────┐
│                    NEXT.JS SERVER (port 3000)                           │
├─────────────────────────────────────────────┴───────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │             tRPC App Router (server/routers/_app.ts)       │         │
│  │  ┌──────────────┬──────────────┬───────────────────────┐   │         │
│  │  │ user.*       │ post.*       │  auth.*               │   │         │
│  │  │ (server/     │ (server/     │  (server/routers/     │   │         │
│  │  │  routers/    │  routers/    │   authRouter.ts)      │   │         │
│  │  │  userRouter. │  postRouter. │                       │   │         │
│  │  │  ts)         │  ts)         │                       │   │         │
│  │  └────┬─────────┴────┬─────────┴──────┬────────────────┘   │         │
│  └───────┼──────────────┼────────────────┼────────────────────┘         │
│          │              │                │                              │
│          ├──────────────┴────────────────┤                              │
│          │                               │                              │
│          ▼                               ▼                              │
│  ┌──────────────┐               ┌────────────────┐                      │
│  │  Drizzle ORM │               │  Auth Service  │                      │
│  │  (lib/db/    │               │  (lib/auth/*)  │                      │
│  │   index.ts)  │               │  - JWT         │                      │
│  │  (lib/db/    │               │  - LDAP        │                      │
│  │   schema.ts) │               │                │                      │
│  └──────┬───────┘               └────────────────┘                      │
│         │                                                               │
│  ┌──────┴────────────────────────────────────────────────────┐          │
│  │           Queue Manager (lib/queue/index.ts)              │          │
│  │                    (BullMQ)                               │          │
│  │  ┌──────────────┬──────────────┬──────────────┐           │          │
│  │  │ default      │ email        │ processing   │           │          │
│  │  └──────────────┴──────────────┴──────────────┘           │          │
│  └───────────────────────────┬───────────────────────────────┘          │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                    │
├──────────────────────┬───────────────────────┬──────────────────────────┤
│                      │                       │                          │
│  PostgreSQL          │      Redis            │    Queue Worker          │
│  (port 5432)         │      (port 6379)      │    (server/queue/        │
│  (docker-compose.yml)│      (docker-compose  │     workers.ts)          │
│                      │       .yml)           │    (Background Process)  │
│  ┌────────────┐      │   ┌──────────────┐    │   ┌────────────────┐     │
│  │ users      │      │   │ Cache        │    │   │ Process Jobs   │     │
│  │ posts      │      │   │              │    │   │  - default     │     │
│  │ projects   │      │   │ BullMQ       │    │   │  - email       │     │
│  │ permission_│      │   │ Queues       │    │   │  - processing  │     │
│  │  requests  │      │   │              │    │   └────────┬───────┘     │
│  │ (lib/db/   │      │   │              │    │            │             │
│  │  schema.ts)│      │   │              │    │            │             │
│  └────────────┘      │   └──────────────┘    │            │             │
│                      │                       │            │             │
└──────────────────────┴───────────────────────┴────────────┼─────────────┘
                                                            │
                                    ┌───────────────────────┘
                                    │
                                    ▼
                          (Executes async tasks)
```

## Request Flow

### tRPC API Call Flow
```
Browser Component (components/UserList.tsx)
    │
    │ trpc.user.list.useQuery()
    ▼
tRPC Client (lib/trpc/client.ts)
    │
    │ HTTP POST /api/trpc/user.list
    ▼
Next.js API Route (app/api/trpc/[trpc]/route.ts)
    │
    │ Routes to tRPC handler
    ▼
tRPC App Router (server/routers/_app.ts)
    │
    │ Delegates to userRouter
    ▼
User Router (server/routers/userRouter.ts)
    │
    │ publicProcedure or protectedProcedure
    │ user.list procedure
    ▼
Drizzle ORM (lib/db/index.ts)
    │
    │ db.select().from(users)
    │ Uses schema from lib/db/schema.ts
    ▼
PostgreSQL Database (port 5432)
    │
    │ Executes SQL query
    │ Returns rows
    ▼
Response flows back up the chain
    │
    ▼
Browser Component receives typed data
```

### WebSocket Message Flow
```
Browser/CLI Client (lib/websocket/client.ts or cli/index.ts)
    │
    │ ws.send({ type: 'subscribe', channel: 'demo' })
    │ Connect to ws://localhost:3001
    ▼
WebSocket Server (server/websocket.ts)
    │
    │ Handles connection and message
    │ Registers client to channel
    ▼
Client subscribed to channel
    │
    │ Another client broadcasts message
    ▼
WebSocket Server (server/websocket.ts)
    │
    │ Finds all subscribers to 'demo' channel
    │ Iterates through subscribed clients
    │ Sends message to each subscriber
    ▼
All Subscribed Clients Receive Message
    │
    │ { type: 'message', channel: 'demo', data: {...} }
    ▼
Client callback handles message
```

### Background Job Flow
```
API/Component (app/api/queue/route.ts or components/*.tsx)
    │
    │ QueueManager.addJob('email', 'send-welcome', data)
    ▼
BullMQ Queue Manager (lib/queue/index.ts)
    │
    │ Creates job with options
    │ Adds job to Redis queue
    ▼
Redis (port 6379)
    │
    │ Job stored in BullMQ queue structure
    │ Job awaits processing
    ▼
Queue Worker (server/queue/workers.ts)
    │
    │ Continuously polls Redis for jobs
    │ Picks up job from queue
    │ Executes worker function (processEmailJob, etc.)
    ▼
Job Processing
    │
    │ Business logic executes
    │ May interact with database or external services
    ▼
Job Completed/Failed
    │
    │ Result stored in Redis
    │ If failed: retry based on attempts config
    │ If succeeded: mark complete
    ▼
Optional callback or retry (configured in lib/queue/index.ts)
```

### Authentication Flow
```
Login Page (app/login/page.tsx)
    │
    │ User enters Email/Password or LDAP credentials
    │ Form submission
    ▼
Auth Service (lib/auth/*)
    │
    ├─── Email/Password ────► Hash comparison
    │                          │
    │                          ▼
    │                      PostgreSQL (lib/db/schema.ts: users table)
    │                          │
    │                          │ Verify hashed password
    │                          ▼
    │
    └─── LDAP ──────────────► LDAP Server
                                │
                                │ Bind and authenticate
                                │ Configured via LDAP_* env vars
                                ▼
    │
    ▼
Generate JWT Token (lib/auth/*)
    │
    │ jwt.sign({ userId, email }, JWT_SECRET)
    │ Token expires in configured time
    ▼
Return Token to Client
    │
    │ Store in cookie/localStorage
    │ Include in subsequent requests
    ▼
Subsequent Requests Include Token (Authorization header)
    │
    │ tRPC Context Middleware (lib/trpc/trpc.ts)
    │ Extracts and verifies token
    ▼
Verify Token & Attach User to Context
    │
    │ ctx.user = { userId, email }
    │ Available in all protectedProcedure handlers
    ▼
Protected routes can access ctx.user
```

## Tech Stack

- **Next.js 15** - React framework with App Router and Turbopack
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **tRPC** - End-to-end type-safe API
- **Drizzle ORM** - Type-safe PostgreSQL ORM
- **WebSocket** - Real-time bidirectional communication
- **BullMQ** - Redis-based task queue
- **PostgreSQL** - Primary database
- **Redis** - Cache and queue backend

## Project Structure

```
lightweight-web-seed/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── trpc/         # tRPC endpoints
│   │   └── queue/        # Queue endpoints
│   ├── login/            # Login page
│   ├── projects/         # Projects page
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/            # React components
│   ├── UserList.tsx
│   ├── WebSocketDemo.tsx
│   └── TaskQueueDemo.tsx
├── lib/                   # Shared libraries
│   ├── auth/             # Authentication
│   ├── db/               # Database configuration
│   ├── trpc/             # tRPC client/server
│   ├── websocket/        # WebSocket client
│   └── queue/            # Queue configuration
├── server/                # Server-side code
│   ├── routers/          # tRPC routers
│   ├── queue/            # Queue workers
│   └── websocket.ts      # WebSocket server
├── cli/                   # CLI client
│   └── index.ts
├── docs/                  # Documentation
├── drizzle.config.ts     # Drizzle configuration
├── docker-compose.yml    # Docker services
└── .env                  # Environment variables
```

## Components

### Frontend (Next.js)
- **App Router**: Modern Next.js routing with server components
- **tRPC Client**: Type-safe API calls from React components
- **WebSocket Client**: Real-time updates in browser
- **Authentication UI**: Email and LDAP login forms

### Backend Services
- **tRPC Server**: Type-safe API endpoints
- **WebSocket Server**: Standalone WebSocket server on port 3001
- **Queue Worker**: Background job processor using BullMQ

### Data Layer
- **Drizzle ORM**: Type-safe database queries
- **PostgreSQL**: Relational data storage
- **Redis**: Cache and queue backend

### CLI
- **Command-line Interface**: Interact with API and WebSocket from terminal
- **User Management**: CRUD operations for users
- **Post Management**: CRUD operations for posts
- **WebSocket Client**: Subscribe and broadcast messages
