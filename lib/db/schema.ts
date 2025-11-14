import { pgTable, serial, text, timestamp, varchar, jsonb, integer, boolean, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }), // hashed password for email auth
  authType: varchar('auth_type', { length: 50 }).notNull().default('email'), // 'email' or 'ldap'
  mustChangePassword: boolean('must_change_password').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLogin: timestamp('last_login'),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  authorId: integer('author_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  data: jsonb('data'),
  result: jsonb('result'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  projectVersion: varchar('project_version', { length: 100 }).notNull(),
  projectCode: varchar('project_code', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }), // optional
  description: text('description'),
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'), // 'active', 'archived', 'completed'
  visibility: varchar('visibility', { length: 50 }).notNull().default('private'), // 'private', 'public'
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastAccessedAt: timestamp('last_accessed_at'),
});

export const projectMembers = pgTable('project_members', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('member'), // 'owner', 'admin', 'member', 'viewer'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const permissionRequests = pgTable('permission_requests', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'approved', 'rejected'
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: integer('resolved_by').references(() => users.id),
});

// SSH Accounts
export const sshAccounts = pgTable('ssh_accounts', {
  id: serial('id').primaryKey(),
  accountName: varchar('account_name', { length: 255 }).notNull().unique(),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').notNull().default(22),
  username: varchar('username', { length: 255 }).notNull(),

  encryptedPassword: text('encrypted_password'),
  encryptedPrivateKey: text('encrypted_private_key'),
  encryptedPassphrase: text('encrypted_passphrase'),

  authMethod: varchar('auth_method', { length: 50 }).notNull(),
  basePath: varchar('base_path', { length: 500 }),
  timeout: integer('timeout').default(30000),

  description: text('description'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

// Project SSH Configurations
export const projectSshConfigs = pgTable('project_ssh_configs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  sshAccountId: integer('ssh_account_id').references(() => sshAccounts.id, { onDelete: 'cascade' }).notNull(),
  configAlias: varchar('config_alias', { length: 100 }).notNull(),
  overrideBasePath: varchar('override_base_path', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
}, (table) => ({
  uniqueProjectAlias: unique().on(table.projectId, table.configAlias),
}));

// SSH Operation Logs
export const sshOperationLogs = pgTable('ssh_operation_logs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  sshAccountId: integer('ssh_account_id').references(() => sshAccounts.id),
  operation: varchar('operation', { length: 100 }).notNull(),
  parameters: jsonb('parameters'),
  success: boolean('success').notNull(),
  stdout: text('stdout'),
  stderr: text('stderr'),
  errorMessage: text('error_message'),
  executionTime: integer('execution_time'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// SSH Error Notifications
export const sshErrorNotifications = pgTable('ssh_error_notifications', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  sshAccountId: integer('ssh_account_id').references(() => sshAccounts.id, { onDelete: 'cascade' }),
  notifyOnError: boolean('notify_on_error').default(true).notNull(),
  emailAddresses: text('email_addresses').notNull(),
  customHandler: varchar('custom_handler', { length: 255 }),
  customHandlerConfig: jsonb('custom_handler_config'),
  maxRetries: integer('max_retries').default(3).notNull(),
  retryDelay: integer('retry_delay').default(1000).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueProjectAccount: unique().on(table.projectId, table.sshAccountId),
}));

// ===== RBAC Tables =====

// Groups table
export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  groupType: varchar('group_type', { length: 50 }).notNull(), // 'project' | 'cross-project' | 'functional'
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Group members junction table
export const groupMembers = pgTable('group_members', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  uniqueGroupUser: unique().on(table.groupId, table.userId),
}));

// Group projects junction table (for cross-project groups)
export const groupProjects = pgTable('group_projects', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => ({
  uniqueGroupProject: unique().on(table.groupId, table.projectId),
}));

// Roles table
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  roleType: varchar('role_type', { length: 50 }).notNull(), // 'system' | 'project' | 'cross-project'
  isActive: boolean('is_active').default(true).notNull(),
  isBuiltIn: boolean('is_built_in').default(false).notNull(), // true for system-defined roles
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Permissions table
export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  resourceType: varchar('resource_type', { length: 50 }).notNull(), // 'api' | 'ui' | 'data'
  resourceName: varchar('resource_name', { length: 255 }).notNull(), // e.g., 'user', 'project'
  action: varchar('action', { length: 50 }).notNull(), // 'create' | 'read' | 'update' | 'delete' | 'execute'
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueResourceAction: unique().on(table.resourceType, table.resourceName, table.action),
}));

// Role permissions junction table
export const rolePermissions = pgTable('role_permissions', {
  id: serial('id').primaryKey(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: integer('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  grantedBy: integer('granted_by').references(() => users.id),
}, (table) => ({
  uniqueRolePermission: unique().on(table.roleId, table.permissionId),
}));

// User system roles
export const userSystemRoles = pgTable('user_system_roles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  grantedBy: integer('granted_by').references(() => users.id),
  expiresAt: timestamp('expires_at'), // optional expiration
}, (table) => ({
  uniqueUserRole: unique().on(table.userId, table.roleId),
}));

// User project roles (enhanced version of project_members)
export const userProjectRoles = pgTable('user_project_roles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  grantedBy: integer('granted_by').references(() => users.id),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  uniqueUserProjectRole: unique().on(table.userId, table.projectId, table.roleId),
}));

// User group roles
export const userGroupRoles = pgTable('user_group_roles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  grantedBy: integer('granted_by').references(() => users.id),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  uniqueUserGroupRole: unique().on(table.userId, table.groupId, table.roleId),
}));

// External accounts (for NIS integration)
export const externalAccounts = pgTable('external_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }), // null for system-wide accounts
  accountType: varchar('account_type', { length: 50 }).notNull(), // 'nis' | 'ldap' | 'ad' | 'other'
  username: varchar('username', { length: 255 }).notNull(),
  credentials: text('credentials'), // encrypted
  metadata: jsonb('metadata'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueAccountTypeProjectUser: unique().on(table.accountType, table.projectId, table.username),
}));

// Audit log for access control
export const rbacAuditLog = pgTable('rbac_audit_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(), // 'grant_role' | 'revoke_role' | 'access_granted' | 'access_denied'
  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: integer('resource_id'),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'set null' }),
  permissionId: integer('permission_id').references(() => permissions.id, { onDelete: 'set null' }),
  result: varchar('result', { length: 50 }), // 'success' | 'denied' | 'error'
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Permission cache (for performance)
export const permissionCache = pgTable('permission_cache', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }), // null for system permissions
  permissionId: integer('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  hasPermission: boolean('has_permission').notNull(),
  cacheKey: varchar('cache_key', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Impersonation sessions (for admin user switching)
export const impersonationSessions = pgTable('impersonation_sessions', {
  id: serial('id').primaryKey(),
  adminUserId: integer('admin_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(), // The admin who is impersonating
  impersonatedUserId: integer('impersonated_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(), // The user being impersonated
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(), // Unique token for this impersonation session
  reason: text('reason'), // Optional reason for impersonation (audit purposes)
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // Impersonation session expiry
  endedAt: timestamp('ended_at'), // When the impersonation session ended
});
