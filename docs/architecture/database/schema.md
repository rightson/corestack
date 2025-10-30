# Database Schema Reference

## Complete Schema Documentation

All schema definitions are in `lib/db/schema.ts`.

## Tables

### users

User accounts supporting both email and LDAP authentication.

```typescript
{
  id: serial (primary key),
  username: varchar(255) unique not null,
  name: varchar(255) not null,
  email: varchar(255) unique not null,
  password: varchar(255) nullable,  // Hashed, only for email auth
  authType: varchar(50) not null default 'email',  // 'email' or 'ldap'
  mustChangePassword: boolean default false,
  createdAt: timestamp not null,
  updatedAt: timestamp not null,
  lastLogin: timestamp nullable
}
```

**Indexes:**
- Primary key on `id`
- Unique constraint on `username`
- Unique constraint on `email`

**Notes:**
- `password` is null for LDAP users
- `authType` determines authentication method
- `mustChangePassword` forces password change on next login

### posts

User-generated content/posts.

```typescript
{
  id: serial (primary key),
  title: varchar(255) not null,
  content: text nullable,
  authorId: integer not null,  // FK -> users.id
  createdAt: timestamp not null,
  updatedAt: timestamp not null
}
```

**Relationships:**
- `authorId` references `users.id`

### projects

Project management records.

```typescript
{
  id: serial (primary key),
  projectVersion: varchar(100) not null,
  projectCode: varchar(100) not null,
  name: varchar(255) nullable,
  description: text nullable,
  ownerId: integer not null,  // FK -> users.id
  status: varchar(50) not null default 'active',  // 'active', 'archived', 'completed'
  visibility: varchar(50) not null default 'private',  // 'private', 'public'
  metadata: jsonb nullable,
  createdAt: timestamp not null,
  updatedAt: timestamp not null,
  lastAccessedAt: timestamp nullable
}
```

**Relationships:**
- `ownerId` references `users.id`

**Notes:**
- `projectVersion` and `projectCode` are required identifiers
- `name` is optional, falls back to "Untitled Project"
- `metadata` stores additional project data as JSON

### project_members

Project access control and memberships.

```typescript
{
  id: serial (primary key),
  projectId: integer not null,  // FK -> projects.id
  userId: integer not null,     // FK -> users.id
  role: varchar(50) not null default 'member',  // 'owner', 'admin', 'member', 'viewer'
  joinedAt: timestamp not null
}
```

**Relationships:**
- `projectId` references `projects.id`
- `userId` references `users.id`

**Roles:**
- `owner` - Full control
- `admin` - Management permissions
- `member` - Read/write access
- `viewer` - Read-only access

### permission_requests

Access request workflow for projects.

```typescript
{
  id: serial (primary key),
  projectId: integer not null,  // FK -> projects.id
  userId: integer not null,     // FK -> users.id
  status: varchar(50) not null default 'pending',  // 'pending', 'approved', 'rejected'
  requestedAt: timestamp not null,
  resolvedAt: timestamp nullable,
  resolvedBy: integer nullable  // FK -> users.id
}
```

**Relationships:**
- `projectId` references `projects.id`
- `userId` references `users.id` (requester)
- `resolvedBy` references `users.id` (approver)

**Workflow:**
1. User requests access (`status: 'pending'`)
2. Owner/admin approves or rejects
3. `resolvedAt` and `resolvedBy` are set
4. If approved, user is added to `project_members`

### tasks

Background job tracking (BullMQ).

```typescript
{
  id: serial (primary key),
  name: varchar(255) not null,
  status: varchar(50) not null default 'pending',  // 'pending', 'processing', 'completed', 'failed'
  data: jsonb nullable,
  result: jsonb nullable,
  createdAt: timestamp not null,
  completedAt: timestamp nullable
}
```

**Status Flow:**
1. `pending` - Job created
2. `processing` - Job being executed
3. `completed` - Job succeeded
4. `failed` - Job failed

## Entity Relationships

```
users
  ├──< posts (authorId)
  ├──< projects (ownerId)
  ├──< project_members (userId)
  ├──< permission_requests (userId, resolvedBy)
  └──< (other user-related entities)

projects
  ├──< project_members (projectId)
  └──< permission_requests (projectId)
```

## Adding New Tables

1. Define schema in `lib/db/schema.ts`:

```typescript
export const myTable = pgTable('my_table', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

2. Push to database:

```bash
npm run db:push
```

## Column Types

Common Drizzle column types:

- `serial('id')` - Auto-incrementing integer
- `varchar('name', { length: 255 })` - Variable-length string
- `text('content')` - Unlimited length string
- `integer('count')` - Integer number
- `boolean('active')` - Boolean
- `timestamp('created_at')` - Timestamp with timezone
- `jsonb('data')` - JSON data

## Constraints

```typescript
// Not null
.notNull()

// Unique
.unique()

// Default value
.default('value')
.defaultNow()  // For timestamps

// Primary key
.primaryKey()

// Foreign key
.references(() => users.id)
```

## Seed Data

Default seed creates root user:

```bash
npm run db:seed
```

Creates:
```typescript
{
  username: 'root',
  password: 'Must-Changed' (hashed),
  email: 'root@example.com',
  authType: 'email',
  mustChangePassword: true
}
```
