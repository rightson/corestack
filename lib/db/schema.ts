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
