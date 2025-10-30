# Database

## Overview

This project uses [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations with PostgreSQL.

## Quick Start

```bash
# Start PostgreSQL
docker compose up -d

# Push schema to database
npm run db:push

# Open Drizzle Studio
npm run db:studio
```

## Schema Overview

### Core Tables

- **users** - User accounts (email/LDAP)
- **posts** - User-generated content
- **projects** - Project management
- **project_members** - Project access control
- **permission_requests** - Access request workflow
- **tasks** - Background job tracking

## Common Operations

### Development Workflow

```bash
# Push schema changes (development)
npm run db:push

# Generate migrations (production)
npm run db:generate

# Apply migrations
npm run db:migrate

# Visual database browser
npm run db:studio
```

### Basic Queries

```typescript
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Select all
const allUsers = await db.select().from(users);

// Find by ID
const user = await db
  .select()
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);

// Insert
const newUser = await db
  .insert(users)
  .values({ name: 'John', email: 'john@example.com' })
  .returning();

// Update
await db
  .update(users)
  .set({ name: 'Jane' })
  .where(eq(users.id, userId));

// Delete
await db.delete(users).where(eq(users.id, userId));
```

## Configuration

Set in `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb
```

## Detailed Documentation

For more details, see:
- [Schema Reference](./database/schema.md) - Complete schema documentation
- [Migrations Guide](./database/migrations.md) - Managing schema changes
- [Queries Guide](./database/queries.md) - Query examples and patterns
- [Drizzle Studio](./database/drizzle-studio.md) - Visual database management

## Development vs Production

### Development

Use `db:push` for rapid iteration:

```bash
npm run db:push
```

Directly syncs schema to database without migration files.

### Production

Use migrations for controlled deployments:

```bash
# 1. Generate migration
npm run db:generate

# 2. Review migration file

# 3. Apply migration
npm run db:migrate
```

## Docker Setup

PostgreSQL runs in Docker:

```bash
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f postgres
```

## Type Safety

Drizzle provides full TypeScript support:

```typescript
// Schema defines types
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
});

// Queries are type-safe
const users = await db.select().from(users);
// users: { id: number; name: string; email: string }[]
```
