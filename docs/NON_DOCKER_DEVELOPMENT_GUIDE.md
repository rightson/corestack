# Non-Docker/K8s Development Guide

This guide is designed for developers who want to run the Lightweight Web Seed project locally **without using Docker or Kubernetes**. You'll set up and run all services directly on your development machine.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Development Workflow](#development-workflow)
- [Testing and Quality Checks](#testing-and-quality-checks)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

---

## Prerequisites

Before you begin, ensure you have the following installed on your local machine:

### Required Software

1. **Node.js** (v20.x or later recommended)
   ```bash
   # Check your Node.js version
   node --version
   ```
   - Download from: https://nodejs.org/
   - Recommended: Use [nvm](https://github.com/nvm-sh/nvm) for managing Node.js versions

2. **PostgreSQL** (v16 or later recommended)
   ```bash
   # Check your PostgreSQL version
   psql --version
   ```

   **Installation by platform:**

   - **macOS**:
     ```bash
     brew install postgresql@16
     brew services start postgresql@16
     ```

   - **Ubuntu/Debian**:
     ```bash
     sudo apt update
     sudo apt install postgresql postgresql-contrib
     sudo systemctl start postgresql
     sudo systemctl enable postgresql
     ```

   - **Windows**: Download from https://www.postgresql.org/download/windows/

3. **Redis** (v7 or later recommended)
   ```bash
   # Check your Redis version
   redis-cli --version
   ```

   **Installation by platform:**

   - **macOS**:
     ```bash
     brew install redis
     brew services start redis
     ```

   - **Ubuntu/Debian**:
     ```bash
     sudo apt update
     sudo apt install redis-server
     sudo systemctl start redis-server
     sudo systemctl enable redis-server
     ```

   - **Windows**: Use [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) or download from https://redis.io/download

4. **Git**
   ```bash
   git --version
   ```

### Optional Tools

- **pgAdmin** or **DBeaver**: GUI tools for PostgreSQL database management
- **RedisInsight**: GUI tool for Redis management
- **Postman** or **Insomnia**: For API testing

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd lightweight-web-seed
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required Node.js packages including:
- Next.js 15 (frontend framework)
- tRPC 11 (type-safe API)
- Drizzle ORM (database ORM)
- BullMQ (task queue)
- WebSocket support
- And many more...

### 3. Verify Installation

```bash
# Check that all peer dependencies are installed
npm list
```

---

## Database Setup

### 1. Create PostgreSQL Database

Connect to PostgreSQL and create a database:

```bash
# Connect to PostgreSQL as the postgres user
psql -U postgres

# Inside psql, create a database
CREATE DATABASE mydb;

# Create a user (optional, if you want a dedicated user)
CREATE USER myuser WITH PASSWORD 'mypassword';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE mydb TO myuser;

# Exit psql
\q
```

### 2. Verify Database Connection

Test that you can connect to the database:

```bash
# Using the default postgres user
psql -U postgres -d mydb -c "SELECT version();"

# Or with your custom user
psql -U myuser -d mydb -c "SELECT version();"
```

### 3. Verify Redis Connection

Test that Redis is running:

```bash
redis-cli ping
# Expected output: PONG
```

---

## Environment Configuration

### 1. Copy Environment Variables

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Open `.env` in your text editor and update the following values:

```bash
# Database - Update with your PostgreSQL credentials
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb

# Redis - Usually works with defaults
REDIS_URL=redis://localhost:6379

# Server Ports
PORT=3000           # Next.js application port
WS_PORT=3001        # WebSocket server port

# Environment
NODE_ENV=development

# Authentication - IMPORTANT: Change this secret!
JWT_SECRET=your-secret-key-change-in-production-make-it-long-and-random

# SSH Operations - Generate a new key with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SSH_ENCRYPTION_KEY=c4ccffc64dedc1a329a65d35b5633a92f9888a272f737b875baa90fa99a88d19

# LDAP (Optional - only if you're using LDAP authentication)
# LDAP_URL=ldap://your-ldap-server:389
# LDAP_BIND_DN=cn=admin,dc=example,dc=com
# LDAP_BIND_PASSWORD=password
# LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
# LDAP_USERNAME_ATTRIBUTE=uid
```

**Important Notes:**
- For development, you can keep the default `JWT_SECRET`, but **always change it in production**
- The `SSH_ENCRYPTION_KEY` should be a 64-character hex string (32 bytes)
- If you're not using LDAP, you can leave those variables commented out

### 3. Generate a Secure JWT Secret (Recommended)

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and replace the `JWT_SECRET` value in your `.env` file.

---

## Running the Application

The application consists of **three separate services** that need to run simultaneously. You'll need **three terminal windows** (or use a terminal multiplexer like `tmux` or `screen`).

### Step 1: Initialize the Database

**First time only** - Apply the database schema and seed initial data:

```bash
# Push the database schema to PostgreSQL
npm run db:push

# Seed the database with initial data
npm run db:seed
```

This creates:
- All database tables (users, posts, tasks, projects, etc.)
- A default admin user: `root` / `Must-Changed`
- Sample data for testing

### Step 2: Start the Services

Open **three terminal windows** and run each service:

#### Terminal 1: Next.js Web Application

```bash
npm run dev
```

- Starts the Next.js development server with Turbopack
- Accessible at: http://localhost:3000
- Features: React frontend, tRPC API, authentication

#### Terminal 2: WebSocket Server

```bash
npm run ws:server
```

- Starts the WebSocket server for real-time communication
- Accessible at: ws://localhost:3001
- Features: Channel subscriptions, broadcasting, connection management

#### Terminal 3: Background Job Worker

```bash
npm run queue:worker
```

- Starts the BullMQ worker for processing background jobs
- Processes tasks from three queues: DEFAULT, EMAIL, PROCESSING
- Features: Email sending, data processing, scheduled tasks

### Step 3: Verify All Services Are Running

1. **Web Application**: Open http://localhost:3000 in your browser
2. **WebSocket**: Check the terminal for "WebSocket server started on ws://localhost:3001"
3. **Queue Worker**: Check the terminal for "Worker started successfully"

### Step 4: Login to the Application

Default credentials:
- **Username**: `root`
- **Password**: `Must-Changed`

**Important**: Change the default password after your first login!

---

## Development Workflow

### Running Individual Commands

```bash
# Type checking (no compilation, just validation)
npm run type-check

# Linting (check for code style issues)
npm run lint

# Linting with auto-fix
npm run lint:fix

# Build for production (testing the build process)
npm run build

# Start production build locally
npm run start
```

### Database Operations

```bash
# Open Drizzle Studio (visual database editor)
npm run db:studio
# Accessible at: https://local.drizzle.studio

# Generate database migrations (when you change schema.ts)
npm run db:generate

# Push schema changes directly (development only)
npm run db:push

# Run migrations (production approach)
npm run db:migrate

# Re-seed the database (WARNING: may clear existing data)
npm run db:seed
```

### CLI Client

The project includes a CLI client for interacting with the application:

```bash
# Show available commands
npm run cli -- --help

# Example: Create a new user
npm run cli -- user create --email user@example.com --name "John Doe"

# Example: List all tasks
npm run cli -- task list
```

### Development Best Practices

1. **Always run type-check before committing**:
   ```bash
   npm run type-check
   ```

2. **Fix linting issues**:
   ```bash
   npm run lint:fix
   ```

3. **Test the build**:
   ```bash
   npm run build
   ```

4. **Pre-push hooks**: The project uses Husky to automatically run type-check and tests before pushing to Git

5. **Code formatting**: The project uses lint-staged to automatically format code on commit

---

## Testing and Quality Checks

### Manual Testing

1. **Authentication Flow**:
   - Visit http://localhost:3000
   - Login with `root` / `Must-Changed`
   - Navigate through the application

2. **WebSocket Testing**:
   - Check the WebSocket demo page
   - Verify real-time message delivery

3. **API Testing**:
   - Use Postman or curl to test tRPC endpoints
   - Example tRPC endpoint: http://localhost:3000/api/trpc

### Pre-commit Hooks

The project automatically runs:
- ESLint on staged files
- Type checking (via pre-push hook)

To bypass hooks (not recommended):
```bash
git commit --no-verify
```

### Health Checks

Check service health:
```bash
# Application health (Next.js should be running)
curl http://localhost:3000/api/health

# Check logs for errors
# (logs are output to console with pino-pretty formatting)
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. PostgreSQL Connection Error

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution**:
```bash
# Check if PostgreSQL is running
pg_isready

# If not running, start it:
# macOS:
brew services start postgresql@16

# Linux:
sudo systemctl start postgresql
```

#### 2. Redis Connection Error

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution**:
```bash
# Check if Redis is running
redis-cli ping

# If not running, start it:
# macOS:
brew services start redis

# Linux:
sudo systemctl start redis-server
```

#### 3. Port Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find and kill the process using the port
# macOS/Linux:
lsof -ti:3000 | xargs kill -9

# Or change the port in .env:
PORT=3001
```

#### 4. Database Schema Issues

**Error**: `relation "users" does not exist`

**Solution**:
```bash
# Re-push the database schema
npm run db:push

# If that doesn't work, drop and recreate the database:
psql -U postgres -c "DROP DATABASE mydb;"
psql -U postgres -c "CREATE DATABASE mydb;"
npm run db:push
npm run db:seed
```

#### 5. TypeScript Errors

**Error**: Various TypeScript compilation errors

**Solution**:
```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Run type-check to see all errors
npm run type-check
```

#### 6. Missing Environment Variables

**Error**: `Environment variable not found: JWT_SECRET`

**Solution**:
```bash
# Make sure .env file exists
cp .env.example .env

# Edit .env and add all required variables
nano .env
```

#### 7. WebSocket Connection Failed (Browser)

**Error**: WebSocket connection failed in browser console

**Solution**:
1. Verify WebSocket server is running: `npm run ws:server`
2. Check the port in your code matches `WS_PORT` in `.env`
3. Ensure no firewall is blocking port 3001

#### 8. BullMQ Worker Not Processing Jobs

**Error**: Jobs are stuck in queue

**Solution**:
1. Verify Redis is running: `redis-cli ping`
2. Check worker is running: `npm run queue:worker`
3. Check Redis connection in `.env`
4. Monitor worker logs for errors

---

## Project Structure

Understanding the project structure helps with development:

```
lightweight-web-seed/
├── app/                      # Next.js App Router pages
│   ├── page.tsx             # Home page
│   ├── login/               # Login page
│   ├── api/                 # API routes (tRPC)
│   └── layout.tsx           # Root layout
│
├── components/              # React components
│   ├── UserList.tsx        # User management component
│   ├── WebSocketDemo.tsx   # WebSocket demo component
│   └── ...
│
├── lib/                     # Core libraries
│   ├── auth/               # Authentication service (JWT, LDAP)
│   ├── db/                 # Database configuration & schema
│   ├── trpc/               # tRPC setup (client & server)
│   ├── queue/              # BullMQ task queue setup
│   ├── websocket/          # WebSocket client utilities
│   ├── ssh/                # SSH operations (connection pooling)
│   └── observability/      # Logging (Pino) & metrics (Prometheus)
│
├── server/                  # Backend services
│   ├── routers/            # tRPC API routers
│   │   ├── user.ts         # User operations
│   │   ├── post.ts         # Post operations
│   │   ├── task.ts         # Task operations
│   │   ├── project.ts      # Project management
│   │   ├── ssh.ts          # SSH operations
│   │   └── _app.ts         # Root router
│   ├── websocket.ts        # WebSocket server
│   └── queue/              # Background job workers
│       └── worker.ts       # BullMQ worker
│
├── cli/                     # Command-line interface
│   └── index.ts            # CLI entry point
│
├── scripts/                 # Utility scripts
│   └── seed.ts             # Database seeding script
│
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md     # System architecture
│   ├── API.md              # API documentation
│   ├── AUTHENTICATION.md   # Auth guide
│   └── ...                 # More documentation
│
├── .env                     # Environment variables (create from .env.example)
├── .env.example            # Environment variables template
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript configuration
├── drizzle.config.ts       # Drizzle ORM configuration
├── next.config.ts          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
└── eslint.config.mjs       # ESLint configuration
```

### Key Files to Know

- **`lib/db/schema.ts`**: Database schema definition (all tables)
- **`server/routers/_app.ts`**: Main tRPC router (API entry point)
- **`lib/auth/service.ts`**: Authentication logic
- **`app/api/trpc/[trpc]/route.ts`**: tRPC API endpoint
- **`.env`**: Your local environment variables

---

## Next Steps

After successfully running the application locally:

1. **Read the documentation**: Explore the `/docs` folder for detailed guides
   - `ARCHITECTURE.md`: Understand the system design
   - `API.md`: Learn about available API endpoints
   - `AUTHENTICATION.md`: Deep dive into auth flows
   - `WEBSOCKET.md`: WebSocket implementation details
   - `TASK_QUEUE.md`: Background job processing

2. **Explore the codebase**: Start with:
   - `server/routers/`: API implementation
   - `lib/db/schema.ts`: Database schema
   - `components/`: React UI components

3. **Make your first change**:
   - Add a new field to a database table
   - Create a new tRPC endpoint
   - Build a new React component

4. **Join the development workflow**:
   - Create a feature branch
   - Make your changes
   - Run tests and type-check
   - Submit a pull request

---

## Additional Resources

- **Next.js Documentation**: https://nextjs.org/docs
- **tRPC Documentation**: https://trpc.io/docs
- **Drizzle ORM Documentation**: https://orm.drizzle.team/docs/overview
- **BullMQ Documentation**: https://docs.bullmq.io/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Redis Documentation**: https://redis.io/docs/

---

## Getting Help

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review the relevant documentation in `/docs`
3. Check application logs (console output from each service)
4. Ask your team or project maintainers

Happy coding! 🚀
