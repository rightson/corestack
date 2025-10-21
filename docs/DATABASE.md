# Database Guide

## Database Management with Drizzle

This project uses [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations with PostgreSQL.

## Schema

The database schema is defined in `lib/db/schema.ts`:

### Users Table
```typescript
{
  id: serial (primary key),
  name: varchar(255),
  email: varchar(255) unique,
  password: varchar(255),
  createdAt: timestamp
}
```

### Posts Table
```typescript
{
  id: serial (primary key),
  title: varchar(255),
  content: text,
  authorId: integer (foreign key -> users.id),
  createdAt: timestamp
}
```

### Projects Table
```typescript
{
  id: serial (primary key),
  name: varchar(255) (optional),
  projectVersion: varchar(100),
  projectCode: varchar(100),
  description: text,
  ownerId: integer (foreign key -> users.id),
  createdAt: timestamp,
  lastAccessedAt: timestamp
}
```

### Permission Requests Table
```typescript
{
  id: serial (primary key),
  projectId: integer (foreign key -> projects.id),
  userId: integer (foreign key -> users.id),
  status: varchar(50) default 'pending',
  requestedAt: timestamp,
  resolvedAt: timestamp (optional),
  resolvedBy: integer (foreign key -> users.id, optional)
}
```

## Common Operations

### Pushing Schema Changes

Push schema changes directly to the database (development):
```bash
npm run db:push
```

This command uses `drizzle-kit push` to sync your schema with the database without creating migration files.

### Generating Migrations

Create migration files from schema changes:
```bash
npm run db:generate
```

### Running Migrations

Apply pending migrations:
```bash
npm run db:migrate
```

### Drizzle Studio

Open Drizzle Studio for visual database management:
```bash
npm run db:studio
```

## Development Workflow

### Adding a New Table

1. Define the table in `lib/db/schema.ts`:
```typescript
export const myTable = pgTable('my_table', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

2. Push the schema to database:
```bash
npm run db:push
```

### Adding a New Column

1. Update the table in `lib/db/schema.ts`:
```typescript
export const users = pgTable('users', {
  // existing columns...
  phoneNumber: varchar('phone_number', { length: 20 }),
});
```

2. Push the changes:
```bash
npm run db:push
```

## Production Workflow

For production deployments, use migrations instead of `db:push`:

1. **Generate migrations**:
```bash
npm run db:generate
```

2. **Review migration files** in `drizzle/` directory

3. **Apply migrations**:
```bash
npm run db:migrate
```

## Querying the Database

### Using Drizzle Client

```typescript
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

// Select all users
const allUsers = await db.select().from(users);

// Find user by email
const user = await db
  .select()
  .from(users)
  .where(eq(users.email, 'user@example.com'))
  .limit(1);

// Insert a user
const newUser = await db
  .insert(users)
  .values({
    name: 'John Doe',
    email: 'john@example.com',
  })
  .returning();

// Update a user
await db
  .update(users)
  .set({ name: 'Jane Doe' })
  .where(eq(users.id, userId));

// Delete a user
await db
  .delete(users)
  .where(eq(users.id, userId));
```

## Environment Configuration

Set your database connection in `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb
```

## Docker Setup

The project includes a `docker-compose.yml` with PostgreSQL:

```bash
# Start PostgreSQL
docker-compose up -d

# Stop PostgreSQL
docker-compose down

# View logs
docker-compose logs -f postgres
```
