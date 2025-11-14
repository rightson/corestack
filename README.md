# CoreStack

A comprehensive, full-stack web application framework with Next.js, tRPC, Drizzle ORM, WebSocket support, workflow orchestration, and task queue functionality. Built with TypeScript and designed for both browser and CLI clients.

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
- **Next.js 15** - React framework with App Router and Turbopack
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **tRPC** - End-to-end type-safe API
- **Drizzle ORM** - Type-safe PostgreSQL ORM
- **WebSocket** - Real-time bidirectional communication
- **BullMQ** - Redis-based task queue
- **Temporal** - Durable workflow orchestration
- **PostgreSQL** - Primary database
- **Redis** - Cache and queue backend

## Quick Start

### Prerequisites

**Minimum Requirements:**
- Node.js 18+ (preferably 20+)
- npm 9+

**Optional (Auto-detected):**
- Docker & Docker Compose (recommended for services)
- tmux 3+ (for unified service management)

### Option 1: Automated Setup (Recommended)

The fastest way to get started - one command does everything:

```bash
# Clone the repository
git clone <repository-url>
cd corestack

# Initialize (auto-detects Docker, sets up everything)
./init.sh

# Start all services
./run.sh
```

**What `./init.sh` does:**
- ✅ Detects your OS (Linux/MacOS)
- ✅ Checks Node.js and npm versions
- ✅ Installs dependencies
- ✅ Generates secure environment variables
- ✅ Starts Docker services (PostgreSQL, Redis, Temporal)
- ✅ Runs database migrations
- ✅ Seeds initial data (creates admin user)

**What `./run.sh` does:**
- ✅ Starts all Node.js services in tmux (if available)
- ✅ Manages 4 service windows: Next.js, WebSocket, Queue Worker, Temporal Worker
- ✅ Provides easy window switching with `Ctrl+B` + number keys

**Access the application:**
- Web UI: [http://localhost:3000](http://localhost:3000)
- Temporal UI: [http://localhost:8080](http://localhost:8080)

**Default credentials:** username: `root`, password: `Must-Changed`
⚠️ **Change the password after first login!**

**Advanced init options:**
```bash
./init.sh --docker          # Force Docker mode
./init.sh --no-docker       # Use local services
./init.sh --offline         # Offline/on-prem mode (uses npm cache)
./init.sh --help            # Show all options
```

**Advanced run options:**
```bash
./run.sh --tmux             # Use tmux (recommended)
./run.sh --no-tmux          # Foreground mode
./run.sh --help             # Show all options
```

**tmux Controls:**
- `Ctrl+B` then `0-3`: Switch between service windows
- `Ctrl+B` then `D`: Detach (services keep running)
- `tmux attach -t corestack`: Reattach to session
- `tmux kill-session -t corestack`: Stop all services

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
# Generate secrets:
#   JWT_SECRET: openssl rand -base64 32
#   SSH_ENCRYPTION_KEY: openssl rand -base64 32
```

3. Start services:
```bash
# Start PostgreSQL, Redis, and Temporal
docker compose up -d

# Run database migrations
npm run db:migrate

# Seed database
npm run db:seed
```

4. Run the application (requires 4 terminals):
```bash
# Terminal 1 - Next.js app
npm run dev

# Terminal 2 - WebSocket server
npm run ws:server

# Terminal 3 - Queue worker (BullMQ)
npm run queue:worker

# Terminal 4 - Temporal worker
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
| **[Quick Start Guide](docs/quick_start.md)** | Fast setup for Linux/MacOS, with/without Docker, online/offline environments |
| **[Codebase Exploration](docs/development/codebase_exploration_summary.md)** | Comprehensive overview of the codebase structure, architecture, and key components |
| **[Local Development Guide](docs/development/local_development_guide.md)** | Step-by-step guide for setting up the project without Docker/Kubernetes |
| **[Manage Utility Design](docs/proposal/interactive_manage_utility.md)** | Design proposal for the interactive management utility (planned feature) |

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

### Quick Start (Recommended)
```bash
./init.sh            # Initialize project (auto-detects Docker)
./init.sh --help     # Show all initialization options
./run.sh             # Start all services (auto-detects tmux)
./run.sh --help      # Show all run options

# Or use npm scripts
npm run init         # Same as ./init.sh
npm run run          # Same as ./run.sh
```

### Development
```bash
npm run dev          # Start Next.js development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript validation
```

### Database
```bash
npm run db:migrate   # Run migrations
npm run db:seed      # Seed initial data
npm run db:generate  # Generate migrations
npm run db:push      # Push schema to database (development)
npm run db:studio    # Open Drizzle Studio
```

### Docker Services
```bash
npm run docker:up    # Start Docker services
npm run docker:down  # Stop Docker services
npm run docker:logs  # View Docker logs
```

### Individual Services
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
├── app/                    # Next.js app directory
│   ├── api/               # API routes (tRPC, queue)
│   ├── login/            # Login page
│   └── projects/         # Projects dashboard
├── components/            # React components
├── lib/                   # Shared libraries
│   ├── auth/             # Authentication
│   ├── db/               # Database & schema
│   ├── trpc/             # tRPC configuration
│   ├── websocket/        # WebSocket client
│   ├── queue/            # Queue configuration
│   └── temporal/         # Temporal client & config
├── server/                # Server-side code
│   ├── routers/          # tRPC routers
│   ├── queue/            # BullMQ workers
│   ├── temporal/         # Temporal workflows & workers
│   │   ├── workflows/    # Workflow definitions
│   │   ├── activities/   # Activity implementations
│   │   └── workers/      # Worker configurations
│   └── websocket.ts      # WebSocket server
├── cli/                   # CLI client
├── docs/                  # Documentation
└── scripts/               # Utility scripts
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
