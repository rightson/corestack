# CoreStack

A comprehensive, full-stack web application framework with **React Router 7, Vite, Fastify**, tRPC, Drizzle ORM, WebSocket support, workflow orchestration, and task queue functionality. Built with TypeScript and optimized for complex, data-heavy enterprise dashboards with deep nesting (4+ levels). Designed for both browser and CLI clients.

**🎯 Migration Complete!** This project has been successfully migrated from Next.js 15 to React Router 7 + Vite + Fastify. See [Migration Documentation](docs/proposal/nextjs-to-react-router-migration.md) for details.

## Features

### Core Functionality
- ✅ **Type-safe API** with tRPC - End-to-end type safety from client to server
- ✅ **Database ORM** with Drizzle (PostgreSQL) - Type-safe database queries and schema management
- ✅ **Real-time Communication** - WebSocket server for bidirectional messaging
- ✅ **Background Jobs** - Task queue with BullMQ and Redis
- ✅ **Workflow Orchestration** - Temporal for long-running tasks and complex workflows
- ✅ **CLI Client** - Command-line interface for API, WebSocket, and workflow operations
- ✅ **Authentication** - Email/password and LDAP authentication support
- ✅ **Project Management** - Dashboard with project search and permission requests

### Tech Stack

**Frontend:**
- **React Router 7** - Modern routing with URL state management for complex filters
- **Vite** - Lightning-fast development and build tool (instant HMR)
- **React 19** - Latest React features
- **TanStack Query** - Powerful data fetching and caching
- **Tailwind CSS** - Utility-first CSS framework

**Backend:**
- **Fastify** - High-performance web framework for APIs
- **tRPC** - End-to-end type-safe API
- **TypeScript** - Type-safe development
- **Drizzle ORM** - Type-safe PostgreSQL ORM
- **PostgreSQL** - Primary database
- **Redis** - Cache and queue backend

**Infrastructure:**
- **WebSocket** - Real-time bidirectional communication
- **BullMQ** - Redis-based task queue
- **Temporal** - Durable workflow orchestration

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker and Docker Compose
- tmux (for manage utility)
- npm or yarn

### Option 1: Using Manage Utility (Recommended)

The manage utility provides a streamlined development experience by orchestrating all services in a unified tmux session.

1. Clone and setup:
```bash
git clone <repository-url>
cd corestack
npm install
```

2. Run the complete setup wizard:
```bash
./manage.ts setup
```

This will:
- Check prerequisites
- Install dependencies
- Initialize environment configuration
- Setup databases
- Create an admin user

3. Start all development services:
```bash
./manage.ts dev
```

This single command starts all 6 services in tmux:
- Temporal infrastructure (Docker)
- Vite dev server (frontend)
- Fastify API server (backend)
- WebSocket server
- BullMQ queue workers
- Temporal worker

4. Access the application:
- Web UI: [http://localhost:3000](http://localhost:3000)
- Temporal UI: [http://localhost:8080](http://localhost:8080)

**Manage Utility Commands:**
```bash
./manage.ts check          # Verify prerequisites
./manage.ts init           # Initialize environment
./manage.ts db-setup       # Setup databases
./manage.ts createsuperuser # Create admin user
./manage.ts dev            # Start all services
./manage.ts dev stop       # Stop all services
./manage.ts dev status     # Check service status
./manage.ts dev logs       # View service logs
```

**tmux Controls:**
- `Ctrl+B` then `0-4`: Switch between service panes
- `Ctrl+B` then `D`: Detach (services keep running)
- `tmux attach -t corestack`: Reattach to session

### Option 2: Manual Setup

If you prefer to manage services individually:

1. Clone and install:
```bash
git clone <repository-url>
cd corestack
npm install
```

2. Setup environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start services:
```bash
# Start PostgreSQL, Redis, and Temporal
docker-compose up -d

# Push database schema
npm run db:push
```

4. Run the application (requires 5 terminals):
```bash
# Terminal 1 - Vite dev server (frontend on port 3000)
npm run dev:vite

# Terminal 2 - Fastify API server (backend on port 4000)
npm run dev:api

# Or use this single command to run both concurrently:
# npm run dev

# Terminal 3 - WebSocket server
npm run ws:server

# Terminal 4 - Queue worker (BullMQ)
npm run queue:worker

# Terminal 5 - Temporal worker
npm run temporal:worker
```

5. Open [http://localhost:3000](http://localhost:3000)

**Additional UIs:**
- Temporal UI: [http://localhost:8080](http://localhost:8080) - Monitor workflows and task execution

**Default credentials**: username: `root`, password: `Must-Changed`

## Documentation

Comprehensive documentation is available in the `docs/` directory:

### Getting Started

| Guide | Description |
|-------|-------------|
| **[Manage Utility Design](docs/proposal/interactive_manage_utility.md)** | Design proposal for the interactive management utility (planned feature) |
| **[Codebase Exploration](docs/development/codebase_exploration_summary.md)** | Comprehensive overview of the codebase structure, architecture, and key components |
| **[Local Development Guide](docs/development/local_development_guide.md)** | Step-by-step guide for setting up the project without Docker/Kubernetes |

### Core Guides

| Guide | Description | Implementation Status |
|-------|-------------|----------------------|
| **[Architecture](docs/architecture.md)** | System architecture and tech stack overview | 🟢 100% Complete |
| **[API Reference](docs/api.md)** | tRPC endpoints and WebSocket protocol | 🟢 100% Complete |
| **[Database Guide](docs/database.md)** | Schema overview and Drizzle ORM basics | 🟢 95% Complete* |
| **[Authentication](docs/authentication.md)** | Email/password and LDAP authentication | 🟢 100% Complete |
| **[Development Guide](docs/development.md)** | Development workflow and adding features | 🟢 100% Complete |
| **[Deployment Guide](docs/deployment.md)** | Production deployment and scaling | 🟡 60% Complete** |
| **[WebSocket Guide](docs/websocket.md)** | Real-time communication setup | 🟢 100% Complete |
| **[Task Queue Guide](docs/task_queue.md)** | Background job processing (BullMQ) | 🟢 100% Complete |
| **[Temporal Integration](docs/features/TEMPORAL_task_queue.md)** | Workflow orchestration with Temporal | 🟢 100% Complete |
| **[CLI Guide](docs/cli.md)** | Command-line interface usage | 🟢 100% Complete |
| **[SSH Remote Operations](docs/ssh.md)** | SSH operations and remote file management | 🟢 100% Complete |
| **[Bun Adoption](docs/bun_adoption.md)*** | Bun runtime migration strategy | 🔴 0% Complete |

<sub>*Database: Schema complete, migrations not yet generated via `drizzle-kit generate`</sub>
<sub>**Deployment: Local Docker setup complete, production CI/CD and monitoring not configured</sub>
<sub>***Bun Adoption: Design/planning phase only, not yet implemented</sub>

### Detailed Documentation

Each topic has detailed documentation in subfolders:

- **[docs/development/](docs/development/)** - Codebase exploration and overview guides
- **[docs/architecture/](docs/architecture/)** - Request flows, WebSocket protocol, job processing
- **[docs/authentication/](docs/authentication/)** - Login verification, LDAP setup guides
- **[docs/database/](docs/database/)** - Complete schema reference, migration guides
- **[docs/api/](docs/api/)** - Detailed API endpoint documentation
- **[docs/development/](docs/development/)** - Development guides and best practices
- **[docs/deployment/](docs/deployment/)** - Deployment configurations
- **[docs/websocket/](docs/websocket/)** - WebSocket implementation details
- **[docs/task-queue/](docs/task-queue/)** - Queue management and workers
- **[docs/cli/](docs/cli/)** - CLI command references

## Common Commands

### Manage Utility (Recommended)
```bash
./manage.ts setup            # Complete setup wizard
./manage.ts check            # Check prerequisites
./manage.ts install          # Install dependencies
./manage.ts init             # Initialize environment
./manage.ts db-setup         # Setup databases
./manage.ts createsuperuser  # Create admin user
./manage.ts dev              # Start all services
./manage.ts dev stop         # Stop all services
./manage.ts dev restart      # Restart all services
./manage.ts dev status       # Check service status
./manage.ts dev logs [service] # View logs
```

### Development
```bash
npm run dev          # Start Vite dev + Fastify API (runs both concurrently)
npm run dev:vite     # Start Vite dev server only
npm run dev:api      # Start Fastify API server only
npm run build        # Build for production (client + server)
npm run build:client # Build Vite client only
npm run build:server # Build Fastify server only
npm start            # Start production server
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # Type check TypeScript
```

### Database
```bash
npm run db:push      # Push schema to database (development)
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations (production)
npm run db:studio    # Open Drizzle Studio
```

### Services
```bash
npm run ws:server        # Start WebSocket server
npm run queue:worker     # Start BullMQ queue worker
npm run temporal:worker  # Start Temporal worker
```

### CLI
```bash
# User management
npm run cli user list                              # List all users
npm run cli user create "John" "john@example.com"  # Create user

# WebSocket
npm run cli ws listen demo                         # Listen to WebSocket channel
npm run cli ws send demo "Hello!"                  # Send WebSocket message

# Temporal workflows
npm run cli task start build -p myproject          # Start build workflow
npm run cli task status <workflowId>               # Get workflow status
npm run cli task status <workflowId> -f            # Follow workflow progress
npm run cli task list                              # List all workflows
npm run cli task cancel <workflowId>               # Cancel workflow
```

## Project Structure

```
corestack/
├── src/                    # Frontend source (Vite + React Router 7)
│   ├── main.tsx           # Entry point
│   ├── App.tsx            # Root component with providers
│   ├── routes/            # React Router routes
│   │   ├── router.tsx     # Route configuration
│   │   ├── layout.tsx     # Root layout
│   │   ├── index.tsx      # Home page (redirects)
│   │   ├── login.tsx      # Login page
│   │   └── dashboard/     # Dashboard routes (4-level nesting)
│   │       ├── layout.tsx        # Dashboard shell
│   │       ├── index.tsx         # Dashboard home
│   │       ├── projects.tsx      # Projects list (Level 1)
│   │       └── projects/
│   │           └── $projectId/   # Project detail (Level 2)
│   │               ├── index.tsx
│   │               └── envs/
│   │                   └── $envId/  # Environment (Level 3-4)
│   │                       ├── index.tsx
│   │                       └── metrics.tsx
│   ├── lib/               # Frontend utilities
│   │   ├── trpc.tsx      # tRPC client setup
│   │   └── url-state.ts  # URL state management for filters
│   └── styles/
│       └── globals.css
├── server-fastify/        # Fastify API server
│   ├── index.ts          # Server entry point
│   └── plugins/          # Fastify plugins
│       ├── health.ts     # Health check endpoints
│       └── metrics.ts    # Prometheus metrics
├── server/               # Business logic (unchanged)
│   ├── routers/         # tRPC routers
│   ├── queue/           # BullMQ workers
│   ├── temporal/        # Temporal workflows & workers
│   │   ├── workflows/   # Workflow definitions
│   │   ├── activities/  # Activity implementations
│   │   └── workers/     # Worker configurations
│   └── websocket.ts     # WebSocket server
├── lib/                  # Shared libraries (unchanged)
│   ├── auth/            # Authentication
│   ├── db/              # Database & schema
│   ├── trpc/            # tRPC core configuration
│   ├── websocket/       # WebSocket client
│   ├── queue/           # Queue configuration
│   └── temporal/        # Temporal client & config
├── cli/                  # CLI client (unchanged)
├── docs/                 # Documentation
│   ├── proposal/        # Migration proposals
│   │   └── nextjs-to-react-router-migration.md
│   ├── architecture/    # Architecture docs
│   ├── features/        # Feature guides
│   └── development/     # Development guides
├── public/              # Static assets
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript config (frontend)
├── tsconfig.server.json # TypeScript config (backend)
└── scripts/             # Utility scripts
```

## Environment Variables

Required environment variables (see `.env.example`):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb
REDIS_URL=redis://localhost:6379
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
PORT=3000
WS_PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key
```

Optional LDAP configuration:
```env
LDAP_URL=ldap://your-ldap-server:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
