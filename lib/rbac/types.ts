/**
 * RBAC Type Definitions
 *
 * This file contains all TypeScript types and interfaces for the RBAC system.
 */

export type RoleType = 'system' | 'project' | 'cross-project';
export type ResourceType = 'api' | 'ui' | 'data';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute';
export type AuditAction = 'grant_role' | 'revoke_role' | 'access_granted' | 'access_denied' | 'permission_created' | 'permission_updated' | 'role_created' | 'role_updated';
export type AuditResult = 'success' | 'denied' | 'error';
export type AccountType = 'nis' | 'ldap' | 'ad' | 'other';
export type GroupType = 'project' | 'cross-project' | 'functional';

export interface Role {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  roleType: RoleType;
  isActive: boolean;
  isBuiltIn: boolean;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  resourceType: ResourceType;
  resourceName: string;
  action: Action;
  isActive: boolean;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export interface UserRole {
  userId: number;
  roleId: number;
  grantedAt: Date;
  grantedBy: number | null;
  expiresAt: Date | null;
}

export interface UserProjectRole extends UserRole {
  projectId: number;
}

export interface UserGroupRole extends UserRole {
  groupId: number;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  groupType: GroupType;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExternalAccount {
  id: number;
  userId: number;
  projectId: number | null;
  accountType: AccountType;
  username: string;
  credentials: string | null;
  metadata: Record<string, any> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  action: AuditAction;
  resourceType: string | null;
  resourceId: number | null;
  roleId: number | null;
  permissionId: number | null;
  result: AuditResult | null;
  metadata: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface CheckPermissionOptions {
  userId: number;
  permission: string;
  projectId?: number;
  useCache?: boolean;
}

export interface CreateRoleInput {
  name: string;
  displayName: string;
  description?: string;
  roleType: RoleType;
  isBuiltIn?: boolean;
  metadata?: Record<string, any>;
}

export interface CreatePermissionInput {
  name: string;
  displayName: string;
  description?: string;
  resourceType: ResourceType;
  resourceName: string;
  action: Action;
  metadata?: Record<string, any>;
}

export interface AssignRoleInput {
  userId: number;
  roleId: number;
  grantedBy?: number;
  expiresAt?: Date;
  projectId?: number;
  groupId?: number;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  groupType: GroupType;
  metadata?: Record<string, any>;
}

export interface UserPermissionsResult {
  systemRoles: Role[];
  projectRoles: (Role & { projectId: number })[];
  groupRoles: (Role & { groupId: number })[];
  permissions: string[];
}
