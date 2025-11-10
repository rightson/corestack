# Role-Based Access Control (RBAC) Design Proposal

## Overview

This document outlines the design and implementation strategy for a comprehensive Role-Based Access Control (RBAC) system in CoreStack. The RBAC system will provide fine-grained access control for users across projects, groups, and system resources with support for both project-specific and cross-project roles.

**Implementation Status**: 🔴 Not Started (0% complete)

## Executive Summary

The proposed RBAC system will enable:

- **Flexible User Management**: Single user accounts with multiple project memberships and external system accounts (NIS)
- **Dynamic Role Management**: Create and modify roles without code changes
- **Granular Permissions**: Fine-grained control over API endpoints, UI menus, and resource operations (CRUD)
- **Multi-Level Access Control**: Project-specific roles, cross-project roles, and global system roles
- **Audit Trail**: Complete logging of permission changes and access attempts
- **Backward Compatibility**: Seamless migration from current project-member roles

## Current State Analysis

### Existing Authentication & Authorization

**Location**: `/home/user/corestack/lib/auth/`

Current implementation includes:
- JWT-based authentication (HS256, 24-hour expiration)
- Email/password and LDAP authentication
- Basic project membership with roles: `owner`, `admin`, `member`, `viewer`
- Permission request workflow

**Key Limitations**:
1. ❌ No global/system-wide roles
2. ❌ No fine-grained permissions (only project-level roles)
3. ❌ No permission enforcement in tRPC routers
4. ❌ Manual token verification in each procedure
5. ❌ No audit logging for access control
6. ❌ No support for cross-project roles or teams
7. ❌ No resource-level permissions

### Existing Database Schema

**Relevant Tables**:
```typescript
// Current schema in lib/db/schema.ts

users {
  id: serial primary key
  username: varchar unique
  email: varchar unique
  authType: 'email' | 'ldap'
  // ... other fields
}

projects {
  id: serial primary key
  name: varchar
  ownerId: integer → users.id
  // ... other fields
}

project_members {
  id: serial primary key
  projectId: integer → projects.id
  userId: integer → users.id
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joinedAt: timestamp
}
```

## Requirements

### Functional Requirements

#### FR-1: User Management
- **FR-1.1**: Each user has a single account in the system
- **FR-1.2**: Users can join multiple projects and groups
- **FR-1.3**: Users can have multiple "project accounts" for external systems (Linux NIS)
- **FR-1.4**: User roles can be assigned at project, group, and system levels

#### FR-2: Role Management
- **FR-2.1**: Roles can be dynamically created and modified
- **FR-2.2**: Three types of roles:
  - **System Roles**: Global roles (e.g., system admin, moderator)
  - **Project Roles**: Project-specific roles (e.g., project owner, staff, member)
  - **Cross-Project Roles**: Roles spanning multiple projects (e.g., manager, cross-project workforce)
- **FR-2.3**: Roles have human-readable names, descriptions, and metadata
- **FR-2.4**: Roles can be enabled/disabled without deletion
- **FR-2.5**: Role hierarchy support (role inheritance)

#### FR-3: Permission Management
- **FR-3.1**: Permissions define access to specific resources
- **FR-3.2**: Resource types include:
  - API endpoints (tRPC procedures)
  - UI menu items/components
  - Data entities (projects, users, etc.)
- **FR-3.3**: Permission actions include: `create`, `read`, `update`, `delete`, `execute`
- **FR-3.4**: Permissions can be assigned to roles
- **FR-3.5**: Multiple permissions can be assigned to a single role

#### FR-4: Access Control
- **FR-4.1**: System evaluates user permissions before allowing resource access
- **FR-4.2**: Permission checks at multiple levels:
  - System level (global permissions)
  - Project level (project-specific permissions)
  - Resource level (specific resource permissions)
- **FR-4.3**: Hierarchical permission resolution (most specific wins)
- **FR-4.4**: Support for permission delegation

#### FR-5: Groups & Teams
- **FR-5.1**: Users can be organized into groups
- **FR-5.2**: Groups can span single or multiple projects
- **FR-5.3**: Roles can be assigned to groups
- **FR-5.4**: Group members inherit group roles and permissions

#### FR-6: External System Integration
- **FR-6.1**: Support for Linux NIS account mapping
- **FR-6.2**: Each user can have multiple project-specific external accounts
- **FR-6.3**: External account credentials managed securely
- **FR-6.4**: Mapping between internal users and external accounts

#### FR-7: Audit & Logging
- **FR-7.1**: Log all permission grants/revocations
- **FR-7.2**: Log all role assignments/removals
- **FR-7.3**: Log access attempts (success and failures)
- **FR-7.4**: Audit logs include timestamp, user, action, resource, result

### Non-Functional Requirements

#### NFR-1: Performance
- Permission checks should complete in < 10ms
- Cache frequently accessed permissions
- Minimize database queries for permission checks

#### NFR-2: Security
- No permission escalation vulnerabilities
- Secure storage of external account credentials
- Rate limiting on failed access attempts
- Audit trail immutability

#### NFR-3: Scalability
- Support 10,000+ users
- Support 1,000+ projects
- Support 100+ roles
- Support 500+ permissions

#### NFR-4: Maintainability
- Clear separation of concerns
- Comprehensive type safety (TypeScript)
- Well-documented API
- Migration path from current system

## Proposed Architecture

### Database Schema

#### New Tables

```typescript
// 1. Groups table
groups {
  id: serial primary key
  name: varchar(255) not null
  description: text
  groupType: varchar(50) not null  // 'project' | 'cross-project' | 'functional'
  metadata: jsonb
  createdAt: timestamp default now()
  updatedAt: timestamp default now()
}

// 2. Group members junction table
group_members {
  id: serial primary key
  groupId: integer not null → groups.id
  userId: integer not null → users.id
  joinedAt: timestamp default now()
  unique(groupId, userId)
}

// 3. Group projects junction table (for cross-project groups)
group_projects {
  id: serial primary key
  groupId: integer not null → groups.id
  projectId: integer not null → projects.id
  addedAt: timestamp default now()
  unique(groupId, projectId)
}

// 4. Roles table
roles {
  id: serial primary key
  name: varchar(100) not null unique
  displayName: varchar(255) not null
  description: text
  roleType: varchar(50) not null  // 'system' | 'project' | 'cross-project'
  isActive: boolean default true
  isBuiltIn: boolean default false  // true for system-defined roles
  metadata: jsonb
  createdAt: timestamp default now()
  updatedAt: timestamp default now()
}

// 5. Permissions table
permissions {
  id: serial primary key
  name: varchar(100) not null unique
  displayName: varchar(255) not null
  description: text
  resourceType: varchar(50) not null  // 'api' | 'ui' | 'data'
  resourceName: varchar(255) not null  // e.g., 'user.create', 'projects.read'
  action: varchar(50) not null  // 'create' | 'read' | 'update' | 'delete' | 'execute'
  isActive: boolean default true
  metadata: jsonb
  createdAt: timestamp default now()
  unique(resourceType, resourceName, action)
}

// 6. Role permissions junction table
role_permissions {
  id: serial primary key
  roleId: integer not null → roles.id
  permissionId: integer not null → permissions.id
  grantedAt: timestamp default now()
  grantedBy: integer → users.id
  unique(roleId, permissionId)
}

// 7. User system roles
user_system_roles {
  id: serial primary key
  userId: integer not null → users.id
  roleId: integer not null → roles.id
  grantedAt: timestamp default now()
  grantedBy: integer → users.id
  expiresAt: timestamp null  // optional expiration
  unique(userId, roleId)
}

// 8. User project roles (enhanced version of project_members)
user_project_roles {
  id: serial primary key
  userId: integer not null → users.id
  projectId: integer not null → projects.id
  roleId: integer not null → roles.id
  grantedAt: timestamp default now()
  grantedBy: integer → users.id
  expiresAt: timestamp null
  unique(userId, projectId, roleId)
}

// 9. User group roles
user_group_roles {
  id: serial primary key
  userId: integer not null → users.id
  groupId: integer not null → groups.id
  roleId: integer not null → roles.id
  grantedAt: timestamp default now()
  grantedBy: integer → users.id
  expiresAt: timestamp null
  unique(userId, groupId, roleId)
}

// 10. External accounts (for NIS integration)
external_accounts {
  id: serial primary key
  userId: integer not null → users.id
  projectId: integer → projects.id  // null for system-wide accounts
  accountType: varchar(50) not null  // 'nis' | 'ldap' | 'ad' | 'other'
  username: varchar(255) not null
  credentials: text  // encrypted
  metadata: jsonb
  isActive: boolean default true
  createdAt: timestamp default now()
  updatedAt: timestamp default now()
  unique(accountType, projectId, username)
}

// 11. Audit log for access control
rbac_audit_log {
  id: serial primary key
  userId: integer → users.id
  action: varchar(100) not null  // 'grant_role' | 'revoke_role' | 'access_granted' | 'access_denied'
  resourceType: varchar(50)
  resourceId: integer
  roleId: integer → roles.id
  permissionId: integer → permissions.id
  result: varchar(50)  // 'success' | 'denied' | 'error'
  metadata: jsonb
  ipAddress: varchar(45)
  userAgent: text
  createdAt: timestamp default now()
}

// 12. Permission cache (for performance)
permission_cache {
  id: serial primary key
  userId: integer not null → users.id
  projectId: integer → projects.id  // null for system permissions
  permissionId: integer not null → permissions.id
  hasPermission: boolean not null
  cacheKey: varchar(255) not null unique
  expiresAt: timestamp not null
  createdAt: timestamp default now()
}
```

### Entity Relationships

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         RBAC System Architecture                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────┐         ┌─────────────────┐         ┌──────────┐
│  Users  │────────▶│ user_system     │────────▶│  Roles   │
└─────────┘         │ _roles          │         └──────────┘
     │              └─────────────────┘               │
     │                                                 │
     │              ┌─────────────────┐               │
     ├─────────────▶│ user_project    │───────────────┤
     │              │ _roles          │               │
     │              └─────────────────┘               │
     │                      │                         │
     │                      ▼                         │
     │              ┌─────────────┐                   │
     │              │  Projects   │                   │
     │              └─────────────┘                   │
     │                                                 │
     │              ┌─────────────────┐               │
     ├─────────────▶│ group_members   │               │
     │              └─────────────────┘               │
     │                      │                         │
     │                      ▼                         │
     │              ┌─────────────┐                   │
     │              │   Groups    │                   │
     │              └─────────────┘                   │
     │                      │                         │
     │                      │                         │
     │              ┌─────────────────┐               │
     └─────────────▶│ user_group      │───────────────┤
                    │ _roles          │               │
                    └─────────────────┘               │
                                                      │
                    ┌─────────────────┐               │
                    │ role_           │◀──────────────┘
                    │ permissions     │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Permissions    │
                    └─────────────────┘
```

### Permission Resolution Algorithm

```typescript
/**
 * Permission resolution follows this hierarchy:
 * 1. System-level permissions (user_system_roles)
 * 2. Group-level permissions (user_group_roles)
 * 3. Project-level permissions (user_project_roles)
 * 4. Explicit denials take precedence over grants
 */

async function checkPermission(
  userId: number,
  permission: string,
  projectId?: number
): Promise<boolean> {
  // 1. Check cache first
  const cached = await checkPermissionCache(userId, permission, projectId);
  if (cached !== null) return cached;

  // 2. Get all user's roles (system, project, group)
  const userRoles = await getUserAllRoles(userId, projectId);

  // 3. Get all permissions from roles
  const userPermissions = await getRolePermissions(userRoles);

  // 4. Check if permission exists
  const hasPermission = userPermissions.includes(permission);

  // 5. Cache result
  await cachePermission(userId, permission, projectId, hasPermission);

  // 6. Audit log
  await logAccessAttempt(userId, permission, projectId, hasPermission);

  return hasPermission;
}
```

## Implementation Strategy

### Phase 1: Database Schema Migration (Week 1)

**Tasks**:
1. Create migration files for new tables
2. Add indexes for performance
3. Seed built-in roles and permissions
4. Create backward compatibility layer

**Deliverables**:
- Drizzle migration files
- Seed script for initial data
- Documentation of schema changes

**Estimated Effort**: 8-12 hours

**Risk Level**: Low

### Phase 2: Core RBAC Service (Week 1-2)

**Tasks**:
1. Implement RBAC service layer (`lib/rbac/`)
2. Permission checker functions
3. Role management functions
4. User role assignment functions
5. Audit logging service

**Key Files to Create**:
```
lib/rbac/
  ├── index.ts                 # Main exports
  ├── permission-checker.ts    # Permission checking logic
  ├── role-service.ts          # Role CRUD operations
  ├── permission-service.ts    # Permission CRUD operations
  ├── user-role-service.ts     # User role assignments
  ├── group-service.ts         # Group management
  ├── cache-service.ts         # Permission caching
  ├── audit-service.ts         # Audit logging
  └── types.ts                 # TypeScript types
```

**Deliverables**:
- Fully tested RBAC service
- TypeScript types and interfaces
- Unit tests (80%+ coverage)

**Estimated Effort**: 16-24 hours

**Risk Level**: Medium

### Phase 3: tRPC Integration (Week 2)

**Tasks**:
1. Enhance tRPC context with user info
2. Create protected procedures
3. Add permission middleware
4. Update existing routers

**Changes to `lib/trpc/`**:

```typescript
// lib/trpc/context.ts (enhanced)
import { verifyToken } from '@/lib/auth/jwt';

export async function createContext({ req, res }: CreateNextContextOptions) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  let user = null;
  if (token) {
    try {
      const payload = await verifyToken(token);
      user = payload;
    } catch (error) {
      // Invalid token, user remains null
    }
  }

  return {
    db,
    user,  // Now available in all procedures
  };
}

// lib/trpc/trpc.ts (enhanced)
import { TRPCError } from '@trpc/server';
import { checkPermission } from '@/lib/rbac';

// Protected procedure - requires authentication
export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Permission-based procedure
export const permissionProcedure = (permission: string) => {
  return protectedProcedure.use(async ({ ctx, next, input }) => {
    const projectId = (input as any)?.projectId;
    const hasPermission = await checkPermission(ctx.user.userId, permission, projectId);

    if (!hasPermission) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }

    return next({ ctx });
  });
};
```

**Usage in Routers**:

```typescript
// server/routers/user.ts (updated)
import { permissionProcedure } from '@/lib/trpc/trpc';

export const userRouter = router({
  list: permissionProcedure('user.read')
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      // Permission already checked by middleware
      return await ctx.db.select().from(users).limit(input.limit ?? 10);
    }),

  create: permissionProcedure('user.create')
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Create user logic
    }),
});
```

**Deliverables**:
- Enhanced tRPC context
- Permission middleware
- Updated routers with permission checks
- Integration tests

**Estimated Effort**: 12-16 hours

**Risk Level**: Medium

### Phase 4: API Routers for RBAC Management (Week 3)

**Tasks**:
1. Create RBAC management routers
2. Role CRUD endpoints
3. Permission CRUD endpoints
4. User role assignment endpoints
5. Group management endpoints

**New Routers to Create**:

```typescript
// server/routers/rbac.ts
export const rbacRouter = router({
  // Roles
  roles: router({
    list: permissionProcedure('rbac.role.read').query(async ({ ctx }) => { /* ... */ }),
    create: permissionProcedure('rbac.role.create').mutation(async ({ ctx, input }) => { /* ... */ }),
    update: permissionProcedure('rbac.role.update').mutation(async ({ ctx, input }) => { /* ... */ }),
    delete: permissionProcedure('rbac.role.delete').mutation(async ({ ctx, input }) => { /* ... */ }),
  }),

  // Permissions
  permissions: router({
    list: permissionProcedure('rbac.permission.read').query(async ({ ctx }) => { /* ... */ }),
    create: permissionProcedure('rbac.permission.create').mutation(async ({ ctx, input }) => { /* ... */ }),
  }),

  // User roles
  userRoles: router({
    assign: permissionProcedure('rbac.user-role.assign').mutation(async ({ ctx, input }) => { /* ... */ }),
    revoke: permissionProcedure('rbac.user-role.revoke').mutation(async ({ ctx, input }) => { /* ... */ }),
    getUserRoles: permissionProcedure('rbac.user-role.read').query(async ({ ctx, input }) => { /* ... */ }),
  }),

  // Groups
  groups: router({
    list: permissionProcedure('rbac.group.read').query(async ({ ctx }) => { /* ... */ }),
    create: permissionProcedure('rbac.group.create').mutation(async ({ ctx, input }) => { /* ... */ }),
    addMember: permissionProcedure('rbac.group.update').mutation(async ({ ctx, input }) => { /* ... */ }),
    removeMember: permissionProcedure('rbac.group.update').mutation(async ({ ctx, input }) => { /* ... */ }),
  }),

  // Audit
  auditLog: router({
    list: permissionProcedure('rbac.audit.read').query(async ({ ctx, input }) => { /* ... */ }),
  }),
});
```

**Deliverables**:
- Complete RBAC management API
- Input validation schemas
- API documentation
- Integration tests

**Estimated Effort**: 16-20 hours

**Risk Level**: Low-Medium

### Phase 5: External Account Management (Week 3-4)

**Tasks**:
1. Implement external account service
2. NIS integration
3. Credential encryption/decryption
4. Account mapping

**Key Components**:

```typescript
// lib/rbac/external-accounts.ts
import { encrypt, decrypt } from '@/lib/security/encryption';

export async function createExternalAccount(
  userId: number,
  accountType: string,
  username: string,
  password: string,
  projectId?: number
) {
  const encryptedPassword = await encrypt(password);

  return await db.insert(externalAccounts).values({
    userId,
    accountType,
    username,
    credentials: encryptedPassword,
    projectId,
  });
}

export async function getExternalAccount(
  userId: number,
  projectId?: number,
  accountType: string = 'nis'
) {
  const account = await db
    .select()
    .from(externalAccounts)
    .where(
      and(
        eq(externalAccounts.userId, userId),
        eq(externalAccounts.accountType, accountType),
        projectId ? eq(externalAccounts.projectId, projectId) : isNull(externalAccounts.projectId)
      )
    )
    .limit(1);

  if (!account[0]) return null;

  return {
    ...account[0],
    credentials: await decrypt(account[0].credentials),
  };
}
```

**Deliverables**:
- External account management service
- Encryption/decryption utilities
- NIS integration
- API endpoints
- Tests

**Estimated Effort**: 12-16 hours

**Risk Level**: Medium-High

### Phase 6: UI Components (Week 4-5)

**Tasks**:
1. Role management UI
2. Permission assignment UI
3. User role assignment UI
4. Group management UI
5. Audit log viewer

**New Components**:
```
app/admin/rbac/
  ├── roles/
  │   ├── page.tsx          # Role list
  │   ├── [id]/page.tsx     # Role detail/edit
  │   └── new/page.tsx      # Create role
  ├── permissions/
  │   ├── page.tsx          # Permission list
  │   └── [id]/page.tsx     # Permission detail
  ├── users/
  │   └── [id]/roles/page.tsx  # User role management
  ├── groups/
  │   ├── page.tsx          # Group list
  │   └── [id]/page.tsx     # Group detail
  └── audit/
      └── page.tsx          # Audit log viewer
```

**Deliverables**:
- Admin UI for RBAC management
- User-facing permission views
- Group management interface
- Audit log viewer
- Component tests

**Estimated Effort**: 24-32 hours

**Risk Level**: Low

### Phase 7: Migration from Legacy System (Week 5)

**Tasks**:
1. Create migration script
2. Map old roles to new roles
3. Migrate project_members data
4. Verify data integrity
5. Create rollback script

**Migration Script**:

```typescript
// scripts/migrate-rbac.ts
import { db } from '@/lib/db';
import { roles, permissions, userProjectRoles, projectMembers } from '@/lib/db/schema';

async function migrateRBAC() {
  console.log('Starting RBAC migration...');

  // 1. Create built-in roles
  const builtInRoles = [
    { name: 'system_admin', displayName: 'System Administrator', roleType: 'system' },
    { name: 'project_owner', displayName: 'Project Owner', roleType: 'project' },
    { name: 'project_admin', displayName: 'Project Admin', roleType: 'project' },
    { name: 'project_member', displayName: 'Project Member', roleType: 'project' },
    { name: 'project_viewer', displayName: 'Project Viewer', roleType: 'project' },
  ];

  const createdRoles = await db.insert(roles).values(builtInRoles).returning();

  // 2. Create built-in permissions
  const builtInPermissions = [
    // User permissions
    { name: 'user.create', displayName: 'Create User', resourceType: 'api', resourceName: 'user', action: 'create' },
    { name: 'user.read', displayName: 'Read User', resourceType: 'api', resourceName: 'user', action: 'read' },
    { name: 'user.update', displayName: 'Update User', resourceType: 'api', resourceName: 'user', action: 'update' },
    { name: 'user.delete', displayName: 'Delete User', resourceType: 'api', resourceName: 'user', action: 'delete' },

    // Project permissions
    { name: 'project.create', displayName: 'Create Project', resourceType: 'api', resourceName: 'project', action: 'create' },
    { name: 'project.read', displayName: 'Read Project', resourceType: 'api', resourceName: 'project', action: 'read' },
    { name: 'project.update', displayName: 'Update Project', resourceType: 'api', resourceName: 'project', action: 'update' },
    { name: 'project.delete', displayName: 'Delete Project', resourceType: 'api', resourceName: 'project', action: 'delete' },

    // RBAC permissions
    { name: 'rbac.role.create', displayName: 'Create Role', resourceType: 'api', resourceName: 'role', action: 'create' },
    { name: 'rbac.role.read', displayName: 'Read Role', resourceType: 'api', resourceName: 'role', action: 'read' },
    { name: 'rbac.role.update', displayName: 'Update Role', resourceType: 'api', resourceName: 'role', action: 'update' },
    { name: 'rbac.role.delete', displayName: 'Delete Role', resourceType: 'api', resourceName: 'role', action: 'delete' },
    // ... more permissions
  ];

  await db.insert(permissions).values(builtInPermissions);

  // 3. Migrate existing project_members to user_project_roles
  const existingMembers = await db.select().from(projectMembers);

  for (const member of existingMembers) {
    // Map old role to new role
    const roleMapping: Record<string, string> = {
      'owner': 'project_owner',
      'admin': 'project_admin',
      'member': 'project_member',
      'viewer': 'project_viewer',
    };

    const newRoleName = roleMapping[member.role];
    const role = createdRoles.find(r => r.name === newRoleName);

    if (role) {
      await db.insert(userProjectRoles).values({
        userId: member.userId,
        projectId: member.projectId,
        roleId: role.id,
        grantedAt: member.joinedAt,
      });
    }
  }

  console.log('RBAC migration completed successfully!');
}

// Run migration
migrateRBAC().catch(console.error);
```

**Deliverables**:
- Migration script
- Data verification script
- Rollback script
- Migration documentation

**Estimated Effort**: 8-12 hours

**Risk Level**: Medium

### Phase 8: Testing & Documentation (Week 6)

**Tasks**:
1. End-to-end testing
2. Performance testing
3. Security testing
4. Documentation
5. Training materials

**Test Coverage**:
- Unit tests: 80%+
- Integration tests: Core flows
- E2E tests: Critical user journeys
- Performance tests: Permission checks < 10ms

**Documentation**:
- API documentation
- User guide
- Admin guide
- Migration guide
- Architecture documentation

**Deliverables**:
- Complete test suite
- Performance benchmarks
- Security audit report
- Comprehensive documentation

**Estimated Effort**: 16-24 hours

**Risk Level**: Low

## Built-in Roles & Permissions

### System Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **System Administrator** | Full system access | All permissions |
| **System Moderator** | User & content moderation | user.*, project.read, group.* |
| **Developer** | Technical access | project.*, api.*, logs.read |
| **Auditor** | Read-only access for compliance | *.read, audit.* |

### Project Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Project Owner** | Full project control | project.*, member.*, role.* (project scope) |
| **Project Admin** | Administrative access | project.update, member.*, task.* |
| **Project Staff** | Core team member | project.read, task.*, post.* |
| **Project Member** | Regular member | project.read, task.read, post.create |
| **Project Viewer** | Read-only access | project.read, task.read, post.read |

### Cross-Project Roles

| Role | Description | Scope |
|------|-------------|-------|
| **Upper Manager** | Oversees multiple projects | Multi-project read access, reporting |
| **Cross-Project Workforce** | Works across projects | Task execution in multiple projects |
| **Functional Team Lead** | Leads specialized team | Team-specific permissions across projects |

## Permission Naming Convention

Format: `<resource>.<action>[.<scope>]`

Examples:
- `user.create` - Create users
- `user.read.own` - Read own user data
- `user.read.all` - Read all user data
- `project.update.owner` - Update projects you own
- `project.update.all` - Update any project
- `api.execute.admin` - Execute admin API endpoints
- `ui.view.admin-panel` - View admin panel in UI

## Security Considerations

### 1. Principle of Least Privilege
- Users granted minimum necessary permissions
- Regular permission audits
- Time-limited role assignments

### 2. Defense in Depth
- Multiple layers of permission checks
- Server-side validation (never trust client)
- API rate limiting

### 3. Secure Credential Storage
- External account credentials encrypted at rest
- Encryption key management via environment variables
- Credential rotation policy

### 4. Audit Logging
- Immutable audit logs
- Log retention policy (90 days minimum)
- Regular audit log reviews
- Anomaly detection

### 5. Session Management
- JWT tokens with expiration
- Token refresh mechanism
- Logout/token revocation

### 6. API Security
- tRPC context-based authentication
- Permission checks before all sensitive operations
- Input validation with Zod schemas

## Performance Optimization

### 1. Permission Caching

```typescript
// Cache strategy
const cacheConfig = {
  ttl: 300, // 5 minutes
  strategy: 'write-through',
  invalidation: 'on-role-change',
};

// Cache key format: `user:{userId}:project:{projectId}:perm:{permission}`
```

### 2. Database Indexing

```sql
-- Critical indexes for performance
CREATE INDEX idx_user_system_roles_user ON user_system_roles(userId);
CREATE INDEX idx_user_project_roles_user_project ON user_project_roles(userId, projectId);
CREATE INDEX idx_user_group_roles_user_group ON user_group_roles(userId, groupId);
CREATE INDEX idx_role_permissions_role ON role_permissions(roleId);
CREATE INDEX idx_permissions_resource ON permissions(resourceType, resourceName, action);
CREATE INDEX idx_permission_cache_lookup ON permission_cache(userId, projectId, permissionId);
```

### 3. Query Optimization

```typescript
// Batch permission checks
async function checkMultiplePermissions(
  userId: number,
  permissions: string[],
  projectId?: number
): Promise<Record<string, boolean>> {
  // Single database query for all permissions
  // Return map of permission -> boolean
}
```

### 4. Lazy Loading
- Load permissions on-demand
- Paginate audit logs
- Async role resolution

## Migration Path

### Backward Compatibility

**Step 1: Parallel Systems (Week 1-2)**
- Run both old and new systems simultaneously
- New tables alongside old tables
- Gradual data migration

**Step 2: Soft Cutover (Week 3-4)**
- New system primary
- Old system fallback
- Monitor for issues

**Step 3: Full Cutover (Week 5)**
- Disable old system
- Remove deprecated code
- Archive old tables

**Step 4: Cleanup (Week 6)**
- Remove backward compatibility layer
- Optimize new system
- Final documentation update

### Data Migration Strategy

```typescript
// Migration phases
1. Schema creation (new tables)
2. Data seeding (built-in roles/permissions)
3. Data migration (project_members → user_project_roles)
4. Validation (data integrity checks)
5. Cutover (switch to new system)
6. Cleanup (remove old tables after grace period)
```

## Rollback Plan

### Quick Rollback (< 1 hour)

```bash
# 1. Revert code changes
git revert <migration-commit>

# 2. Restore database (if needed)
npm run db:rollback

# 3. Restart services
docker-compose restart
```

### Full Rollback (< 4 hours)

```bash
# 1. Take database snapshot
pg_dump corestack > backup.sql

# 2. Revert all RBAC changes
git checkout <pre-rbac-commit>

# 3. Drop new tables
npm run db:rollback-rbac

# 4. Restart all services
docker-compose down && docker-compose up -d
```

## Testing Strategy

### Unit Tests

```typescript
describe('Permission Checker', () => {
  it('should grant permission when user has role with permission', async () => {
    // Test permission granting
  });

  it('should deny permission when user lacks role', async () => {
    // Test permission denial
  });

  it('should use cached permission when available', async () => {
    // Test caching
  });

  it('should handle permission inheritance correctly', async () => {
    // Test inheritance
  });
});
```

### Integration Tests

```typescript
describe('RBAC Integration', () => {
  it('should enforce permissions in tRPC routers', async () => {
    // Test end-to-end permission enforcement
  });

  it('should correctly resolve cross-project permissions', async () => {
    // Test cross-project scenarios
  });

  it('should log audit entries for all access attempts', async () => {
    // Test audit logging
  });
});
```

### Performance Tests

```typescript
describe('RBAC Performance', () => {
  it('should check permission in < 10ms (cached)', async () => {
    const start = Date.now();
    await checkPermission(userId, 'project.read');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10);
  });

  it('should handle 1000 concurrent permission checks', async () => {
    // Load testing
  });
});
```

### Security Tests

- Permission escalation attempts
- Cross-project access boundary tests
- SQL injection in permission queries
- XSS in role/permission names
- CSRF protection in role assignments

## Success Metrics

### Quantitative Metrics

- ✅ Permission check latency < 10ms (cached), < 50ms (uncached)
- ✅ Support 10,000+ users without performance degradation
- ✅ 100% of API endpoints protected by permissions
- ✅ Test coverage > 80%
- ✅ Zero permission escalation vulnerabilities
- ✅ Migration completes with zero data loss

### Qualitative Metrics

- ✅ Administrators can create/manage roles without code changes
- ✅ Clear audit trail for all permission changes
- ✅ Intuitive admin UI for RBAC management
- ✅ Documentation is clear and comprehensive
- ✅ Team comfortable with new system

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Attribute-Based Access Control (ABAC)**
   - Dynamic permissions based on attributes
   - Context-aware access control
   - Time-based permissions

2. **Permission Templates**
   - Predefined role templates
   - Quick role creation
   - Industry-standard templates

3. **Delegation & Impersonation**
   - Temporary permission delegation
   - Admin impersonation for support
   - Audit trail for delegated actions

4. **Advanced Audit Analytics**
   - Permission usage statistics
   - Anomaly detection
   - Compliance reporting

5. **Multi-Tenancy**
   - Tenant-isolated permissions
   - Cross-tenant roles
   - Tenant admin roles

6. **API Key Permissions**
   - Scoped API keys
   - Key-based permissions
   - Key rotation

## Implementation Timeline

| Phase | Description | Duration | Start | End | Dependencies |
|-------|-------------|----------|-------|-----|--------------|
| Phase 1 | Database Schema | 1 week | Week 1 | Week 1 | None |
| Phase 2 | Core RBAC Service | 1-2 weeks | Week 1 | Week 2 | Phase 1 |
| Phase 3 | tRPC Integration | 1 week | Week 2 | Week 2 | Phase 2 |
| Phase 4 | API Routers | 1 week | Week 3 | Week 3 | Phase 3 |
| Phase 5 | External Accounts | 1 week | Week 3 | Week 4 | Phase 2 |
| Phase 6 | UI Components | 2 weeks | Week 4 | Week 5 | Phase 4 |
| Phase 7 | Migration | 1 week | Week 5 | Week 5 | Phase 2-4 |
| Phase 8 | Testing & Docs | 1 week | Week 6 | Week 6 | All |

**Total Timeline**: 6 weeks (120-160 hours)

**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 6

**Parallel Work**:
- Phase 4 and Phase 5 can run in parallel
- Phase 6 can start while Phase 7 is ongoing
- Testing (Phase 8) can start incrementally during earlier phases

## Resource Requirements

### Development Team

- **1 Senior Backend Engineer** (Full-time, 6 weeks)
  - Schema design & migration
  - Core RBAC service
  - API integration

- **1 Mid-Level Full-Stack Engineer** (Full-time, 4 weeks)
  - UI components
  - Testing
  - Documentation

- **1 DevOps Engineer** (Part-time, 2 weeks)
  - Database migration
  - Deployment
  - Monitoring setup

### Infrastructure

- **Database**: PostgreSQL 16+ with additional storage for audit logs
- **Cache**: Redis for permission caching (optional but recommended)
- **Monitoring**: Enhanced logging for RBAC events

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance degradation | Low | High | Comprehensive caching, query optimization, load testing |
| Migration data loss | Low | Critical | Backup strategy, staged migration, validation checks |
| Permission escalation bugs | Medium | Critical | Security testing, code review, audit logging |
| Complexity overwhelms users | Medium | Medium | Intuitive UI, good documentation, training |
| Delayed timeline | Medium | Medium | Phased approach, MVP focus, buffer time |
| Third-party integration issues (NIS) | Medium | Medium | Thorough testing, fallback mechanisms |

## Decision Points

### Key Decisions Required Before Implementation

1. **Caching Strategy**: Redis vs in-memory vs database-only?
   - **Recommendation**: Redis for distributed caching

2. **Permission Granularity**: How fine-grained should permissions be?
   - **Recommendation**: Start with resource.action, add scopes as needed

3. **Role Hierarchy**: Should roles inherit from other roles?
   - **Recommendation**: Phase 2 feature, start without hierarchy

4. **Audit Log Retention**: How long to keep audit logs?
   - **Recommendation**: 90 days active, archive after 1 year

5. **External Credential Encryption**: Which encryption method?
   - **Recommendation**: AES-256-GCM with per-project keys

## API Examples

### Creating a Role

```typescript
// Client code
const newRole = await trpc.rbac.roles.create.mutate({
  name: 'data_analyst',
  displayName: 'Data Analyst',
  description: 'Can view and analyze project data',
  roleType: 'project',
  permissionIds: [1, 2, 5, 8], // project.read, task.read, post.read, report.create
});
```

### Assigning a Role to a User

```typescript
// Assign project role
await trpc.rbac.userRoles.assign.mutate({
  userId: 123,
  roleId: 5,
  projectId: 42,
  expiresAt: new Date('2025-12-31'), // Optional expiration
});

// Assign system role
await trpc.rbac.userRoles.assign.mutate({
  userId: 123,
  roleId: 1, // system_admin
});
```

### Checking Permissions

```typescript
// Server-side (automatic via middleware)
export const projectRouter = router({
  update: permissionProcedure('project.update')
    .input(z.object({ projectId: z.number(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Permission already checked by middleware
      return await updateProject(input.projectId, { name: input.name });
    }),
});

// Manual check (when needed)
import { checkPermission } from '@/lib/rbac';

const canDelete = await checkPermission(
  ctx.user.userId,
  'project.delete',
  projectId
);

if (!canDelete) {
  throw new TRPCError({ code: 'FORBIDDEN' });
}
```

### Querying User Permissions

```typescript
// Get all permissions for a user
const userPermissions = await trpc.rbac.userRoles.getUserRoles.query({
  userId: 123,
  projectId: 42,
});

// Returns:
{
  systemRoles: [{ id: 1, name: 'system_admin', ... }],
  projectRoles: [{ id: 5, name: 'project_owner', projectId: 42, ... }],
  groupRoles: [{ id: 8, name: 'frontend_team', groupId: 3, ... }],
  permissions: [
    'project.read', 'project.update', 'project.delete',
    'user.read', 'user.create', ...
  ]
}
```

## Conclusion

This RBAC design proposal provides a comprehensive, scalable, and secure access control system for CoreStack. The proposed architecture balances flexibility with simplicity, allowing dynamic role and permission management while maintaining performance and security.

### Key Benefits

1. **Flexibility**: Dynamic role creation without code changes
2. **Granularity**: Fine-grained permissions at resource and action levels
3. **Scalability**: Efficient caching and query optimization
4. **Security**: Defense in depth with audit logging
5. **Maintainability**: Clear separation of concerns, comprehensive testing
6. **User Experience**: Intuitive UI for administrators

### Next Steps

1. **Review & Approval**: Review this proposal with stakeholders
2. **Architecture Discussion**: Discuss any concerns or modifications
3. **Resource Allocation**: Assign development team and timeline
4. **Phase 1 Kickoff**: Begin database schema design and migration
5. **Regular Check-ins**: Weekly progress reviews during implementation

### Questions & Discussion Points

1. Should we implement role hierarchy in Phase 1 or defer to Phase 2?
2. What should be the default permissions for new users?
3. Should we support resource-level permissions (e.g., "user:123.update")?
4. How should we handle permission conflicts between different role sources?
5. What's the preferred external credential encryption strategy?

**Implementation Status**: 🔴 Not Started (0% complete)

---

*Document Version: 1.0*
*Last Updated: 2025-11-04*
*Status: Design/Planning Phase*
*Author: CoreStack Development Team*
