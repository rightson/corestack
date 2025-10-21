# Lightweight Web Seed Stack

A modern, full-stack web application seed with Next.js, tRPC, Drizzle ORM, WebSocket support, and task queue functionality. Built with TypeScript and designed for both browser and CLI clients.

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

## Features

- ✅ Type-safe API with tRPC
- ✅ Database ORM with Drizzle (PostgreSQL)
- ✅ Real-time WebSocket communication
- ✅ Background task queue (BullMQ + Redis)
- ✅ CLI client for API and WebSocket
- ✅ Browser client with React components
- ✅ Authentication with email and LDAP
- ✅ Project management interface

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for PostgreSQL and Redis)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd lightweight-web-seed
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Start PostgreSQL and Redis:
```bash
docker-compose up -d
```

5. Run database migrations:
```bash
npm run db:push
```

6. Start the development server:
```bash
npm run dev
```

7. In separate terminals, start the WebSocket server and queue worker:
```bash
# Terminal 2 - WebSocket server
npm run ws:server

# Terminal 3 - Queue worker
npm run queue:worker
```

8. Open [http://localhost:3000](http://localhost:3000) in your browser

## Scripts

### Development
- `npm run dev` - Start Next.js development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Database
- `npm run db:generate` - Generate migrations
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Drizzle Studio

### Services
- `npm run ws:server` - Start WebSocket server
- `npm run queue:worker` - Start queue worker

### CLI
- `npm run cli -- <command>` - Run CLI commands

## CLI Usage

The CLI client allows you to interact with the API and WebSocket server from the command line.

### User Management

```bash
# List all users
npm run cli user list

# Get user by ID
npm run cli user get <id>

# Create a new user
npm run cli user create "John Doe" "john@example.com"

# Delete a user
npm run cli user delete <id>
```

### Post Management

```bash
# List all posts
npm run cli post list

# Create a post
npm run cli post create "My Title" "Post content" --author <user-id>
```

### WebSocket

```bash
# Listen to a channel
npm run cli ws listen demo

# Send a message to a channel
npm run cli ws send demo "Hello, World!"
```

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
├── drizzle.config.ts     # Drizzle configuration
├── docker-compose.yml    # Docker services
└── .env                  # Environment variables
```

## API Routes

### tRPC Endpoints

All tRPC endpoints are available at `/api/trpc/[procedure]`:

#### Users
- `user.list` - Get all users
- `user.getById` - Get user by ID
- `user.create` - Create a new user
- `user.update` - Update a user
- `user.delete` - Delete a user

#### Posts
- `post.list` - Get all posts
- `post.getById` - Get post by ID
- `post.create` - Create a new post
- `post.update` - Update a post
- `post.delete` - Delete a post

### REST Endpoints

- `POST /api/queue/add` - Add a job to the queue

## WebSocket Protocol

The WebSocket server runs on port 3001 (configurable via `WS_PORT`).

### Message Types

#### Subscribe to a channel
```json
{
  "type": "subscribe",
  "channel": "channel-name"
}
```

#### Unsubscribe from a channel
```json
{
  "type": "unsubscribe",
  "channel": "channel-name"
}
```

#### Broadcast a message
```json
{
  "type": "broadcast",
  "channel": "channel-name",
  "data": { "any": "data" }
}
```

#### Ping/Pong
```json
{
  "type": "ping"
}
```

## Task Queue

The task queue uses BullMQ with Redis. Three queues are available:

1. **default** - General purpose queue
2. **email** - Email sending queue
3. **processing** - Data processing queue

### Adding Jobs

Via API:
```javascript
fetch('/api/queue/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    queueName: 'default',
    jobName: 'my-job',
    data: { key: 'value' }
  })
});
```

Via code:
```typescript
import { QueueManager } from '@/lib/queue';

await QueueManager.addJob('default', 'process-data', {
  data: 'example'
});
```

## Authentication

The application supports two authentication methods:

1. **Email/Password** - Traditional email-based authentication
2. **LDAP** - Enterprise LDAP authentication

Default credentials:
- Username: `root`
- Password: `Must-Changed` (must be changed on first login)

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=3000
WS_PORT=3001

# App
NODE_ENV=development

# LDAP (optional)
LDAP_URL=ldap://your-ldap-server
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
```

## Development

### Adding a new tRPC route

1. Create a new router in `server/routers/`:
```typescript
import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/trpc';

export const myRouter = router({
  myProcedure: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      // Your logic here
    }),
});
```

2. Add it to `server/routers/_app.ts`:
```typescript
export const appRouter = router({
  // ...
  my: myRouter,
});
```

### Adding a database table

1. Add the table to `lib/db/schema.ts`:
```typescript
export const myTable = pgTable('my_table', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});
```

2. Push the schema:
```bash
npm run db:push
```

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker Deployment

```bash
docker-compose up -d
```

### Environment Setup

Make sure to set all environment variables for production:
- Update `DATABASE_URL` with production database
- Update `REDIS_URL` with production Redis
- Set `NODE_ENV=production`

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
