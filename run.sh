#!/bin/bash

# CoreStack Run Script
# Starts all services required for development
# Usage: ./run.sh [--tmux|--no-tmux] [--docker|--no-docker]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
USE_TMUX=""
USE_DOCKER=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --tmux)
      USE_TMUX=true
      shift
      ;;
    --no-tmux)
      USE_TMUX=false
      shift
      ;;
    --docker)
      USE_DOCKER=true
      shift
      ;;
    --no-docker)
      USE_DOCKER=false
      shift
      ;;
    --help)
      echo "CoreStack Run Script"
      echo ""
      echo "Usage: ./run.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --tmux        Use tmux to manage services (recommended)"
      echo "  --no-tmux     Run services in foreground (Ctrl+C to stop)"
      echo "  --docker      Start Docker services first"
      echo "  --no-docker   Skip Docker services (assume already running)"
      echo "  --help        Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./run.sh                    # Auto-detect best options"
      echo "  ./run.sh --tmux --docker    # Full setup with tmux"
      echo "  ./run.sh --no-tmux          # Simple foreground mode"
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
echo -e "${BLUE}║   CoreStack Service Manager               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${RED}✗ .env file not found${NC}"
  echo -e "${YELLOW}  Run ./init.sh first to initialize the project${NC}"
  exit 1
fi

# Auto-detect Docker if not specified
if [ -z "$USE_DOCKER" ]; then
  if [ -f docker-compose.yml ] && command -v docker &> /dev/null && docker ps &> /dev/null; then
    USE_DOCKER=true
  else
    USE_DOCKER=false
  fi
fi

# Auto-detect tmux if not specified
if [ -z "$USE_TMUX" ]; then
  if command -v tmux &> /dev/null; then
    USE_TMUX=true
  else
    USE_TMUX=false
  fi
fi

# Start Docker services if needed
if [ "$USE_DOCKER" = true ]; then
  echo -e "${BLUE}[1/2] Starting Docker services...${NC}"

  # Check if services are already running
  if docker compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓ Docker services already running${NC}"
  else
    docker compose up -d
    echo -e "${GREEN}✓ Docker services started${NC}"
    echo -e "${YELLOW}  Waiting for services to be ready...${NC}"
    sleep 5
  fi
  echo ""
fi

# Start Node.js services
echo -e "${BLUE}[2/2] Starting Node.js services...${NC}"
echo ""

# Function to run services in foreground
run_foreground() {
  echo -e "${YELLOW}Starting services in foreground mode...${NC}"
  echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
  echo ""

  # Trap Ctrl+C to cleanup
  trap 'echo -e "\n${YELLOW}Stopping services...${NC}"; kill 0; exit 0' INT

  # Start services in background
  npm run ws:server &
  WS_PID=$!

  npm run queue:worker &
  QUEUE_PID=$!

  npm run temporal:worker &
  TEMPORAL_PID=$!

  # Wait a bit for services to start
  sleep 2
  echo -e "${GREEN}✓ WebSocket server started (PID: $WS_PID)${NC}"
  echo -e "${GREEN}✓ Queue worker started (PID: $QUEUE_PID)${NC}"
  echo -e "${GREEN}✓ Temporal worker started (PID: $TEMPORAL_PID)${NC}"
  echo ""

  # Start Next.js in foreground (this is the main process)
  echo -e "${GREEN}✓ Starting Next.js dev server...${NC}"
  echo ""
  npm run dev
}

# Function to run services in tmux
run_tmux() {
  SESSION_NAME="corestack"

  # Check if session already exists
  if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo -e "${YELLOW}⚠ Tmux session '$SESSION_NAME' already exists${NC}"
    read -p "  Kill existing session and restart? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      tmux kill-session -t $SESSION_NAME
    else
      echo -e "${BLUE}  Attaching to existing session...${NC}"
      echo -e "${YELLOW}  Use 'Ctrl+b d' to detach, 'Ctrl+b [0-3]' to switch windows${NC}"
      tmux attach-session -t $SESSION_NAME
      exit 0
    fi
  fi

  echo -e "${YELLOW}Creating tmux session: $SESSION_NAME${NC}"

  # Create new session with Next.js
  tmux new-session -d -s $SESSION_NAME -n "nextjs"
  tmux send-keys -t $SESSION_NAME:0 "npm run dev" C-m

  # Create window for WebSocket server
  tmux new-window -t $SESSION_NAME:1 -n "websocket"
  tmux send-keys -t $SESSION_NAME:1 "npm run ws:server" C-m

  # Create window for Queue worker
  tmux new-window -t $SESSION_NAME:2 -n "queue"
  tmux send-keys -t $SESSION_NAME:2 "npm run queue:worker" C-m

  # Create window for Temporal worker
  tmux new-window -t $SESSION_NAME:3 -n "temporal"
  tmux send-keys -t $SESSION_NAME:3 "npm run temporal:worker" C-m

  # Select first window
  tmux select-window -t $SESSION_NAME:0

  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   All services started in tmux!           ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BLUE}Tmux session: ${GREEN}$SESSION_NAME${NC}"
  echo ""
  echo -e "${BLUE}Windows:${NC}"
  echo -e "  ${GREEN}0: nextjs${NC}      - Next.js dev server (http://localhost:3000)"
  echo -e "  ${GREEN}1: websocket${NC}   - WebSocket server (ws://localhost:3001)"
  echo -e "  ${GREEN}2: queue${NC}       - BullMQ worker"
  echo -e "  ${GREEN}3: temporal${NC}    - Temporal workflow worker"
  echo ""
  echo -e "${BLUE}Tmux commands:${NC}"
  echo -e "  ${GREEN}Ctrl+b [0-3]${NC}   - Switch between windows"
  echo -e "  ${GREEN}Ctrl+b d${NC}       - Detach from session (services keep running)"
  echo -e "  ${GREEN}tmux attach -t $SESSION_NAME${NC}  - Reattach to session"
  echo -e "  ${GREEN}tmux kill-session -t $SESSION_NAME${NC}  - Stop all services"
  echo ""
  if [ "$USE_DOCKER" = true ]; then
    echo -e "${BLUE}Access points:${NC}"
    echo -e "  Next.js App:    ${GREEN}http://localhost:3000${NC}"
    echo -e "  WebSocket:      ${GREEN}ws://localhost:3001${NC}"
    echo -e "  Temporal UI:    ${GREEN}http://localhost:8080${NC}"
    echo ""
  fi
  echo -e "${YELLOW}Attaching to session...${NC}"
  echo ""

  # Attach to session
  tmux attach-session -t $SESSION_NAME
}

# Choose run mode
if [ "$USE_TMUX" = true ]; then
  run_tmux
else
  run_foreground
fi
