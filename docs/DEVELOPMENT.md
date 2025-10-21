# Development Guide

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
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

8. Open [http://localhost:3000](http://localhost:3000)

## Development Scripts

### Application
- `npm run dev` - Start Next.js development server with Turbopack
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Database
- `npm run db:generate` - Generate migration files
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema directly to database (development only)
- `npm run db:studio` - Open Drizzle Studio

### Services
- `npm run ws:server` - Start WebSocket server
- `npm run queue:worker` - Start queue worker

### CLI
- `npm run cli -- <command>` - Run CLI commands

## Adding Features

### Adding a New tRPC Route

1. Create a new router in `server/routers/`:

```typescript
// server/routers/myRouter.ts
import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/trpc';

export const myRouter = router({
  myProcedure: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      // Your logic here
      return { message: `Hello ${input.name}` };
    }),
});
```

2. Add it to `server/routers/_app.ts`:

```typescript
import { myRouter } from './myRouter';

export const appRouter = router({
  user: userRouter,
  post: postRouter,
  my: myRouter, // Add your router
});
```

3. Use it in your components:

```typescript
const { data } = trpc.my.myProcedure.useQuery({ name: 'World' });
```

### Adding a Database Table

1. Add the table to `lib/db/schema.ts`:

```typescript
export const myTable = pgTable('my_table', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

2. Push the schema:

```bash
npm run db:push
```

### Adding a React Component

Create components in the `components/` directory:

```typescript
// components/MyComponent.tsx
'use client';

export function MyComponent() {
  return <div>My Component</div>;
}
```

Use in pages:

```typescript
// app/page.tsx
import { MyComponent } from '@/components/MyComponent';

export default function Home() {
  return <MyComponent />;
}
```

### Adding a Queue Worker

1. Add worker logic in `server/queue/workers.ts`:

```typescript
export async function processMyJob(job: Job) {
  console.log('Processing:', job.data);
  // Your processing logic
  return { success: true };
}
```

2. Register the worker in queue configuration:

```typescript
worker.on('my-job', processMyJob);
```

3. Add jobs to the queue:

```typescript
await QueueManager.addJob('default', 'my-job', { data: 'example' });
```

## Code Style

### TypeScript

- Use strict type checking
- Prefer interfaces over types for object shapes
- Use enums for fixed sets of values

### React

- Use functional components
- Use hooks for state management
- Prefer server components when possible
- Mark client components with `'use client'`

### Naming Conventions

- Components: PascalCase (`UserList.tsx`)
- Functions: camelCase (`getUserById`)
- Constants: UPPER_SNAKE_CASE (`DATABASE_URL`)
- Files: kebab-case or PascalCase

## Testing

### Running Tests

```bash
npm test
```

### Writing Tests

Create test files with `.test.ts` or `.test.tsx` extension:

```typescript
// components/MyComponent.test.tsx
import { render } from '@testing-library/react';
import { MyComponent } from './MyComponent';

test('renders component', () => {
  const { getByText } = render(<MyComponent />);
  expect(getByText('My Component')).toBeInTheDocument();
});
```

## Debugging

### Next.js Debugging

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Next.js: debug server-side",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev"],
  "port": 9229
}
```

### Database Debugging

Use Drizzle Studio:
```bash
npm run db:studio
```

### WebSocket Debugging

Use wscat to test WebSocket connections:
```bash
npm install -g wscat
wscat -c ws://localhost:3001
```

## Common Issues

### Port Already in Use

```bash
lsof -i :3000
kill -9 <PID>
```

### Database Connection Failed

Check Docker containers:
```bash
docker-compose ps
docker-compose logs postgres
```

### Type Errors

Regenerate types:
```bash
npm run db:push
```

## Hot Reload

Turbopack provides fast hot reload for:
- React components
- Server components
- API routes
- CSS modules

Changes to tRPC routers require server restart.

## Environment Variables

Development environment variables in `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb
REDIS_URL=redis://localhost:6379
PORT=3000
WS_PORT=3001
NODE_ENV=development
JWT_SECRET=dev-secret-key
```

Never commit `.env` to version control.
