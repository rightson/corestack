# Development Guide

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

### Setup

```bash
# 1. Clone and install
git clone <repository-url>
cd lightweight-web-seed
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start services
docker compose up -d

# 4. Setup database
npm run db:push

# 5. Start development servers
npm run dev          # Terminal 1 - Next.js
npm run ws:server    # Terminal 2 - WebSocket
npm run queue:worker # Terminal 3 - Queue worker

# 6. Open http://localhost:3000
```

## Development Commands

### Application

```bash
npm run dev      # Start dev server with Turbopack
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

### Database

```bash
npm run db:push      # Push schema (development)
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:studio    # Open Drizzle Studio
npm run db:seed      # Seed default data
```

### Services

```bash
npm run ws:server     # WebSocket server
npm run queue:worker  # Queue worker
```

### CLI

```bash
npm run cli -- <command>  # Run CLI commands
```

## Adding Features

### New tRPC Route

1. Create router in `server/routers/myRouter.ts`
2. Add to `server/routers/_app.ts`
3. Use in components: `trpc.my.procedure.useQuery()`

See: [Adding tRPC Routes](./development/adding-trpc-routes.md)

### New Database Table

1. Add to `lib/db/schema.ts`
2. Run `npm run db:push`

See: [Database Schema](./database/schema.md)

### New React Component

1. Create in `components/MyComponent.tsx`
2. Mark client components with `'use client'`
3. Use in pages

See: [Component Guide](./development/components.md)

### New Queue Worker

1. Add worker in `server/queue/workers.ts`
2. Add job: `QueueManager.addJob('queue', 'job-name', data)`

See: [Task Queue](./TASK_QUEUE.md)

## Code Style

### TypeScript

- Use strict type checking
- Prefer interfaces for object shapes
- Use enums for fixed values

### React

- Use functional components
- Use hooks for state
- Prefer server components
- Mark client components with `'use client'`

### Naming

- Components: `PascalCase` (`UserList.tsx`)
- Functions: `camelCase` (`getUserById`)
- Constants: `UPPER_SNAKE_CASE` (`DATABASE_URL`)

## Debugging

### Next.js

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Next.js: debug",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev"],
  "port": 9229
}
```

### Database

```bash
npm run db:studio
```

### WebSocket

```bash
npm install -g wscat
wscat -c ws://localhost:3001
```

## Common Issues

### Port in Use

```bash
lsof -i :3000
kill -9 <PID>
```

### Database Connection Failed

```bash
docker compose ps
docker compose logs postgres
```

### Type Errors

```bash
npm run db:push  # Regenerate types
```

## Environment Variables

Development `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb
REDIS_URL=redis://localhost:6379
PORT=3000
WS_PORT=3001
NODE_ENV=development
JWT_SECRET=dev-secret-key
```

**Note:** Never commit `.env` to version control.

## Detailed Documentation

For more details, see:
- [Adding tRPC Routes](./development/adding-trpc-routes.md)
- [Component Development](./development/components.md)
- [Testing Guide](./development/testing.md)
- [Hot Reload](./development/hot-reload.md)
- [Troubleshooting](./development/troubleshooting.md)

## Hot Reload

Turbopack provides fast hot reload for:
- React components
- Server components
- API routes
- CSS modules

**Note:** Changes to tRPC routers require server restart.
