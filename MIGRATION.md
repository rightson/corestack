# Database Migration Guide

This guide will help you apply the database schema changes for the new LDAP login UI and project management features.

## Changes Made

1. **Projects Table Updates:**
   - Added `projectVersion` (varchar 100, required)
   - Added `projectCode` (varchar 100, required)
   - Changed `name` to optional (previously required)

2. **New Table:**
   - Added `permissionRequests` table for tracking project access requests

## Migration Options

### Option 1: Fresh Database (Recommended for Development)

If you're starting fresh or can afford to lose existing data:

```bash
# 1. Create a .env file from the example
cp .env.example .env

# 2. Update DATABASE_URL in .env with your PostgreSQL credentials
# Example: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb

# 3. Push the schema to the database (this will drop and recreate tables)
npm run db:push

# 4. Seed the database with initial data (creates root user)
npm run db:seed
```

### Option 2: Manual Migration (For Existing Data)

If you have existing data in the projects table:

```sql
-- Connect to your PostgreSQL database and run:

-- Add new columns to projects table
ALTER TABLE projects
  ADD COLUMN project_version varchar(100),
  ADD COLUMN project_code varchar(100);

-- Update existing projects with default values
UPDATE projects
SET
  project_version = '1.0.0',
  project_code = 'PROJ-' || id::text
WHERE project_version IS NULL OR project_code IS NULL;

-- Make the new columns NOT NULL
ALTER TABLE projects
  ALTER COLUMN project_version SET NOT NULL,
  ALTER COLUMN project_code SET NOT NULL;

-- Make name column nullable
ALTER TABLE projects
  ALTER COLUMN name DROP NOT NULL;

-- Create permission_requests table
CREATE TABLE permission_requests (
  id serial PRIMARY KEY,
  project_id integer NOT NULL,
  user_id integer NOT NULL,
  status varchar(50) DEFAULT 'pending' NOT NULL,
  requested_at timestamp DEFAULT now() NOT NULL,
  resolved_at timestamp,
  resolved_by integer,
  CONSTRAINT permission_requests_project_id_fk FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT permission_requests_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT permission_requests_resolved_by_fk FOREIGN KEY (resolved_by) REFERENCES users(id)
);
```

### Option 3: Using Drizzle Migrate (Production)

```bash
# 1. Generate migration files (already done)
npm run db:generate

# 2. Review the migration file in drizzle/0000_complex_titanium_man.sql

# 3. Apply migrations
npm run db:migrate
```

## Environment Setup

Make sure your `.env` file contains:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb

# Redis (for task queue and WebSocket)
REDIS_URL=redis://localhost:6379

# Server
PORT=3000
WS_PORT=3001

# App
NODE_ENV=development

# Authentication
JWT_SECRET=your-secret-key-change-in-production-make-it-long-and-random

# LDAP (optional - only needed if using LDAP authentication)
LDAP_URL=ldap://your-ldap-server:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
```

## Running the Application

After migration:

```bash
# Development mode
npm run dev

# The app will be available at http://localhost:3000
# Default credentials: username=root, password=Must-Changed
```

## Features

- **Modern Login UI** with Email/LDAP authentication toggle
- **Two-column Dashboard:**
  - Left: My Projects (your owned projects)
  - Right: Explore Projects (all public projects with search)
- **Search Functionality:** Search projects by version, code, or name
- **Permission Requests:** Request access to projects you don't have permission for
- **Project Fields:**
  - Project Version (required)
  - Project Code (required)
  - Project Name (optional)
  - Description
  - Creation Date
  - Last Access Time
