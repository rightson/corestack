/**
 * RBAC Seed Script
 *
 * Seeds the database with built-in roles and permissions.
 * Run this script after database migration to set up the RBAC system.
 */

import {
  createRole,
  createPermission,
  assignPermissionsToRole,
  getRoleByName,
  getPermissionByName,
  createGroup,
  getGroupById,
  SUPER_ADMIN_GROUP_NAME,
} from '@/lib/rbac';
import { createLogger } from '@/lib/observability/logger';
import { db } from '@/lib/db';
import { groups } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const logger = createLogger({ service: 'rbac-seed' });

// ===== Built-in Permissions =====

const BUILT_IN_PERMISSIONS = [
  // User Permissions
  { name: 'user.create', displayName: 'Create User', description: 'Create new users', resourceType: 'api' as const, resourceName: 'user', action: 'create' as const },
  { name: 'user.read', displayName: 'Read User', description: 'View user information', resourceType: 'api' as const, resourceName: 'user', action: 'read' as const },
  { name: 'user.update', displayName: 'Update User', description: 'Update user information', resourceType: 'api' as const, resourceName: 'user', action: 'update' as const },
  { name: 'user.delete', displayName: 'Delete User', description: 'Delete users', resourceType: 'api' as const, resourceName: 'user', action: 'delete' as const },

  // Project Permissions
  { name: 'project.create', displayName: 'Create Project', description: 'Create new projects', resourceType: 'api' as const, resourceName: 'project', action: 'create' as const },
  { name: 'project.read', displayName: 'Read Project', description: 'View project information', resourceType: 'api' as const, resourceName: 'project', action: 'read' as const },
  { name: 'project.update', displayName: 'Update Project', description: 'Update project information', resourceType: 'api' as const, resourceName: 'project', action: 'update' as const },
  { name: 'project.delete', displayName: 'Delete Project', description: 'Delete projects', resourceType: 'api' as const, resourceName: 'project', action: 'delete' as const },

  // Post Permissions
  { name: 'post.create', displayName: 'Create Post', description: 'Create new posts', resourceType: 'api' as const, resourceName: 'post', action: 'create' as const },
  { name: 'post.read', displayName: 'Read Post', description: 'View posts', resourceType: 'api' as const, resourceName: 'post', action: 'read' as const },
  { name: 'post.update', displayName: 'Update Post', description: 'Update posts', resourceType: 'api' as const, resourceName: 'post', action: 'update' as const },
  { name: 'post.delete', displayName: 'Delete Post', description: 'Delete posts', resourceType: 'api' as const, resourceName: 'post', action: 'delete' as const },

  // Task Permissions
  { name: 'task.create', displayName: 'Create Task', description: 'Create new tasks', resourceType: 'api' as const, resourceName: 'task', action: 'create' as const },
  { name: 'task.read', displayName: 'Read Task', description: 'View tasks', resourceType: 'api' as const, resourceName: 'task', action: 'read' as const },
  { name: 'task.update', displayName: 'Update Task', description: 'Update tasks', resourceType: 'api' as const, resourceName: 'task', action: 'update' as const },
  { name: 'task.delete', displayName: 'Delete Task', description: 'Delete tasks', resourceType: 'api' as const, resourceName: 'task', action: 'delete' as const },

  // RBAC Permissions
  { name: 'rbac.role.create', displayName: 'Create Role', description: 'Create new roles', resourceType: 'api' as const, resourceName: 'role', action: 'create' as const },
  { name: 'rbac.role.read', displayName: 'Read Role', description: 'View roles', resourceType: 'api' as const, resourceName: 'role', action: 'read' as const },
  { name: 'rbac.role.update', displayName: 'Update Role', description: 'Update roles', resourceType: 'api' as const, resourceName: 'role', action: 'update' as const },
  { name: 'rbac.role.delete', displayName: 'Delete Role', description: 'Delete roles', resourceType: 'api' as const, resourceName: 'role', action: 'delete' as const },

  { name: 'rbac.permission.create', displayName: 'Create Permission', description: 'Create new permissions', resourceType: 'api' as const, resourceName: 'permission', action: 'create' as const },
  { name: 'rbac.permission.read', displayName: 'Read Permission', description: 'View permissions', resourceType: 'api' as const, resourceName: 'permission', action: 'read' as const },
  { name: 'rbac.permission.update', displayName: 'Update Permission', description: 'Update permissions', resourceType: 'api' as const, resourceName: 'permission', action: 'update' as const },
  { name: 'rbac.permission.delete', displayName: 'Delete Permission', description: 'Delete permissions', resourceType: 'api' as const, resourceName: 'permission', action: 'delete' as const },

  { name: 'rbac.user-role.assign', displayName: 'Assign User Role', description: 'Assign roles to users', resourceType: 'api' as const, resourceName: 'user-role', action: 'create' as const },
  { name: 'rbac.user-role.revoke', displayName: 'Revoke User Role', description: 'Revoke roles from users', resourceType: 'api' as const, resourceName: 'user-role', action: 'delete' as const },
  { name: 'rbac.user-role.read', displayName: 'Read User Role', description: 'View user roles', resourceType: 'api' as const, resourceName: 'user-role', action: 'read' as const },

  { name: 'rbac.group.create', displayName: 'Create Group', description: 'Create new groups', resourceType: 'api' as const, resourceName: 'group', action: 'create' as const },
  { name: 'rbac.group.read', displayName: 'Read Group', description: 'View groups', resourceType: 'api' as const, resourceName: 'group', action: 'read' as const },
  { name: 'rbac.group.update', displayName: 'Update Group', description: 'Update groups', resourceType: 'api' as const, resourceName: 'group', action: 'update' as const },
  { name: 'rbac.group.delete', displayName: 'Delete Group', description: 'Delete groups', resourceType: 'api' as const, resourceName: 'group', action: 'delete' as const },

  { name: 'rbac.audit.read', displayName: 'Read Audit Log', description: 'View audit logs', resourceType: 'api' as const, resourceName: 'audit', action: 'read' as const },

  // SSH Permissions
  { name: 'ssh.create', displayName: 'Create SSH Account', description: 'Create SSH accounts', resourceType: 'api' as const, resourceName: 'ssh', action: 'create' as const },
  { name: 'ssh.read', displayName: 'Read SSH Account', description: 'View SSH accounts', resourceType: 'api' as const, resourceName: 'ssh', action: 'read' as const },
  { name: 'ssh.update', displayName: 'Update SSH Account', description: 'Update SSH accounts', resourceType: 'api' as const, resourceName: 'ssh', action: 'update' as const },
  { name: 'ssh.delete', displayName: 'Delete SSH Account', description: 'Delete SSH accounts', resourceType: 'api' as const, resourceName: 'ssh', action: 'delete' as const },
  { name: 'ssh.execute', displayName: 'Execute SSH Commands', description: 'Execute commands via SSH', resourceType: 'api' as const, resourceName: 'ssh', action: 'execute' as const },
];

// ===== Built-in Roles =====

const BUILT_IN_ROLES = [
  // System Roles
  {
    name: 'system_admin',
    displayName: 'System Administrator',
    description: 'Full system access with all permissions',
    roleType: 'system' as const,
    permissions: [
      // All permissions
      'user.create', 'user.read', 'user.update', 'user.delete',
      'project.create', 'project.read', 'project.update', 'project.delete',
      'post.create', 'post.read', 'post.update', 'post.delete',
      'task.create', 'task.read', 'task.update', 'task.delete',
      'rbac.role.create', 'rbac.role.read', 'rbac.role.update', 'rbac.role.delete',
      'rbac.permission.create', 'rbac.permission.read', 'rbac.permission.update', 'rbac.permission.delete',
      'rbac.user-role.assign', 'rbac.user-role.revoke', 'rbac.user-role.read',
      'rbac.group.create', 'rbac.group.read', 'rbac.group.update', 'rbac.group.delete',
      'rbac.audit.read',
      'ssh.create', 'ssh.read', 'ssh.update', 'ssh.delete', 'ssh.execute',
    ],
  },
  {
    name: 'system_moderator',
    displayName: 'System Moderator',
    description: 'User and content moderation',
    roleType: 'system' as const,
    permissions: [
      'user.read', 'user.update',
      'project.read',
      'post.read', 'post.update', 'post.delete',
      'rbac.group.create', 'rbac.group.read', 'rbac.group.update',
      'rbac.audit.read',
    ],
  },
  {
    name: 'system_auditor',
    displayName: 'System Auditor',
    description: 'Read-only access for compliance',
    roleType: 'system' as const,
    permissions: [
      'user.read',
      'project.read',
      'post.read',
      'task.read',
      'rbac.role.read',
      'rbac.permission.read',
      'rbac.user-role.read',
      'rbac.group.read',
      'rbac.audit.read',
      'ssh.read',
    ],
  },

  // Project Roles
  {
    name: 'project_owner',
    displayName: 'Project Owner',
    description: 'Full project control',
    roleType: 'project' as const,
    permissions: [
      'project.read', 'project.update', 'project.delete',
      'post.create', 'post.read', 'post.update', 'post.delete',
      'task.create', 'task.read', 'task.update', 'task.delete',
      'rbac.user-role.assign', 'rbac.user-role.revoke', 'rbac.user-role.read',
      'ssh.create', 'ssh.read', 'ssh.update', 'ssh.delete', 'ssh.execute',
    ],
  },
  {
    name: 'project_admin',
    displayName: 'Project Admin',
    description: 'Administrative project access',
    roleType: 'project' as const,
    permissions: [
      'project.read', 'project.update',
      'post.create', 'post.read', 'post.update', 'post.delete',
      'task.create', 'task.read', 'task.update', 'task.delete',
      'rbac.user-role.read',
      'ssh.read', 'ssh.execute',
    ],
  },
  {
    name: 'project_member',
    displayName: 'Project Member',
    description: 'Regular project member',
    roleType: 'project' as const,
    permissions: [
      'project.read',
      'post.create', 'post.read', 'post.update',
      'task.create', 'task.read', 'task.update',
      'ssh.read', 'ssh.execute',
    ],
  },
  {
    name: 'project_viewer',
    displayName: 'Project Viewer',
    description: 'Read-only project access',
    roleType: 'project' as const,
    permissions: [
      'project.read',
      'post.read',
      'task.read',
    ],
  },
];

// ===== Seed Function =====

async function seedRBAC() {
  console.log('🌱 Starting RBAC seed...\n');

  try {
    // 1. Create permissions
    console.log('Creating permissions...');
    const createdPermissions: Record<string, number> = {};

    for (const perm of BUILT_IN_PERMISSIONS) {
      try {
        // Check if permission already exists
        const existing = await getPermissionByName(perm.name);
        if (existing) {
          console.log(`  ✓ Permission "${perm.name}" already exists`);
          createdPermissions[perm.name] = existing.id;
          continue;
        }

        const created = await createPermission(perm);
        createdPermissions[perm.name] = created.id;
        console.log(`  ✓ Created permission: ${perm.name}`);
      } catch (error: any) {
        console.error(`  ✗ Failed to create permission ${perm.name}:`, error.message);
      }
    }

    console.log(`\n✓ Created ${Object.keys(createdPermissions).length} permissions\n`);

    // 2. Create roles
    console.log('Creating roles...');
    const createdRoles: Record<string, number> = {};

    for (const role of BUILT_IN_ROLES) {
      try {
        // Check if role already exists
        const existing = await getRoleByName(role.name);
        if (existing) {
          console.log(`  ✓ Role "${role.name}" already exists`);
          createdRoles[role.name] = existing.id;
          continue;
        }

        const created = await createRole({
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          roleType: role.roleType,
          isBuiltIn: true,
        });

        createdRoles[role.name] = created.id;
        console.log(`  ✓ Created role: ${role.name}`);
      } catch (error: any) {
        console.error(`  ✗ Failed to create role ${role.name}:`, error.message);
      }
    }

    console.log(`\n✓ Created ${Object.keys(createdRoles).length} roles\n`);

    // 3. Assign permissions to roles
    console.log('Assigning permissions to roles...');

    for (const role of BUILT_IN_ROLES) {
      try {
        const roleId = createdRoles[role.name];
        if (!roleId) continue;

        const permissionIds = role.permissions
          .map(permName => createdPermissions[permName])
          .filter(id => id !== undefined);

        if (permissionIds.length === 0) {
          console.log(`  ⚠ No permissions to assign to role: ${role.name}`);
          continue;
        }

        await assignPermissionsToRole(roleId, permissionIds);
        console.log(`  ✓ Assigned ${permissionIds.length} permissions to role: ${role.name}`);
      } catch (error: any) {
        console.error(`  ✗ Failed to assign permissions to role ${role.name}:`, error.message);
      }
    }

    // 4. Create super admin group
    console.log('\nCreating super admin group...');

    try {
      // Check if super admin group already exists
      const [existingGroup] = await db
        .select()
        .from(groups)
        .where(eq(groups.name, SUPER_ADMIN_GROUP_NAME))
        .limit(1);

      if (existingGroup) {
        console.log(`  ✓ Super admin group "${SUPER_ADMIN_GROUP_NAME}" already exists`);
      } else {
        const superAdminGroup = await createGroup({
          name: SUPER_ADMIN_GROUP_NAME,
          description: 'Special group for super administrators with impersonation capabilities',
          groupType: 'functional',
          metadata: {
            isSpecial: true,
            capabilities: ['impersonation', 'full-access'],
          },
        });

        console.log(`  ✓ Created super admin group: ${SUPER_ADMIN_GROUP_NAME} (ID: ${superAdminGroup.id})`);
      }
    } catch (error: any) {
      console.error(`  ✗ Failed to create super admin group:`, error.message);
    }

    console.log('\n✅ RBAC seed completed successfully!\n');
    console.log('Summary:');
    console.log(`  - ${Object.keys(createdPermissions).length} permissions`);
    console.log(`  - ${Object.keys(createdRoles).length} roles`);
    console.log(`  - 1 special group (${SUPER_ADMIN_GROUP_NAME})`);
    console.log('\nNext steps:');
    console.log('  1. Assign system_admin role to your admin user');
    console.log('  2. Add admin users to the super_admins group for impersonation capability');
    console.log('  3. Assign project roles to project members');
    console.log('  4. Create custom roles and permissions as needed\n');

  } catch (error) {
    console.error('❌ RBAC seed failed:', error);
    process.exit(1);
  }
}

// Run seed
seedRBAC().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
