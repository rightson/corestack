# Role-Based Access Control (RBAC)

**Status**: ✅ Implemented
**Version**: 1.0
**Last Updated**: 2025-11-14

## Overview

CoreStack implements a comprehensive Role-Based Access Control (RBAC) system that provides fine-grained access control for users across projects, groups, and system resources. The system supports Django-style permissions with full TypeScript type safety.

## Key Features

- ✅ **Flexible User Management**: Single user accounts with multiple project memberships
- ✅ **Dynamic Role Management**: Create and modify roles without code changes
- ✅ **Granular Permissions**: Fine-grained control over API endpoints and resources (CRUD)
- ✅ **Multi-Level Access Control**: Project-specific, cross-project, and global system roles
- ✅ **Audit Trail**: Complete logging of permission changes and access attempts
- ✅ **Performance Optimized**: Permission caching with 5-minute TTL
- ✅ **User Impersonation**: Super admin group can impersonate users for support
- ✅ **TypeScript Support**: Full type safety throughout the system

## Architecture

### Database Schema

The RBAC system uses 13 tables:

1. **groups** - User groups (project, cross-project, functional)
2. **group_members** - User-group memberships
3. **group_projects** - Project associations for cross-project groups
4. **roles** - Role definitions (system, project, cross-project)
5. **permissions** - Permission definitions (resource.action format)
6. **role_permissions** - Role-permission mappings
7. **user_system_roles** - System-level role assignments
8. **user_project_roles** - Project-level role assignments
9. **user_group_roles** - Group-level role assignments
10. **external_accounts** - External system accounts (NIS, LDAP)
11. **rbac_audit_log** - Complete audit trail
12. **permission_cache** - Performance cache
13. **impersonation_sessions** - Active impersonation sessions

### Permission Naming Convention

Format: `<resource>.<action>[.<scope>]`

Examples:
- `user.create` - Create users
- `user.read` - Read user data
- `project.update` - Update projects
- `rbac.role.create` - Create RBAC roles
- `ssh.execute` - Execute SSH commands

## Built-in Roles

### System Roles

| Role | Description | Use Case |
|------|-------------|----------|
| **system_admin** | Full system access | System administrators |
| **system_moderator** | User & content moderation | Community managers |
| **system_auditor** | Read-only access | Compliance officers |

### Project Roles

| Role | Description | Use Case |
|------|-------------|----------|
| **project_owner** | Full project control | Project creators |
| **project_admin** | Administrative access | Project managers |
| **project_member** | Regular member access | Team members |
| **project_viewer** | Read-only access | Stakeholders |

## Usage

### Setup

1. **Run Database Migration**:
```bash
npm run db:generate
npm run db:push
```

2. **Seed RBAC System**:
```bash
npm run db:seed-rbac
```

This creates:
- 40+ built-in permissions
- 7 built-in roles
- Super admin group

### Assigning Roles

```typescript
import { assignRole } from '@/lib/rbac';

// Assign system role
await assignRole({
  userId: 1,
  roleId: 1, // system_admin
});

// Assign project role
await assignRole({
  userId: 2,
  roleId: 4, // project_member
  projectId: 10,
});

// Assign role with expiration
await assignRole({
  userId: 3,
  roleId: 5,
  expiresAt: new Date('2025-12-31'),
});
```

### Checking Permissions

```typescript
import { checkPermission } from '@/lib/rbac';

// Check system permission
const canCreateUsers = await checkPermission({
  userId: 1,
  permission: 'user.create',
});

// Check project-scoped permission
const canUpdateProject = await checkPermission({
  userId: 2,
  permission: 'project.update',
  projectId: 10,
});
```

### Protecting Endpoints

```typescript
import { router, permissionProcedure } from '@/lib/trpc/trpc';

export const userRouter = router({
  // Requires 'user.create' permission
  create: permissionProcedure('user.create')
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Permission already checked
      return await createUser(input);
    }),

  // Requires 'user.delete' permission
  delete: permissionProcedure('user.delete')
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return await deleteUser(input.id);
    }),
});
```

### Advanced Permission Checks

```typescript
import {
  requireAnyPermission,
  requireAllPermissions,
  checkResourcePermission
} from '@/lib/rbac';

// Require ONE of multiple permissions
await requireAnyPermission(
  userId,
  ['user.update', 'user.admin']
);

// Require ALL permissions
await requireAllPermissions(
  userId,
  ['user.read', 'user.admin']
);

// Check with resource ownership
const canUpdate = await checkResourcePermission(
  userId,
  'post.update',
  post.authorId // Owner ID
);
```

## User Impersonation

Super admins can impersonate users for support and debugging.

### Setup Super Admin

```typescript
import { addUserToGroup } from '@/lib/rbac';

// Add user to super_admins group
const groups = await listGroups({});
const superAdminGroup = groups.find(g => g.name === 'super_admins');

await addUserToGroup(superAdminGroup.id, adminUserId);
```

### Start Impersonation

```typescript
// Start impersonation session
const session = await trpc.rbac.impersonation.start.mutate({
  targetUserId: 123,
  reason: 'Support ticket #456',
  durationMs: 3600000, // 1 hour
});

// Use session token in API calls
const client = createTRPCClient({
  headers: {
    'Authorization': `Bearer ${adminJWT}`,
    'X-Impersonation-Token': session.sessionToken,
  },
});

// All requests now made as user #123
const data = await client.user.getProfile.query();

// End impersonation
await trpc.rbac.impersonation.end.mutate({
  sessionToken: session.sessionToken,
});
```

### Impersonation Security

- ✅ Only super_admins group members can impersonate
- ✅ Cannot impersonate yourself
- ✅ Sessions expire automatically (default 1 hour)
- ✅ Complete audit trail with reason, IP, user agent
- ✅ All actions logged with admin and impersonated user IDs

## API Reference

### Roles

- `trpc.rbac.roles.list` - List all roles
- `trpc.rbac.roles.create` - Create new role
- `trpc.rbac.roles.update` - Update role
- `trpc.rbac.roles.delete` - Delete role (non-built-in only)
- `trpc.rbac.roles.assignPermissions` - Assign permissions to role
- `trpc.rbac.roles.removePermissions` - Remove permissions from role

### Permissions

- `trpc.rbac.permissions.list` - List all permissions
- `trpc.rbac.permissions.create` - Create new permission
- `trpc.rbac.permissions.update` - Update permission
- `trpc.rbac.permissions.delete` - Delete permission

### User Roles

- `trpc.rbac.userRoles.assign` - Assign role to user
- `trpc.rbac.userRoles.revoke` - Revoke role from user
- `trpc.rbac.userRoles.getUserPermissions` - Get all user permissions
- `trpc.rbac.userRoles.getMyPermissions` - Get current user's permissions

### Groups

- `trpc.rbac.groups.list` - List groups
- `trpc.rbac.groups.create` - Create group
- `trpc.rbac.groups.addMember` - Add user to group
- `trpc.rbac.groups.removeMember` - Remove user from group
- `trpc.rbac.groups.getMembers` - Get group members

### Impersonation

- `trpc.rbac.impersonation.start` - Start impersonation session
- `trpc.rbac.impersonation.end` - End impersonation session
- `trpc.rbac.impersonation.getStatus` - Get current impersonation status
- `trpc.rbac.impersonation.getHistory` - Get impersonation audit history

## Performance

### Caching

- Permission checks are cached for 5 minutes
- Cache key format: `user:{userId}:perm:{permission}:project:{projectId}`
- Automatic cache invalidation on role changes
- Use `useCache: false` to bypass cache

### Optimization Tips

1. **Batch Permission Checks**:
```typescript
const results = await checkMultiplePermissions(
  userId,
  ['user.read', 'user.update', 'user.delete']
);
```

2. **Use Permission Caching**:
```typescript
// Enable caching (default)
await checkPermission({ userId, permission, useCache: true });
```

3. **Minimize Role Changes**: Role changes invalidate cache

## Security

### Best Practices

1. **Principle of Least Privilege**: Grant minimum necessary permissions
2. **Regular Audits**: Review audit logs regularly
3. **Time-Limited Roles**: Use `expiresAt` for temporary access
4. **Impersonation Logging**: Always provide reason for impersonation
5. **Permission Granularity**: Use specific permissions, not wildcards

### Audit Logging

All RBAC operations are logged:
- Role assignments/revocations
- Permission grants/denials
- Impersonation sessions
- Access attempts

Query audit logs:
```typescript
const logs = await db
  .select()
  .from(rbacAuditLog)
  .where(eq(rbacAuditLog.userId, userId))
  .orderBy(desc(rbacAuditLog.createdAt))
  .limit(100);
```

## Migration from Legacy System

The old `project_members` table is preserved for backward compatibility.

### Migration Script

```typescript
// Migrate project members to RBAC
import { assignRole, getRoleByName } from '@/lib/rbac';

const roleMapping = {
  'owner': 'project_owner',
  'admin': 'project_admin',
  'member': 'project_member',
  'viewer': 'project_viewer',
};

for (const member of oldMembers) {
  const roleName = roleMapping[member.role];
  const role = await getRoleByName(roleName);

  await assignRole({
    userId: member.userId,
    roleId: role.id,
    projectId: member.projectId,
  });
}
```

## Troubleshooting

### Permission Denied Errors

1. **Check user's roles**:
```typescript
const perms = await getUserPermissions(userId, projectId);
console.log('Roles:', perms.systemRoles, perms.projectRoles);
console.log('Permissions:', perms.permissions);
```

2. **Verify permission exists**:
```typescript
const perm = await getPermissionByName('user.create');
console.log('Permission:', perm);
```

3. **Check role permissions**:
```typescript
const rolePerms = await getRolePermissions(roleId);
console.log('Role permissions:', rolePerms);
```

### Cache Issues

Clear user's permission cache:
```typescript
import { invalidateUserPermissionCache } from '@/lib/rbac';
await invalidateUserPermissionCache(userId, projectId);
```

### Impersonation Not Working

1. Verify user is in super_admins group
2. Check session hasn't expired
3. Ensure correct header: `X-Impersonation-Token`
4. Verify session token is valid

## Examples

See `lib/rbac/examples.ts` for comprehensive examples covering:
- Basic permission protection
- Multiple permission requirements
- Resource-specific permissions
- Project-scoped permissions
- Conditional permissions
- Impersonation-aware logic

## Future Enhancements

Planned features:
- Attribute-Based Access Control (ABAC)
- Permission templates
- Advanced audit analytics
- Multi-tenancy support
- API key permissions

## Related Documentation

- [Developer Guide](../development/rbac-development.md)
- [API Documentation](../architecture/api.md)
- [Database Schema](../architecture/database/schema.md)
- [Authentication](./authentication.md)
