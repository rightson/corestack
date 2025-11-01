# Migration: Next.js 15 → React Router 7 + Vite + Fastify

**Status:** 🟡 In Progress
**Created:** 2025-11-01
**Target Completion:** TBD

## Executive Summary

Migrate CoreStack from Next.js 15 to a modern stack optimized for complex, data-heavy enterprise dashboards with deep nesting (4+ levels) and sophisticated filtering requirements.

### Why Migrate?

**Current Limitations:**
- Next.js App Router optimized for server-side rendering, not complex client-side routing
- URL state management for filters requires custom solutions
- Deep nested routes (4+ levels) become cumbersome with file-based routing
- React Server Components add complexity for interactive dashboards
- Overhead of Next.js features not needed for internal enterprise tools

**Target Use Case:**
- Complex enterprise dashboards with 4+ level nesting
- Heavy client-side interactivity and real-time data
- Sophisticated filtering with shareable URLs
- Type-safe APIs with rapid iteration
- Optimized for internal tools, not public-facing websites

## Current Stack Analysis

### Existing Architecture

**Frontend:**
- Next.js 15 with App Router
- React 19
- TanStack Query v5 (already integrated!)
- tRPC v11 (already integrated!)
- Tailwind CSS v4

**Backend:**
- Next.js API Routes (file: `app/api/trpc/[trpc]/route.ts`)
- tRPC with observability middleware
- PostgreSQL + Drizzle ORM
- Redis for caching and queues
- WebSocket server (standalone)
- BullMQ for job queues
- Temporal for workflows

**Key Observations:**
✅ **tRPC and TanStack Query already in place** - No need to introduce new data fetching patterns
✅ **Well-organized router structure** - Easy to migrate to Fastify
✅ **Comprehensive backend** - Just need to change the HTTP adapter
✅ **Standalone services** - WebSocket, queue workers, and Temporal workers already separate

### What's Changing

| Component | From | To | Reason |
|-----------|------|----|----|
| **Frontend Framework** | Next.js 15 | Vite + React 19 | Faster builds, simpler tooling |
| **Routing** | Next.js App Router | React Router 7 | Better URL state management, nested routes |
| **HTTP Server** | Next.js API Routes | Fastify | Dedicated API server, better performance |
| **tRPC Adapter** | `@trpc/next` | `@trpc/server` + Fastify plugin | Works with Fastify |
| **Dev Server** | Next.js Dev | Vite Dev | Instant HMR, faster development |
| **Build Tool** | Next.js + Turbopack | Vite | Proven performance, simpler config |

### What's Staying

✅ React 19
✅ TanStack Query (React Query)
✅ tRPC (just changing adapter)
✅ Drizzle ORM
✅ PostgreSQL, Redis, Temporal
✅ WebSocket server (unchanged)
✅ BullMQ workers (unchanged)
✅ Temporal workers (unchanged)
✅ Authentication logic
✅ All business logic in `lib/` and `server/routers/`

## Target Stack

### New Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Browser)                       │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Vite + React 19 + React Router 7                      │ │
│  │  - Complex nested routes (4+ levels)                   │ │
│  │  - URL state management for filters                    │ │
│  │  - TanStack Query for data fetching                    │ │
│  │  - tRPC client (type-safe API calls)                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                          ↕ HTTP                              │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                   Fastify API Server                         │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Fastify + tRPC Adapter                                │ │
│  │  - All tRPC routers (user, auth, project, ssh, etc.)  │ │
│  │  - Type-safe end-to-end                                │ │
│  │  - Observability middleware                            │ │
│  │  - Health checks, metrics                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Existing Business Logic                               │ │
│  │  - Auth service (JWT, LDAP)                            │ │
│  │  - Database (Drizzle ORM)                              │ │
│  │  - SSH operations                                       │ │
│  │  - Temporal client                                      │ │
│  │  - Queue client                                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Standalone Services                         │
│  (No changes required)                                       │
│                                                               │
│  • WebSocket Server (ws on port 3001)                       │
│  • BullMQ Workers (background jobs)                         │
│  • Temporal Workers (workflows)                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Dependencies

**New Packages:**
```json
{
  "vite": "^6.0.0",
  "react-router": "^7.0.0",
  "@react-router/node": "^7.0.0",
  "fastify": "^5.0.0",
  "@trpc/server": "^11.0.0",
  "@fastify/cors": "^10.0.0",
  "@vitejs/plugin-react": "^4.3.0"
}
```

**Removed Packages:**
```json
{
  "next": "15.5.6",  // Remove
  "@trpc/next": "^11.0.0"  // Remove (use @trpc/server with Fastify)
}
```

**Unchanged Packages:**
- `@tanstack/react-query`
- `@trpc/client`, `@trpc/react-query`, `@trpc/server`
- `drizzle-orm`, `postgres`
- `ioredis`, `bullmq`
- `@temporalio/*`
- `react`, `react-dom`

## Migration Strategy

### Phase 1: Setup New Infrastructure

#### 1.1 Install New Dependencies

```bash
# Add Vite and React Router
npm install vite @vitejs/plugin-react react-router@^7

# Add Fastify and adapters
npm install fastify @fastify/cors @fastify/static

# Remove Next.js
npm uninstall next @trpc/next eslint-config-next
```

#### 1.2 Create New Project Structure

```
corestack/
├── src/                        # NEW: Frontend source (Vite)
│   ├── main.tsx               # Entry point
│   ├── App.tsx                # Root component with router
│   ├── routes/                # React Router routes
│   │   ├── index.tsx          # Route definitions
│   │   ├── _layout.tsx        # Root layout
│   │   ├── login.tsx          # Login page
│   │   └── dashboard/         # Nested dashboard routes
│   │       ├── _layout.tsx    # Dashboard layout
│   │       ├── index.tsx      # Dashboard home
│   │       ├── projects/      # Level 1
│   │       │   ├── $projectId/  # Level 2
│   │       │   │   ├── envs/    # Level 3
│   │       │   │   │   └── $envId/  # Level 4
│   │       │   │   │       ├── index.tsx
│   │       │   │   │       └── metrics.tsx
│   ├── components/            # Moved from root
│   ├── lib/                   # Frontend utilities
│   │   ├── trpc.ts           # tRPC client setup
│   │   ├── query-client.ts   # TanStack Query setup
│   │   └── url-state.ts      # URL state management utilities
│   └── styles/
│       └── globals.css
├── server-fastify/            # NEW: Fastify API server
│   ├── index.ts              # Fastify server entry
│   ├── trpc.ts               # tRPC Fastify adapter
│   └── plugins/              # Fastify plugins
│       ├── cors.ts
│       └── health.ts
├── server/                    # EXISTING: Business logic (unchanged)
│   ├── routers/              # tRPC routers (reuse as-is!)
│   └── ...
├── lib/                       # EXISTING: Shared libraries (mostly unchanged)
│   ├── trpc/
│   │   ├── trpc.ts           # Core tRPC setup (unchanged)
│   │   └── context.ts        # Context (unchanged)
│   ├── db/                   # Database (unchanged)
│   ├── auth/                 # Auth logic (unchanged)
│   └── ...
├── vite.config.ts            # NEW: Vite configuration
├── index.html                # NEW: HTML entry point
└── package.json              # Updated scripts
```

#### 1.3 Create Vite Configuration

**File: `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/server': path.resolve(__dirname, './server'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api/trpc': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/api/health': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/api/metrics': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

### Phase 2: Migrate Backend to Fastify

#### 2.1 Create Fastify Server with tRPC

**File: `server-fastify/index.ts`**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/lib/trpc/context';
import { registerHealthRoutes } from './plugins/health';
import { registerMetricsRoute } from './plugins/metrics';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ service: 'fastify' });

async function main() {
  const server = Fastify({
    logger: false, // Use our pino logger instead
    maxParamLength: 5000,
  });

  // CORS
  await server.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL
      : 'http://localhost:3000',
    credentials: true,
  });

  // tRPC
  await server.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }) {
        logger.error({ path, error }, 'tRPC error');
      },
    },
  });

  // Health checks
  registerHealthRoutes(server);

  // Metrics
  registerMetricsRoute(server);

  const port = parseInt(process.env.API_PORT || '4000');
  await server.listen({ port, host: '0.0.0.0' });

  logger.info({ port }, 'Fastify server started');
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
```

**Key Points:**
- ✅ Reuses existing `appRouter` from `server/routers/_app.ts`
- ✅ Reuses existing `createContext` from `lib/trpc/context.ts`
- ✅ No changes needed to any tRPC router logic!
- ✅ Observability middleware already in tRPC setup

#### 2.2 Migrate Health Checks and Metrics

**File: `server-fastify/plugins/health.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { checkDatabaseHealth, checkRedisHealth } from '@/lib/observability/health';

export function registerHealthRoutes(server: FastifyInstance) {
  // Readiness check
  server.get('/api/health/ready', async (request, reply) => {
    const dbHealthy = await checkDatabaseHealth();
    const redisHealthy = await checkRedisHealth();

    if (dbHealthy && redisHealthy) {
      return reply.code(200).send({ status: 'ready' });
    } else {
      return reply.code(503).send({
        status: 'not ready',
        database: dbHealthy,
        redis: redisHealthy,
      });
    }
  });

  // Liveness check
  server.get('/api/health/live', async (request, reply) => {
    return reply.code(200).send({ status: 'alive' });
  });

  // Startup check
  server.get('/api/health/startup', async (request, reply) => {
    const dbHealthy = await checkDatabaseHealth();

    if (dbHealthy) {
      return reply.code(200).send({ status: 'started' });
    } else {
      return reply.code(503).send({ status: 'starting' });
    }
  });
}
```

**File: `server-fastify/plugins/metrics.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { register } from '@/lib/observability/metrics';

export function registerMetricsRoute(server: FastifyInstance) {
  server.get('/api/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}
```

### Phase 3: Migrate Frontend to React Router 7

#### 3.1 Create Entry Point and Root App

**File: `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CoreStack</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**File: `src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**File: `src/App.tsx`**

```typescript
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { TRPCProvider } from './lib/trpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <TRPCProvider queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </TRPCProvider>
  );
}
```

#### 3.2 Setup tRPC Client (Standalone)

**File: `src/lib/trpc.ts`**

```typescript
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>();

export function TRPCProvider({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: any;
}) {
  const [trpcClient] = React.useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          // Add credentials for cookies/JWT
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: 'include',
            });
          },
        }),
      ],
      transformer: superjson,
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}
```

#### 3.3 Define Routes with React Router 7

**File: `src/routes/index.tsx`**

```typescript
import { createBrowserRouter } from 'react-router';
import RootLayout from './layout';
import LoginPage from './login';
import DashboardLayout from './dashboard/layout';
import DashboardHome from './dashboard/index';
import ProjectsPage from './dashboard/projects';
import ProjectDetailLayout from './dashboard/projects/$projectId/layout';
import ProjectDetailPage from './dashboard/projects/$projectId/index';
import EnvDetailLayout from './dashboard/projects/$projectId/envs/$envId/layout';
import EnvDetailPage from './dashboard/projects/$projectId/envs/$envId/index';
import EnvMetricsPage from './dashboard/projects/$projectId/envs/$envId/metrics';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'dashboard',
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <DashboardHome />,
          },
          {
            path: 'projects',
            element: <ProjectsPage />,
          },
          {
            path: 'projects/:projectId',
            element: <ProjectDetailLayout />,
            children: [
              {
                index: true,
                element: <ProjectDetailPage />,
              },
              {
                path: 'envs/:envId',
                element: <EnvDetailLayout />,
                children: [
                  {
                    index: true,
                    element: <EnvDetailPage />,
                  },
                  {
                    path: 'metrics',
                    element: <EnvMetricsPage />,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
```

**This demonstrates 4-level nesting:**
1. `/dashboard` (Level 1)
2. `/dashboard/projects/:projectId` (Level 2)
3. `/dashboard/projects/:projectId/envs/:envId` (Level 3)
4. `/dashboard/projects/:projectId/envs/:envId/metrics` (Level 4)

#### 3.4 URL State Management for Filters

**File: `src/lib/url-state.ts`**

```typescript
import { useSearchParams } from 'react-router';
import { useMemo, useCallback } from 'react';
import { z } from 'zod';

/**
 * Hook for managing complex filter state in URL search params
 *
 * Example usage:
 * ```tsx
 * const filterSchema = z.object({
 *   status: z.enum(['active', 'inactive', 'all']).default('all'),
 *   search: z.string().default(''),
 *   tags: z.array(z.string()).default([]),
 *   dateRange: z.object({
 *     from: z.string().optional(),
 *     to: z.string().optional(),
 *   }).default({}),
 * });
 *
 * function ProjectsPage() {
 *   const [filters, setFilters] = useUrlState(filterSchema);
 *
 *   return (
 *     <div>
 *       <input
 *         value={filters.search}
 *         onChange={e => setFilters({ search: e.target.value })}
 *       />
 *       <select
 *         value={filters.status}
 *         onChange={e => setFilters({ status: e.target.value })}
 *       >
 *         <option value="all">All</option>
 *         <option value="active">Active</option>
 *         <option value="inactive">Inactive</option>
 *       </select>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUrlState<T extends z.ZodObject<any>>(
  schema: T
): [z.infer<T>, (updates: Partial<z.infer<T>>) => void, () => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse current URL params into typed object
  const state = useMemo(() => {
    const raw: Record<string, any> = {};

    for (const [key, value] of searchParams.entries()) {
      // Handle arrays (e.g., ?tags=foo&tags=bar)
      if (raw[key]) {
        raw[key] = Array.isArray(raw[key]) ? [...raw[key], value] : [raw[key], value];
      } else {
        raw[key] = value;
      }
    }

    // Parse JSON values (for complex objects)
    Object.keys(raw).forEach(key => {
      if (typeof raw[key] === 'string' && raw[key].startsWith('{')) {
        try {
          raw[key] = JSON.parse(raw[key]);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
    });

    // Validate and apply defaults
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : schema.parse({});
  }, [searchParams, schema]);

  // Update URL params (merge with existing)
  const setState = useCallback(
    (updates: Partial<z.infer<T>>) => {
      const newState = { ...state, ...updates };
      const newParams = new URLSearchParams();

      Object.entries(newState).forEach(([key, value]) => {
        if (value === undefined || value === null) return;

        if (Array.isArray(value)) {
          value.forEach(v => newParams.append(key, String(v)));
        } else if (typeof value === 'object') {
          newParams.set(key, JSON.stringify(value));
        } else {
          newParams.set(key, String(value));
        }
      });

      setSearchParams(newParams, { replace: true });
    },
    [state, setSearchParams]
  );

  // Clear all filters
  const clearState = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return [state, setState, clearState];
}

/**
 * Generate shareable URL with current filters
 */
export function useShareableUrl(): string {
  const [searchParams] = useSearchParams();
  return `${window.location.origin}${window.location.pathname}?${searchParams.toString()}`;
}
```

### Phase 4: Update Scripts and Configuration

#### 4.1 Update package.json Scripts

```json
{
  "scripts": {
    "dev": "npm run dev:api & npm run dev:vite",
    "dev:vite": "vite",
    "dev:api": "tsx watch server-fastify/index.ts",
    "build": "vite build && tsc -p tsconfig.server.json",
    "build:client": "vite build",
    "build:server": "tsc -p tsconfig.server.json",
    "start": "node dist/server-fastify/index.js",
    "preview": "vite preview",
    "ws:server": "tsx server/websocket.ts",
    "queue:worker": "tsx server/queue/worker.ts",
    "temporal:worker": "tsx server/temporal/workers/main.worker.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "cli": "tsx cli/index.ts",
    "lint": "eslint src server server-fastify",
    "type-check": "tsc --noEmit"
  }
}
```

#### 4.2 Update TypeScript Configuration

**File: `tsconfig.json`** (for Vite/frontend)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/lib/*": ["./lib/*"],
      "@/server/*": ["./server/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "server", "server-fastify"]
}
```

**File: `tsconfig.server.json`** (for Fastify/backend)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "./dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["server-fastify", "server", "lib"],
  "exclude": ["node_modules", "src"]
}
```

### Phase 5: Create Example Application

#### 5.1 Four-Level Nested Dashboard Example

Create a complete example demonstrating:
- 4 levels of nested routes
- Complex filters with URL state
- Type-safe data fetching with tRPC
- Shareable URLs

**Directory Structure:**
```
src/routes/dashboard/
├── layout.tsx                    # Level 0: Dashboard shell
├── index.tsx                     # Dashboard home
├── projects/                     # Level 1: Projects list
│   ├── index.tsx                # Projects page with filters
│   └── $projectId/              # Level 2: Project detail
│       ├── layout.tsx           # Project shell with tabs
│       ├── index.tsx            # Project overview
│       └── envs/                # Level 3: Environment list
│           └── $envId/          # Level 4: Environment detail
│               ├── layout.tsx   # Environment shell
│               ├── index.tsx    # Environment overview
│               └── metrics.tsx  # Environment metrics
```

**Example: Projects Page with Complex Filters**

**File: `src/routes/dashboard/projects/index.tsx`**

```typescript
import { z } from 'zod';
import { useUrlState, useShareableUrl } from '@/lib/url-state';
import { trpc } from '@/lib/trpc';

const filterSchema = z.object({
  search: z.string().default(''),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  tags: z.array(z.string()).default([]),
  owner: z.string().optional(),
  sortBy: z.enum(['name', 'created', 'updated']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export default function ProjectsPage() {
  const [filters, setFilters] = useUrlState(filterSchema);
  const shareableUrl = useShareableUrl();

  // Type-safe tRPC query with filters
  const { data: projects, isLoading } = trpc.project.list.useQuery({
    search: filters.search,
    status: filters.status === 'all' ? undefined : filters.status,
    tags: filters.tags,
    owner: filters.owner,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => navigator.clipboard.writeText(shareableUrl)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Share Filters
        </button>
      </div>

      {/* Complex Filter UI */}
      <div className="bg-white p-4 rounded shadow mb-6 space-y-4">
        <input
          type="text"
          placeholder="Search projects..."
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          className="w-full px-4 py-2 border rounded"
        />

        <div className="grid grid-cols-3 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value as any })}
            className="px-4 py-2 border rounded"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({ sortBy: e.target.value as any })}
            className="px-4 py-2 border rounded"
          >
            <option value="name">Sort by Name</option>
            <option value="created">Sort by Created</option>
            <option value="updated">Sort by Updated</option>
          </select>

          <select
            value={filters.sortOrder}
            onChange={(e) => setFilters({ sortOrder: e.target.value as any })}
            className="px-4 py-2 border rounded"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        {/* Tag filter (multi-select) */}
        <TagMultiSelect
          value={filters.tags}
          onChange={(tags) => setFilters({ tags })}
        />
      </div>

      {/* Projects List */}
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects?.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**URL Examples:**
```
/dashboard/projects
/dashboard/projects?search=api&status=active
/dashboard/projects?status=active&tags=backend&tags=critical&sortBy=updated&sortOrder=desc
/dashboard/projects/proj_123
/dashboard/projects/proj_123/envs/prod
/dashboard/projects/proj_123/envs/prod?tab=metrics&timeRange=7d
```

## Migration Checklist

### Infrastructure

- [ ] Install Vite, React Router 7, and Fastify
- [ ] Remove Next.js dependencies
- [ ] Create Vite configuration
- [ ] Create new directory structure (`src/`, `server-fastify/`)
- [ ] Update `package.json` scripts
- [ ] Update TypeScript configurations

### Backend Migration

- [ ] Create Fastify server with tRPC adapter
- [ ] Migrate health check routes
- [ ] Migrate metrics route
- [ ] Verify all tRPC routers work unchanged
- [ ] Test API with existing CLI client

### Frontend Migration

- [ ] Create entry point (`index.html`, `src/main.tsx`)
- [ ] Setup tRPC client for standalone usage
- [ ] Setup TanStack Query provider
- [ ] Create React Router configuration
- [ ] Migrate pages:
  - [ ] Login page
  - [ ] Dashboard layout
  - [ ] Projects page
  - [ ] Project detail page
  - [ ] Environment pages (4-level nesting)
- [ ] Migrate shared components
- [ ] Implement URL state management utilities
- [ ] Test complex filtering and URL sharing

### Documentation Updates

- [ ] Update README.md (stack overview, quick start)
- [ ] Update `docs/architecture/architecture.md` (new stack)
- [ ] Update `docs/architecture/api.md` (Fastify endpoints)
- [ ] Update `docs/architecture/request-flow.md` (new flow)
- [ ] Update `docs/development/local_development_guide.md` (new setup)
- [ ] Create `docs/features/routing-patterns.md` (React Router patterns)
- [ ] Create `docs/features/url-state-management.md` (filter patterns)
- [ ] Move this doc to `docs/features/` when complete

### Testing and Validation

- [ ] Test 4-level nested routing
- [ ] Test complex filter state in URLs
- [ ] Test URL sharing functionality
- [ ] Verify type safety end-to-end
- [ ] Test all existing tRPC endpoints
- [ ] Test authentication flow
- [ ] Test WebSocket integration
- [ ] Verify observability (metrics, logs, health)
- [ ] Performance testing (compare to Next.js)

## Rollout Plan

### Development Environment

1. Create feature branch `feature/react-router-migration`
2. Implement changes in parallel structure (keep Next.js working)
3. Test thoroughly in development
4. Update documentation
5. Create PR for review

### Staging Environment

1. Deploy to staging
2. Run integration tests
3. Performance benchmarks
4. User acceptance testing
5. Document any issues

### Production Rollout

1. Schedule maintenance window (if needed)
2. Deploy backend (Fastify) first
3. Deploy frontend (Vite build)
4. Monitor metrics and logs
5. Rollback plan: Keep Next.js build available

## Performance Expectations

### Development Experience

- **Vite Dev Server:** < 500ms cold start (vs ~3s for Next.js)
- **HMR:** < 50ms (vs ~200ms for Next.js)
- **Type Checking:** Instant (with `vite-plugin-checker`)

### Production Performance

- **Build Time:** Expected ~40% faster than Next.js
- **Bundle Size:** Similar or smaller (no Next.js runtime overhead)
- **API Response Time:** Expected ~10-20% faster (Fastify vs Next.js API routes)
- **Initial Load:** Similar (both serve optimized React bundles)

### Metrics to Track

- Time to Interactive (TTI)
- API latency (p50, p95, p99)
- Bundle size
- Build time
- Dev server startup time
- HMR time

## Risks and Mitigations

### Risk 1: Breaking Changes in tRPC Setup

**Probability:** Low
**Impact:** Medium
**Mitigation:**
- Keep core tRPC routers unchanged
- Only change the adapter layer
- Thorough testing with existing CLI client (uses tRPC directly)

### Risk 2: Complex URL State Bugs

**Probability:** Medium
**Impact:** Low
**Mitigation:**
- Build robust `useUrlState` hook with Zod validation
- Comprehensive unit tests for URL parsing
- Examples and documentation

### Risk 3: Developer Familiarity

**Probability:** Medium
**Impact:** Low
**Mitigation:**
- Comprehensive migration guide
- Example patterns for common scenarios
- Team training sessions

### Risk 4: Authentication Integration

**Probability:** Low
**Impact:** Medium
**Mitigation:**
- Keep auth logic in `lib/auth/` unchanged
- Test JWT flow thoroughly
- Verify cookie handling in Fastify

## Success Criteria

### Must Have

✅ All existing functionality works
✅ 4-level nested routing implemented
✅ Complex URL filter state management working
✅ Type safety maintained end-to-end
✅ All tests passing
✅ Documentation updated
✅ Dev experience improved (faster HMR, faster builds)

### Nice to Have

🎯 Performance improvements documented
🎯 Example dashboard with all patterns
🎯 Migration script for teams using CoreStack
🎯 Video walkthrough of new architecture

## Timeline

**Estimated Duration:** 2-3 weeks

- **Week 1:** Infrastructure setup, backend migration, basic frontend
- **Week 2:** Complete frontend migration, URL state management, examples
- **Week 3:** Documentation, testing, refinement

## Questions and Open Items

1. **Backwards Compatibility:** Should we maintain Next.js alongside for a deprecation period?
   - **Recommendation:** No, clean break. CoreStack is a seed project, users can fork old version if needed.

2. **Manage Utility Integration:** How should `manage.ts` be updated?
   - **Recommendation:** Add separate `api:dev` pane for Fastify server alongside existing services.

3. **CLI Client:** Any changes needed?
   - **Recommendation:** No changes. CLI uses tRPC directly, not affected by frontend framework.

4. **Docker Compose:** Changes needed for production deployment?
   - **Recommendation:** Yes, add Fastify service container, remove Next.js build.

## References

- [React Router 7 Documentation](https://reactrouter.com/en/main)
- [Vite Documentation](https://vitejs.dev/)
- [Fastify Documentation](https://fastify.dev/)
- [tRPC with Fastify](https://trpc.io/docs/server/adapters/fastify)
- [TanStack Query](https://tanstack.com/query)

## Appendix A: File-by-File Migration Map

| Old File (Next.js) | New File (React Router) | Changes |
|-------------------|------------------------|---------|
| `app/layout.tsx` | `src/routes/_layout.tsx` | Remove Next.js Metadata, keep providers |
| `app/page.tsx` | `src/routes/index.tsx` | Remove Next.js specifics |
| `app/login/page.tsx` | `src/routes/login.tsx` | Standard React component |
| `app/projects/page.tsx` | `src/routes/dashboard/projects/index.tsx` | Add URL state management |
| `app/api/trpc/[trpc]/route.ts` | `server-fastify/trpc.ts` | Use Fastify adapter |
| `app/api/health/*/route.ts` | `server-fastify/plugins/health.ts` | Fastify routes |
| `app/api/metrics/route.ts` | `server-fastify/plugins/metrics.ts` | Fastify route |
| `lib/trpc/Provider.tsx` | `src/lib/trpc.tsx` | Update for standalone usage |
| `lib/trpc/client.ts` | `src/lib/trpc.tsx` | Merge into single file |
| `server/routers/*` | `server/routers/*` | **No changes!** |
| `lib/db/*` | `lib/db/*` | **No changes!** |
| `lib/auth/*` | `lib/auth/*` | **No changes!** |
| `server/websocket.ts` | `server/websocket.ts` | **No changes!** |
| `server/queue/*` | `server/queue/*` | **No changes!** |
| `server/temporal/*` | `server/temporal/*` | **No changes!** |

## Appendix B: Diff of tRPC Setup

### Before (Next.js)

```typescript
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

### After (Fastify)

```typescript
// server-fastify/index.ts
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';

await server.register(fastifyTRPCPlugin, {
  prefix: '/api/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
  },
});
```

**Changes:** Only the adapter! Everything else (routers, context, types) stays the same.

---

**Status Updates:**
- 2025-11-01: Initial proposal created
