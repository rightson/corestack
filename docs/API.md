# API Reference

## Overview

All APIs are type-safe using tRPC. Endpoints are available at `/api/trpc/*`.

## tRPC Routers

### Authentication (`auth.*`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `auth.login` | mutation | Authenticate user (email/LDAP) |
| `auth.changePassword` | mutation | Change user password |
| `auth.verifyToken` | query | Verify JWT token validity |

### Users (`user.*`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `user.list` | query | Get all users |
| `user.getById` | query | Get user by ID |
| `user.create` | mutation | Create new user |
| `user.update` | mutation | Update user |
| `user.delete` | mutation | Delete user |

### Posts (`post.*`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `post.list` | query | Get all posts |
| `post.getById` | query | Get post by ID |
| `post.create` | mutation | Create new post |
| `post.update` | mutation | Update post |
| `post.delete` | mutation | Delete post |

### Projects (`project.*`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `project.getMyProjects` | query | Get user's projects |
| `project.getAllProjects` | query | Get all visible projects |
| `project.searchProjects` | query | Search projects |
| `project.create` | mutation | Create project |
| `project.delete` | mutation | Delete project |
| `project.requestPermission` | mutation | Request project access |

## Usage Examples

### Client-Side (React)

```typescript
'use client';
import { trpc } from '@/lib/trpc/Provider';

function MyComponent() {
  // Query
  const { data, isLoading } = trpc.user.list.useQuery();

  // Mutation
  const createUser = trpc.user.create.useMutation();

  const handleCreate = async () => {
    await createUser.mutateAsync({
      name: 'John Doe',
      email: 'john@example.com',
    });
  };

  return <div>...</div>;
}
```

### Server-Side

```typescript
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export const userRouter = router({
  list: publicProcedure.query(async () => {
    return await db.select().from(users);
  }),

  create: publicProcedure
    .input(z.object({
      name: z.string(),
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      return await db.insert(users).values(input).returning();
    }),
});
```

## REST Endpoints

### Queue Management

**POST** `/api/queue/add`

Add a job to the queue:

```bash
curl -X POST http://localhost:3000/api/queue/add \
  -H "Content-Type: application/json" \
  -d '{
    "queueName": "default",
    "jobName": "my-job",
    "data": { "key": "value" }
  }'
```

## WebSocket Protocol

See [WebSocket Flow](./architecture/websocket-flow.md) for complete documentation.

**Connect:** `ws://localhost:3001`

**Message Types:**
- `subscribe` - Subscribe to channel
- `unsubscribe` - Unsubscribe from channel
- `broadcast` - Send message to channel
- `ping/pong` - Keep-alive

## Detailed Documentation

For complete API details, see:
- [tRPC Endpoints](./api/trpc-endpoints.md) - All tRPC procedures
- [WebSocket Protocol](./architecture/websocket-flow.md) - Real-time messaging
- [Queue API](./task-queue/api.md) - Background job management

## Type Safety

tRPC provides end-to-end type safety:

```typescript
// Server defines types
const createUser = publicProcedure
  .input(z.object({
    name: z.string(),
    email: z.string().email(),
  }))
  .mutation(async ({ input }) => {
    // input is typed: { name: string; email: string }
    return await db.insert(users).values(input).returning();
  });

// Client gets full type inference
const user = await trpc.user.create.mutate({
  name: 'John',
  email: 'john@example.com',
  // TypeScript error if wrong fields or types!
});
// user is typed as User
```

## Authentication

Protected procedures require authentication token:

```typescript
// Protected procedure
const getProfile = protectedProcedure.query(async ({ ctx }) => {
  // ctx.user is guaranteed to exist
  return await db.select()
    .from(users)
    .where(eq(users.id, ctx.user.userId));
});
```

Tokens are automatically included from localStorage.
