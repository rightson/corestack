/**
 * RBAC System Main Exports
 *
 * This is the main entry point for the RBAC system.
 * Import RBAC functionality from this module.
 */

// Types
export * from './types';

// Permission Checker
export {
  checkPermission,
  checkMultiplePermissions,
  invalidateUserPermissionCache,
  clearExpiredCache,
} from './permission-checker';

// Role Service
export {
  createRole,
  getRoleById,
  getRoleByName,
  listRoles,
  updateRole,
  setRoleActive,
  deleteRole,
  assignPermissionsToRole,
  removePermissionsFromRole,
  getRolePermissions,
} from './role-service';

// Permission Service
export {
  createPermission,
  getPermissionById,
  getPermissionByName,
  listPermissions,
  updatePermission,
  setPermissionActive,
  deletePermission,
  getOrCreatePermission,
} from './permission-service';

// User Role Service
export {
  assignRole,
  revokeRole,
  getUserPermissions,
  getUsersByRole,
  userHasRole,
} from './user-role-service';

// Group Service
export {
  createGroup,
  getGroupById,
  listGroups,
  updateGroup,
  deleteGroup,
  addUserToGroup,
  removeUserFromGroup,
  getGroupMembers,
  addProjectToGroup,
  removeProjectFromGroup,
  getGroupProjects,
  getUserGroups,
} from './group-service';

// Audit Service
export {
  logAccessAttempt,
  logPermissionGranted,
  logPermissionDenied,
  logRoleAssigned,
  logRoleRevoked,
} from './audit-service';

// Impersonation Service
export {
  isSuperAdmin,
  startImpersonation,
  endImpersonation,
  getImpersonationSession,
  getAdminActiveSessions,
  getImpersonationHistory,
  canImpersonate,
  SUPER_ADMIN_GROUP_NAME,
} from './impersonation-service';
export type { ImpersonationSession, StartImpersonationInput } from './impersonation-service';
