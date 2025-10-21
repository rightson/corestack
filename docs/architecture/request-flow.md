# Request Flow

## tRPC API Call Flow

This document details how API calls flow through the application using tRPC.

### Flow Diagram

```
Browser Component (components/UserList.tsx)
    │
    │ trpc.user.list.useQuery()
    ▼
tRPC Client (lib/trpc/client.ts)
    │
    │ HTTP POST /api/trpc/user.list
    ▼
Next.js API Route (app/api/trpc/[trpc]/route.ts)
    │
    │ Routes to tRPC handler
    ▼
tRPC App Router (server/routers/_app.ts)
    │
    │ Delegates to userRouter
    ▼
User Router (server/routers/userRouter.ts)
    │
    │ publicProcedure or protectedProcedure
    │ user.list procedure
    ▼
Drizzle ORM (lib/db/index.ts)
    │
    │ db.select().from(users)
    │ Uses schema from lib/db/schema.ts
    ▼
PostgreSQL Database (port 5432)
    │
    │ Executes SQL query
    │ Returns rows
    ▼
Response flows back up the chain
    │
    ▼
Browser Component receives typed data
```

## Step-by-Step Breakdown

### 1. Client Initiates Request

```typescript
// In a React component
const { data, isLoading } = trpc.user.list.useQuery();
```

The tRPC React Query hook sends a type-safe request to the server.

### 2. tRPC Client Processes Request

The client at `lib/trpc/client.ts` serializes the request and sends it via HTTP POST to the appropriate endpoint.

### 3. Next.js Routes to tRPC Handler

The catch-all route at `app/api/trpc/[trpc]/route.ts` receives the request and forwards it to the tRPC request handler.

### 4. tRPC App Router Delegates

The main router at `server/routers/_app.ts` identifies which sub-router should handle the request:

```typescript
export const appRouter = router({
  user: userRouter,
  post: postRouter,
  auth: authRouter,
  project: projectRouter,
});
```

### 5. Procedure Handler Executes

The specific procedure in `server/routers/userRouter.ts` executes:

```typescript
export const userRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return await db.select().from(users);
  }),
});
```

### 6. Database Query

Drizzle ORM generates and executes the SQL query against PostgreSQL.

### 7. Response Returns

The data flows back through the same chain, maintaining type safety at every step.

## Protected Routes

Protected routes include authentication checks:

```typescript
const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { user: ctx.user } });
});
```

## Context

The `ctx` object is available in all procedures and contains:
- `user` - Current authenticated user (if any)
- `req` - HTTP request object
- `res` - HTTP response object

## Type Safety

tRPC ensures end-to-end type safety:
- Input validation with Zod schemas
- Return type inference
- Compile-time type checking
- Runtime validation

## Example: Full Request Lifecycle

```typescript
// 1. Client code (components/UserList.tsx)
const { data: users } = trpc.user.list.useQuery();

// 2. tRPC client sends POST request
// POST /api/trpc/user.list

// 3. Server router (server/routers/userRouter.ts)
list: publicProcedure.query(async ({ ctx }) => {
  // 4. Database query
  const users = await db.select().from(users);

  // 5. Response (TypeScript ensures correct type)
  return users; // Type: User[]
});

// 6. Client receives typed data
// users is of type User[] - compile-time checked!
```
