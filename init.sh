#!/bin/bash

# CoreStack Initialization Script
# Supports: Linux, MacOS, with/without Docker, online/offline environments
# Usage: ./init.sh [--docker|--no-docker] [--offline]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
USE_DOCKER=""
OFFLINE_MODE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --docker)
      USE_DOCKER=true
      shift
      ;;
    --no-docker)
      USE_DOCKER=false
      shift
      ;;
    --offline)
      OFFLINE_MODE=true
      shift
      ;;
    --help)
      echo "CoreStack Initialization Script"
      echo ""
      echo "Usage: ./init.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --docker      Use Docker for PostgreSQL, Redis, and Temporal"
      echo "  --no-docker   Use local installations (manual setup required)"
      echo "  --offline     Offline mode (skip online checks, use npm cache)"
      echo "  --help        Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./init.sh --docker                # Auto-detect, prefer Docker"
      echo "  ./init.sh --no-docker             # Use local services"
      echo "  ./init.sh --docker --offline      # Docker setup in offline environment"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   CoreStack Initialization Script         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Detect OS
detect_os() {
  echo -e "${BLUE}[1/8] Detecting operating system...${NC}"

  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    echo -e "${GREEN}✓ Detected: Linux${NC}"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    echo -e "${GREEN}✓ Detected: MacOS${NC}"
  else
    echo -e "${RED}✗ Unsupported OS: $OSTYPE${NC}"
    echo -e "${YELLOW}  This script supports Linux and MacOS only${NC}"
    exit 1
  fi
  echo ""
}

# Check Node.js and npm
check_node() {
  echo -e "${BLUE}[2/8] Checking Node.js and npm...${NC}"

  if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo -e "${YELLOW}  Please install Node.js 18+ from https://nodejs.org${NC}"
    exit 1
  fi

  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version $NODE_VERSION is too old${NC}"
    echo -e "${YELLOW}  Please upgrade to Node.js 18 or higher${NC}"
    exit 1
  fi

  if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
  echo -e "${GREEN}✓ npm $(npm -v)${NC}"
  echo ""
}

# Auto-detect Docker availability if not specified
detect_docker() {
  echo -e "${BLUE}[3/8] Checking Docker availability...${NC}"

  if [ -z "$USE_DOCKER" ]; then
    if command -v docker &> /dev/null && docker ps &> /dev/null; then
      USE_DOCKER=true
      echo -e "${GREEN}✓ Docker is available and running${NC}"
      echo -e "${YELLOW}  Will use Docker for services (PostgreSQL, Redis, Temporal)${NC}"
    else
      USE_DOCKER=false
      echo -e "${YELLOW}⚠ Docker not available or not running${NC}"
      echo -e "${YELLOW}  Will use local services (requires manual setup)${NC}"
    fi
  else
    if [ "$USE_DOCKER" = true ]; then
      if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker not found but --docker was specified${NC}"
        exit 1
      fi
      if ! docker ps &> /dev/null; then
        echo -e "${RED}✗ Docker daemon not running${NC}"
        echo -e "${YELLOW}  Please start Docker and try again${NC}"
        exit 1
      fi
      echo -e "${GREEN}✓ Docker is available and running${NC}"
    else
      echo -e "${YELLOW}⚠ Using local services (--no-docker specified)${NC}"
    fi
  fi
  echo ""
}

# Install dependencies
install_dependencies() {
  echo -e "${BLUE}[4/8] Installing dependencies...${NC}"

  if [ "$OFFLINE_MODE" = true ]; then
    echo -e "${YELLOW}⚠ Offline mode: Using npm cache only${NC}"
    if npm install --offline --prefer-offline 2>/dev/null; then
      echo -e "${GREEN}✓ Dependencies installed from cache${NC}"
    else
      echo -e "${YELLOW}⚠ Some dependencies missing from cache, trying regular install...${NC}"
      npm install --prefer-offline
    fi
  else
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
  fi
  echo ""
}

# Setup environment variables
setup_env() {
  echo -e "${BLUE}[5/8] Setting up environment variables...${NC}"

  if [ -f .env ]; then
    echo -e "${YELLOW}⚠ .env file already exists${NC}"
    read -p "  Overwrite? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}  Skipping .env setup${NC}"
      echo ""
      return
    fi
  fi

  # Copy template
  cp .env.example .env

  # Generate secure secrets
  JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  SSH_KEY=$(openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

  # Update .env file
  if [[ "$OS" == "macos" ]]; then
    sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    sed -i '' "s|SSH_ENCRYPTION_KEY=.*|SSH_ENCRYPTION_KEY=$SSH_KEY|" .env
  else
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    sed -i "s|SSH_ENCRYPTION_KEY=.*|SSH_ENCRYPTION_KEY=$SSH_KEY|" .env
  fi

  echo -e "${GREEN}✓ Environment file created (.env)${NC}"
  echo -e "${GREEN}✓ Generated secure JWT_SECRET${NC}"
  echo -e "${GREEN}✓ Generated secure SSH_ENCRYPTION_KEY${NC}"
  echo ""
}

# Start services
start_services() {
  echo -e "${BLUE}[6/8] Starting services...${NC}"

  if [ "$USE_DOCKER" = true ]; then
    echo -e "${YELLOW}  Starting Docker services (PostgreSQL, Redis, Temporal)...${NC}"
    docker compose up -d

    # Wait for services to be ready
    echo -e "${YELLOW}  Waiting for services to be ready...${NC}"
    sleep 5

    # Check PostgreSQL
    for i in {1..30}; do
      if docker compose exec -T postgres pg_isready -U postgres &> /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
        break
      fi
      if [ $i -eq 30 ]; then
        echo -e "${RED}✗ PostgreSQL failed to start${NC}"
        exit 1
      fi
      sleep 1
    done

    # Check Redis
    if docker compose exec -T redis redis-cli ping &> /dev/null; then
      echo -e "${GREEN}✓ Redis is ready${NC}"
    fi

    echo -e "${GREEN}✓ Temporal Server is starting (port 7233)${NC}"
    echo -e "${GREEN}✓ Temporal UI will be available at http://localhost:8080${NC}"
  else
    echo -e "${YELLOW}⚠ Local services mode${NC}"
    echo -e "${YELLOW}  Please ensure the following services are running:${NC}"
    echo -e "${YELLOW}  - PostgreSQL (port 5432)${NC}"
    echo -e "${YELLOW}  - Redis (port 6379)${NC}"
    echo -e "${YELLOW}  - Temporal Server (port 7233)${NC}"
    echo ""
    read -p "  Press Enter when services are ready..."
  fi
  echo ""
}

# Setup database
setup_database() {
  echo -e "${BLUE}[7/8] Setting up database...${NC}"

  # Run migrations
  echo -e "${YELLOW}  Running database migrations...${NC}"
  npm run db:migrate
  echo -e "${GREEN}✓ Database migrations completed${NC}"

  # Seed database
  echo -e "${YELLOW}  Seeding database...${NC}"
  npm run db:seed
  echo -e "${GREEN}✓ Database seeded with initial data${NC}"
  echo ""
}

# Display success message
display_success() {
  echo -e "${BLUE}[8/8] Initialization complete!${NC}"
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   CoreStack is ready!                     ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BLUE}Default admin credentials:${NC}"
  echo -e "  Username: ${GREEN}root${NC}"
  echo -e "  Password: ${YELLOW}Must-Changed${NC}"
  echo -e "  ${RED}⚠ Please change the password after first login!${NC}"
  echo ""
  echo -e "${BLUE}To start the application:${NC}"
  echo -e "  ${GREEN}./run.sh${NC}                 # Start all services in tmux"
  echo -e "  ${GREEN}npm run dev${NC}              # Start Next.js dev server only"
  echo ""
  echo -e "${BLUE}Useful commands:${NC}"
  echo -e "  ${GREEN}docker compose logs -f${NC}   # View Docker service logs"
  echo -e "  ${GREEN}npm run db:studio${NC}        # Open database GUI"
  echo -e "  ${GREEN}npm run lint${NC}             # Check code quality"
  echo ""
  echo -e "${BLUE}Access points:${NC}"
  echo -e "  Next.js App:    ${GREEN}http://localhost:3000${NC}"
  echo -e "  WebSocket:      ${GREEN}ws://localhost:3001${NC}"
  echo -e "  Temporal UI:    ${GREEN}http://localhost:8080${NC}"
  echo ""
}

# Main execution
main() {
  detect_os
  check_node
  detect_docker
  install_dependencies
  setup_env
  start_services
  setup_database
  display_success
}

# Run main function
main
