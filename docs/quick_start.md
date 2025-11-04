# Quick Start Guide

This guide will help you quickly initialize and run CoreStack on Linux or MacOS, with or without Docker, and even in offline/on-premises environments with limited internet access.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (1-Minute Setup)](#quick-start-1-minute-setup)
- [Setup Options](#setup-options)
  - [Docker Setup (Recommended)](#docker-setup-recommended)
  - [Local Services Setup](#local-services-setup)
  - [Offline/On-Premises Setup](#offlineon-premises-setup)
- [Running the Application](#running-the-application)
- [Accessing the Application](#accessing-the-application)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Minimum Requirements

- **Node.js** 18+ (preferably 20+)
- **npm** 9+ (comes with Node.js)
- **Git** 2+

### Optional (Choose Based on Setup)

**For Docker Setup (Recommended):**
- Docker 20+
- Docker Compose 2+

**For Local Services Setup:**
- PostgreSQL 14+
- Redis 7+
- Temporal Server (via Docker or manual installation)

**For Enhanced Developer Experience:**
- tmux 3+ (for managing multiple services in one terminal)

## Quick Start (1-Minute Setup)

The fastest way to get CoreStack up and running:

```bash
# 1. Clone the repository
git clone <repository-url>
cd corestack

# 2. Run initialization (auto-detects Docker and sets everything up)
./init.sh

# 3. Start all services
./run.sh
```

That's it! The application will be available at http://localhost:3000

**Default credentials**: username: `root`, password: `Must-Changed`

## Setup Options

### Docker Setup (Recommended)

Best for: Development environments with Docker installed

**Advantages:**
- ✅ No manual service installation
- ✅ Consistent environment across machines
- ✅ Easy cleanup and reset
- ✅ Works offline once images are pulled

**Setup:**

```bash
# Initialize with Docker
./init.sh --docker

# Or use npm scripts
npm run init -- --docker
```

**What it does:**
1. Detects your operating system (Linux/MacOS)
2. Checks Node.js and npm versions
3. Installs npm dependencies
4. Generates secure environment variables (.env)
5. Starts PostgreSQL, Redis, and Temporal in Docker
6. Runs database migrations
7. Seeds initial data (creates default admin user)

### Local Services Setup

Best for: Environments where Docker is not available or preferred

**Prerequisites:**
- PostgreSQL 14+ installed and running
- Redis 7+ installed and running
- Temporal Server running (can still use Docker just for Temporal)

**Setup:**

```bash
# Initialize without Docker
./init.sh --no-docker

# Or use npm scripts
npm run init -- --no-docker
```

**Manual Service Setup:**

If you don't have the services running, here's how to set them up:

**PostgreSQL (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**PostgreSQL (MacOS with Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Redis (Ubuntu/Debian):**
```bash
sudo apt install redis-server
sudo systemctl start redis-server
```

**Redis (MacOS with Homebrew):**
```bash
brew install redis
brew services start redis
```

**Temporal (via Docker):**
```bash
# Temporal is complex to install manually, recommend using Docker
docker compose up -d temporal temporal-ui
```

### Offline/On-Premises Setup

Best for: Air-gapped or restricted network environments

**Requirements:**
- Node.js and npm already installed
- npm packages pre-cached (see below)
- Docker images pre-pulled (if using Docker)

**Pre-requisites (on machine with internet):**

```bash
# 1. Clone the repository
git clone <repository-url>
cd corestack

# 2. Download all npm dependencies to cache
npm install

# 3. If using Docker, pull images
docker compose pull

# 4. Package the project (including node_modules)
cd ..
tar -czf corestack-offline.tar.gz corestack/
```

**Setup on Offline Machine:**

```bash
# 1. Extract the package
tar -xzf corestack-offline.tar.gz
cd corestack/

# 2. Initialize in offline mode
./init.sh --docker --offline

# Or without Docker
./init.sh --no-docker --offline
```

**Offline mode features:**
- Uses `npm install --offline --prefer-offline` to use cache only
- Skips internet connectivity checks
- Uses local Docker images (no pull attempts)

**Using npm over Proxy:**

If you have npm access through a corporate proxy:

```bash
# Configure npm proxy (one-time setup)
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Then run normal initialization
./init.sh --docker
```

## Running the Application

After initialization, you have multiple options to run the application:

### Option 1: Automated Run Script (Recommended)

Easiest way to start all services:

```bash
# Auto-detect best options (tmux if available)
./run.sh

# Or use npm script
npm run run
```

**With tmux (Recommended):**
```bash
./run.sh --tmux --docker
```

**Without tmux (Foreground mode):**
```bash
./run.sh --no-tmux
```

**Tmux Controls:**
- `Ctrl+B` then `0-3`: Switch between service windows
- `Ctrl+B` then `D`: Detach (services keep running in background)
- `tmux attach -t corestack`: Reattach to session
- `tmux kill-session -t corestack`: Stop all services

### Option 2: Manual Service Management

If you prefer to manage each service separately:

**Terminal 1 - Docker Services (if using Docker):**
```bash
docker compose up -d
# Or: npm run docker:up
```

**Terminal 2 - Next.js Dev Server:**
```bash
npm run dev
```

**Terminal 3 - WebSocket Server:**
```bash
npm run ws:server
```

**Terminal 4 - Queue Worker:**
```bash
npm run queue:worker
```

**Terminal 5 - Temporal Worker:**
```bash
npm run temporal:worker
```

### Option 3: Background Services with Logs

Run services in background and monitor logs:

```bash
# Start Docker services
npm run docker:up

# Start Node.js services in background
npm run ws:server &
npm run queue:worker &
npm run temporal:worker &
npm run dev

# View Docker logs
npm run docker:logs
```

## Accessing the Application

Once all services are running, access the application:

| Service | URL | Description |
|---------|-----|-------------|
| **Web Application** | http://localhost:3000 | Main Next.js application |
| **WebSocket Server** | ws://localhost:3001 | Real-time communication |
| **Temporal UI** | http://localhost:8080 | Workflow monitoring (Docker only) |
| **Database Studio** | Run `npm run db:studio` | Drizzle Studio database GUI |

**Default Admin Credentials:**
- Username: `root`
- Password: `Must-Changed`

**⚠️ IMPORTANT:** Change the default password immediately after first login!

## Helpful Commands

### Initialization Scripts

```bash
./init.sh --help              # Show all initialization options
./init.sh --docker            # Initialize with Docker services
./init.sh --no-docker         # Initialize with local services
./init.sh --offline           # Initialize in offline mode
```

### Run Scripts

```bash
./run.sh --help               # Show all run options
./run.sh --tmux --docker      # Start with tmux and Docker
./run.sh --no-tmux            # Start in foreground mode
```

### Docker Management

```bash
npm run docker:up             # Start Docker services
npm run docker:down           # Stop Docker services
npm run docker:logs           # View Docker logs

# Or use docker compose directly
docker compose up -d          # Start services in background
docker compose ps             # Check service status
docker compose logs -f        # Follow logs
docker compose down           # Stop all services
docker compose restart        # Restart all services
```

### Database Management

```bash
npm run db:migrate            # Run database migrations
npm run db:seed               # Seed initial data
npm run db:studio             # Open Drizzle Studio (database GUI)
npm run db:push               # Push schema changes (dev only)
```

### Code Quality

```bash
npm run lint                  # Check code quality
npm run lint:fix              # Auto-fix linting issues
npm run type-check            # TypeScript validation
```

## Troubleshooting

### PostgreSQL Connection Issues

**Error:** `ECONNREFUSED` or `Connection refused`

**Solution:**
```bash
# Check if PostgreSQL is running
docker compose ps postgres    # If using Docker

# Or for local installation
sudo systemctl status postgresql    # Linux
brew services list                  # MacOS

# Verify connection
docker compose exec postgres pg_isready -U postgres
```

### Redis Connection Issues

**Error:** `Redis connection failed`

**Solution:**
```bash
# Check if Redis is running
docker compose ps redis       # If using Docker

# Or for local installation
sudo systemctl status redis-server    # Linux
brew services list                    # MacOS

# Test connection
docker compose exec redis redis-cli ping    # Should return PONG
```

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process using the port
lsof -i :3000                 # MacOS/Linux
sudo netstat -tlnp | grep 3000    # Linux

# Kill the process
kill -9 <PID>

# Or use different ports in .env
PORT=3001
WS_PORT=3002
```

### Docker Permission Issues

**Error:** `permission denied while trying to connect to the Docker daemon socket`

**Solution (Linux):**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again, or
newgrp docker
```

### Temporal Worker Connection Failed

**Error:** `[TEMPORAL] Failed to connect to Temporal Server`

**Solution:**
```bash
# Check if Temporal is running
docker compose ps temporal

# Wait for Temporal to be fully ready (can take 10-30 seconds)
docker compose logs -f temporal

# Restart Temporal if needed
docker compose restart temporal
```

### Node.js Version Issues

**Error:** `Node.js version XX is too old`

**Solution:**
```bash
# Check your Node.js version
node -v

# Install Node.js 18+ or 20+
# Using nvm (recommended):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Or download from: https://nodejs.org
```

### Missing Dependencies in Offline Mode

**Error:** `npm ERR! Could not resolve dependency`

**Solution:**
```bash
# Ensure you have all dependencies cached
# On a machine with internet:
npm install --prefer-offline

# Copy the entire node_modules and package-lock.json
# to the offline machine
```

### Environment Variables Not Set

**Error:** `Environment variable XXX is not set`

**Solution:**
```bash
# Ensure .env file exists
ls -la .env

# If missing, run initialization again
./init.sh

# Or manually copy from example
cp .env.example .env
# Edit .env and fill in required values
```

### tmux Session Already Exists

**Warning:** `Tmux session 'corestack' already exists`

**Solution:**
```bash
# Attach to existing session
tmux attach -t corestack

# Or kill and restart
tmux kill-session -t corestack
./run.sh --tmux
```

## Next Steps

After successfully running the application:

1. **Change default password** - Login and change the admin password
2. **Explore the documentation** - See [README.md](../README.md) for comprehensive guides
3. **Try the CLI** - Run `npm run cli -- --help` to see CLI options
4. **Create a new user** - Use the CLI: `npm run cli user create "Name" "email@example.com"`
5. **Start a workflow** - Try Temporal workflows: `npm run cli task start build -p myproject`

## Additional Resources

- [Main README](../README.md) - Full project documentation
- [Local Development Guide](./development/local_development_guide.md) - Detailed development setup
- [Architecture Overview](./architecture.md) - System architecture
- [API Reference](./api.md) - tRPC endpoints
- [Database Guide](./database.md) - Database schema and migrations
- [Authentication Guide](./features/authentication.md) - Authentication setup

## Getting Help

If you encounter issues not covered in this guide:

1. Check the [Local Development Guide](./development/local_development_guide.md)
2. Review Docker logs: `npm run docker:logs`
3. Check service status: `docker compose ps`
4. Open an issue on GitHub with:
   - Your operating system and version
   - Node.js version (`node -v`)
   - Error messages and logs
   - Steps to reproduce
