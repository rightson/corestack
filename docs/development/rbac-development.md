# RBAC Development Guide

This guide explains how to use CoreStack's RBAC system when developing new features.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Protecting Endpoints](#protecting-endpoints)
3. [Creating Custom Permissions](#creating-custom-permissions)
4. [Creating Custom Roles](#creating-custom-roles)
5. [Permission Patterns](#permission-patterns)
6. [Best Practices](#best-practices)
7. [Common Scenarios](#common-scenarios)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Import RBAC Functions

```typescript
import { permissionProcedure, protectedProcedure } from '@/lib/trpc/trpc';
import { checkPermission, requireAnyPermission } from '@/lib/rbac';
```

### 2. Protect Your Endpoint

```typescript
export const myRouter = router({
  // Simple permission check
  create: permissionProcedure('myresource.create')
    .input(createSchema)
    .mutation(async ({ ctx, input }) => {
      // Permission automatically checked
      return await createResource(input);
    }),
});
```

### 3. Define Your Permission

Add to `scripts/seed-rbac.ts`:

```typescript
const BUILT_IN_PERMISSIONS = [
  // ...existing permissions
  {
    name: 'myresource.create',
    displayName: 'Create My Resource',
    description: 'Create new resources',
    resourceType: 'api' as const,
    resourceName: 'myresource',
    action: 'create' as const,
  },
];
```

## Protecting Endpoints

### Basic Protection

Use `permissionProcedure()` for automatic permission checking:

```typescript
export const userRouter = router({
  // Requires 'user.read' permission
  list: permissionProcedure('user.read')
    .query(async ({ ctx }) => {
      return await ctx.db.select().from(users);
    }),

  // Requires 'user.create' permission
  create: permissionProcedure('user.create')
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      return await createUser(input);
    }),
});
```

### Manual Permission Checks

For complex logic, use manual checks:

```typescript
export const advancedRouter = router({
  updateResource: protectedProcedure
    .input(z.object({
      id: z.number(),
      data: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the resource
      const resource = await getResource(input.id);

      // Check if user owns resource OR has admin permission
      const isOwner = resource.ownerId === ctx.user.userId;
      const hasAdminPerm = await checkPermission({
        userId: ctx.user.userId,
        permission: 'resource.admin',
      });

      if (!isOwner && !hasAdminPerm) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot update this resource',
        });
      }

      return await updateResource(input.id, input.data);
    }),
});
```

### Multiple Permission Requirements

#### OR Logic (Any Permission)

```typescript
import { requireAnyPermission } from '@/lib/rbac';

export const myRouter = router({
  action: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Requires user.update OR user.admin
      await requireAnyPermission(
        ctx.user.userId,
        ['user.update', 'user.admin']
      );

      // Proceed with action
    }),
});
```

#### AND Logic (All Permissions)

```typescript
import { requireAllPermissions } from '@/lib/rbac';

export const myRouter = router({
  sensitiveAction: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Requires BOTH user.read AND user.admin
      await requireAllPermissions(
        ctx.user.userId,
        ['user.read', 'user.admin']
      );

      // Proceed with action
    }),
});
```

### Project-Scoped Permissions

For project-specific operations:

```typescript
export const projectRouter = router({
  // Permission automatically scoped to projectId from input
  updateProject: permissionProcedure('project.update')
    .input(z.object({
      projectId: z.number(),
      name: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // User must have 'project.update' in THIS project
      return await updateProject(input.projectId, { name: input.name });
    }),

  // Manual project scope
  deleteProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const canDelete = await checkPermission({
        userId: ctx.user.userId,
        permission: 'project.delete',
        projectId: input.projectId, // Scope to this project
      });

      if (!canDelete) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return await deleteProject(input.projectId);
    }),
});
```

## Creating Custom Permissions

### 1. Define Permission

Add to `scripts/seed-rbac.ts`:

```typescript
const BUILT_IN_PERMISSIONS = [
  // ...existing permissions

  // Report Permissions
  {
    name: 'report.generate',
    displayName: 'Generate Report',
    description: 'Generate system reports',
    resourceType: 'api' as const,
    resourceName: 'report',
    action: 'execute' as const,
  },
  {
    name: 'report.read',
    displayName: 'View Reports',
    description: 'View generated reports',
    resourceType: 'api' as const,
    resourceName: 'report',
    action: 'read' as const,
  },
];
```

### 2. Run Seed Script

```bash
npm run db:seed-rbac
```

### 3. Use in Code

```typescript
export const reportRouter = router({
  generate: permissionProcedure('report.generate')
    .input(reportSchema)
    .mutation(async ({ ctx, input }) => {
      return await generateReport(input);
    }),

  list: permissionProcedure('report.read')
    .query(async ({ ctx }) => {
      return await listReports();
    }),
});
```

## Creating Custom Roles

### Via Seed Script

Add to `scripts/seed-rbac.ts`:

```typescript
const BUILT_IN_ROLES = [
  // ...existing roles

  {
    name: 'data_analyst',
    displayName: 'Data Analyst',
    description: 'Can view and generate reports',
    roleType: 'system' as const,
    permissions: [
      'report.read',
      'report.generate',
      'user.read', // Also needs to view users
    ],
  },
];
```

### Via API

```typescript
// Create role
const role = await trpc.rbac.roles.create.mutate({
  name: 'custom_role',
  displayName: 'Custom Role',
  description: 'My custom role',
  roleType: 'project',
});

// Assign permissions
await trpc.rbac.roles.assignPermissions.mutate({
  roleId: role.id,
  permissionIds: [1, 2, 5], // IDs of permissions
});

// Assign to user
await trpc.rbac.userRoles.assign.mutate({
  userId: 123,
  roleId: role.id,
  projectId: 10, // For project roles
});
```

## Permission Patterns

### Resource Ownership Pattern

```typescript
import { checkResourcePermission } from '@/lib/rbac';

export const postRouter = router({
  update: protectedProcedure
    .input(z.object({ postId: z.number(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get post
      const post = await getPost(input.postId);

      // Check if user can update THIS post
      const canUpdate = await checkResourcePermission(
        ctx.user.userId,
        'post.update',
        post.authorId, // Owner ID
        post.projectId // Optional project scope
      );

      if (!canUpdate) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot update this post',
        });
      }

      return await updatePost(input.postId, { content: input.content });
    }),
});
```

### Hierarchical Permissions Pattern

```typescript
// Create granular permissions
const permissions = [
  'user.read.own',    // Read own profile
  'user.read.team',   // Read team members
  'user.read.all',    // Read all users (admin)
  'user.update.own',  // Update own profile
  'user.update.all',  // Update any user (admin)
];

// Check with fallback
export async function canReadUser(
  currentUserId: number,
  targetUserId: number
): Promise<boolean> {
  // Can always read own profile
  if (currentUserId === targetUserId) {
    return true;
  }

  // Check for broader permissions
  const hasReadAll = await checkPermission({
    userId: currentUserId,
    permission: 'user.read.all',
  });

  if (hasReadAll) {
    return true;
  }

  // Check team permission (would need team lookup)
  const hasReadTeam = await checkPermission({
    userId: currentUserId,
    permission: 'user.read.team',
  });

  if (hasReadTeam) {
    return await areInSameTeam(currentUserId, targetUserId);
  }

  return false;
}
```

### Dynamic Permission Pattern

```typescript
export const dynamicRouter = router({
  performAction: protectedProcedure
    .input(z.object({
      resource: z.enum(['user', 'project', 'post']),
      action: z.enum(['create', 'read', 'update', 'delete']),
      resourceId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Build permission string dynamically
      const permission = `${input.resource}.${input.action}`;

      const hasPermission = await checkPermission({
        userId: ctx.user.userId,
        permission,
      });

      if (!hasPermission) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Missing permission: ${permission}`,
        });
      }

      // Perform action
      return await performAction(input);
    }),
});
```

## Best Practices

### 1. Use Specific Permissions

❌ **Bad**: Using overly broad permissions
```typescript
// Too broad
permission: 'admin'  // What kind of admin?
```

✅ **Good**: Using specific, granular permissions
```typescript
// Specific and clear
permission: 'user.delete'
permission: 'project.update'
permission: 'rbac.role.create'
```

### 2. Follow Naming Convention

Format: `<resource>.<action>[.<scope>]`

✅ **Good**:
```typescript
'user.create'         // Create users
'user.read'           // Read user data
'user.update.own'     // Update own profile
'user.update.all'     // Update any user
'project.delete'      // Delete projects
'report.generate'     // Generate reports
```

### 3. Handle Permission Denials Gracefully

```typescript
export const safeRouter = router({
  getResource: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const resource = await getResource(input.id);

      const canView = await checkPermission({
        userId: ctx.user.userId,
        permission: 'resource.read',
      });

      if (!canView) {
        // Return limited info instead of throwing
        return {
          id: resource.id,
          name: resource.name,
          // Omit sensitive fields
        };
      }

      // Return full resource
      return resource;
    }),
});
```

### 4. Cache Appropriately

```typescript
// Use cache for frequently checked permissions
const hasPermission = await checkPermission({
  userId,
  permission: 'user.read',
  useCache: true, // Default, uses 5-min cache
});

// Bypass cache for critical operations
const canDelete = await checkPermission({
  userId,
  permission: 'user.delete',
  useCache: false, // Always fresh check
});
```

### 5. Document Required Permissions

```typescript
/**
 * Update user profile
 *
 * @requires user.update.own - To update own profile
 * @requires user.update.all - To update any user (admin)
 */
export const updateUser = permissionProcedure('user.update')
  .input(updateUserSchema)
  .mutation(async ({ ctx, input }) => {
    // ...
  });
```

## Common Scenarios

### Scenario 1: Creating a New Feature

1. **Define permissions** in `seed-rbac.ts`
2. **Run seed script**: `npm run db:seed-rbac`
3. **Protect endpoints** with `permissionProcedure()`
4. **Assign to roles** in seed script or via API
5. **Test** with different roles

Example:
```typescript
// 1. Add to seed-rbac.ts
{
  name: 'analytics.view',
  displayName: 'View Analytics',
  resourceType: 'api',
  resourceName: 'analytics',
  action: 'read',
}

// 2. Add to role
{
  name: 'analyst',
  displayName: 'Analyst',
  roleType: 'system',
  permissions: ['analytics.view', 'report.generate'],
}

// 3. Protect endpoint
export const analyticsRouter = router({
  getDashboard: permissionProcedure('analytics.view')
    .query(async ({ ctx }) => {
      return await getAnalytics();
    }),
});
```

### Scenario 2: Adding Admin Actions

```typescript
// Create admin-specific permissions
const adminPermissions = [
  'system.config.update',
  'system.users.impersonate',
  'system.logs.view',
];

// Add to system_admin role
await assignPermissionsToRole(systemAdminRole.id, adminPermissionIds);

// Protect admin endpoints
export const adminRouter = router({
  updateConfig: permissionProcedure('system.config.update')
    .input(configSchema)
    .mutation(async ({ ctx, input }) => {
      return await updateConfig(input);
    }),
});
```

### Scenario 3: Team-Based Access

```typescript
// Create team group
const team = await createGroup({
  name: 'frontend-team',
  groupType: 'functional',
});

// Add members
await addUserToGroup(team.id, user1Id);
await addUserToGroup(team.id, user2Id);

// Create team role
const teamRole = await createRole({
  name: 'frontend-developer',
  displayName: 'Frontend Developer',
  roleType: 'system',
});

// Assign permissions to role
await assignPermissionsToRole(teamRole.id, [
  frontendPermissions,
]);

// Assign role to team
await assignRole({
  userId: user1Id,
  groupId: team.id,
  roleId: teamRole.id,
});
```

### Scenario 4: Temporary Access

```typescript
// Grant temporary access (expires in 7 days)
await assignRole({
  userId: contractorId,
  roleId: contractorRoleId,
  projectId: projectId,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  grantedBy: adminUserId,
});
```

## Testing

### Unit Tests

```typescript
import { checkPermission, assignRole } from '@/lib/rbac';

describe('My Feature', () => {
  it('should deny access without permission', async () => {
    const hasPermission = await checkPermission({
      userId: testUserId,
      permission: 'myfeature.access',
      useCache: false,
    });

    expect(hasPermission).toBe(false);
  });

  it('should grant access with permission', async () => {
    await assignRole({
      userId: testUserId,
      roleId: myFeatureRoleId,
    });

    const hasPermission = await checkPermission({
      userId: testUserId,
      permission: 'myfeature.access',
      useCache: false,
    });

    expect(hasPermission).toBe(true);
  });
});
```

### Integration Tests

```typescript
import { trpc } from '@/lib/trpc/client';

describe('Feature API', () => {
  it('should require permission', async () => {
    // Try without permission
    await expect(
      trpc.myFeature.create.mutate({})
    ).rejects.toThrow('Insufficient permissions');

    // Assign permission
    await assignRole({ userId, roleId });

    // Should succeed now
    const result = await trpc.myFeature.create.mutate({});
    expect(result).toBeDefined();
  });
});
```

## Troubleshooting

### Permission Denied Unexpectedly

1. **Check user's roles**:
```typescript
const perms = await getUserPermissions(userId);
console.log('User permissions:', perms.permissions);
```

2. **Verify permission exists**:
```typescript
const perm = await getPermissionByName('myfeature.create');
console.log('Permission:', perm);
```

3. **Check role assignments**:
```typescript
const userPerms = await getUserPermissions(userId, projectId);
console.log('System roles:', userPerms.systemRoles);
console.log('Project roles:', userPerms.projectRoles);
```

4. **Clear cache**:
```typescript
await invalidateUserPermissionCache(userId, projectId);
```

### Permission Works in One Project But Not Another

- Verify you're using project-scoped roles
- Check `projectId` is being passed correctly
- Confirm role is assigned to the specific project

### Impersonation Not Reflecting

1. Check `X-Impersonation-Token` header is set
2. Verify session is active
3. Check session hasn't expired
4. Ensure admin is in super_admins group

## Additional Resources

- [RBAC Feature Documentation](../features/rbac.md)
- [API Reference](../architecture/api.md)
- [Examples](../../lib/rbac/examples.ts)
- [Tests](__tests__/rbac/)

## Quick Reference

### Common Imports

```typescript
// tRPC procedures
import { protectedProcedure, permissionProcedure } from '@/lib/trpc/trpc';

// Permission checking
import {
  checkPermission,
  checkMultiplePermissions,
  requireAnyPermission,
  requireAllPermissions,
} from '@/lib/rbac';

// Role management
import {
  createRole,
  assignRole,
  revokeRole,
  getUserPermissions,
} from '@/lib/rbac';

// Group management
import {
  createGroup,
  addUserToGroup,
  removeUserFromGroup,
} from '@/lib/rbac';
```

### Permission Naming Cheat Sheet

| Resource | Create | Read | Update | Delete | Execute |
|----------|--------|------|--------|--------|---------|
| User | user.create | user.read | user.update | user.delete | - |
| Project | project.create | project.read | project.update | project.delete | - |
| Post | post.create | post.read | post.update | post.delete | - |
| Report | - | report.read | - | - | report.generate |
| SSH | ssh.create | ssh.read | ssh.update | ssh.delete | ssh.execute |
| RBAC | rbac.*.create | rbac.*.read | rbac.*.update | rbac.*.delete | - |

Replace `*` with: `role`, `permission`, `group`, `user-role`
