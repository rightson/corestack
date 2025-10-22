# Lightweight Web Seed Stack

A modern, full-stack web application seed with Next.js, tRPC, Drizzle ORM, WebSocket support, and task queue functionality. Built with TypeScript and designed for both browser and CLI clients.

## Features

### Core Functionality
- ✅ **Type-safe API** with tRPC - End-to-end type safety from client to server
- ✅ **Database ORM** with Drizzle (PostgreSQL) - Type-safe database queries and schema management
- ✅ **Real-time Communication** - WebSocket server for bidirectional messaging
- ✅ **Background Jobs** - Task queue with BullMQ and Redis
- ✅ **CLI Client** - Command-line interface for API and WebSocket operations
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
- **PostgreSQL** - Primary database
- **Redis** - Cache and queue backend

## Quick Start

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- npm or yarn

### Installation

1. Clone and install:
```bash
git clone <repository-url>
cd lightweight-web-seed
npm install
```

2. Setup environment:
```bash
cp .env.example .env
```

3. Start services:
```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Push database schema
npm run db:push
```

4. Run the application:
```bash
# Terminal 1 - Next.js app
npm run dev

# Terminal 2 - WebSocket server
npm run ws:server

# Terminal 3 - Queue worker
npm run queue:worker
```

5. Open [http://localhost:3000](http://localhost:3000)

**Default credentials**: username: `root`, password: `Must-Changed`

## Documentation

Comprehensive documentation is available in the `docs/` directory:

### Core Guides

| Guide | Description | Implementation Status |
|-------|-------------|----------------------|
| **[Architecture](docs/ARCHITECTURE.md)** | System architecture and tech stack overview | 🟢 100% Complete |
| **[API Reference](docs/API.md)** | tRPC endpoints and WebSocket protocol | 🟢 100% Complete |
| **[Database Guide](docs/DATABASE.md)** | Schema overview and Drizzle ORM basics | 🟢 95% Complete* |
| **[Authentication](docs/AUTHENTICATION.md)** | Email/password and LDAP authentication | 🟢 100% Complete |
| **[Development Guide](docs/DEVELOPMENT.md)** | Development workflow and adding features | 🟢 100% Complete |
| **[Deployment Guide](docs/DEPLOYMENT.md)** | Production deployment and scaling | 🟡 60% Complete** |
| **[WebSocket Guide](docs/WEBSOCKET.md)** | Real-time communication setup | 🟢 100% Complete |
| **[Task Queue Guide](docs/TASK_QUEUE.md)** | Background job processing | 🟢 100% Complete |
| **[CLI Guide](docs/CLI.md)** | Command-line interface usage | 🟢 100% Complete |
| **[SSH Remote Operations](docs/SSH.md)** | SSH operations and remote file management | 🟢 100% Complete |
| **[Bun Adoption](docs/BUN_ADOPTION.md)*** | Bun runtime migration strategy | 🔴 0% Complete |

<sub>*Database: Schema complete, migrations not yet generated via `drizzle-kit generate`</sub>
<sub>**Deployment: Local Docker setup complete, production CI/CD and monitoring not configured</sub>
<sub>***Bun Adoption: Design/planning phase only, not yet implemented</sub>

### Detailed Documentation

Each topic has detailed documentation in subfolders:

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

### Development
```bash
npm run dev          # Start Next.js development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
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
npm run ws:server     # Start WebSocket server
npm run queue:worker  # Start queue worker
```

### CLI
```bash
npm run cli user list                              # List all users
npm run cli user create "John" "john@example.com"  # Create user
npm run cli ws listen demo                         # Listen to WebSocket channel
npm run cli ws send demo "Hello!"                  # Send WebSocket message
```

## Project Structure

```
lightweight-web-seed/
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
│   └── queue/            # Queue configuration
├── server/                # Server-side code
│   ├── routers/          # tRPC routers
│   ├── queue/            # Queue workers
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
