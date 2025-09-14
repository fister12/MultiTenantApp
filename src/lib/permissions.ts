import { Role } from '../types';
import { JWTPayload } from './auth';

/**
 * Permission checking utilities for role-based authorization
 */

export interface PermissionContext {
  user: JWTPayload;
  resourceTenantId?: string;
  resourceUserId?: string;
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: JWTPayload): boolean {
  return user.role === Role.ADMIN;
}

/**
 * Check if user has member role
 */
export function isMember(user: JWTPayload): boolean {
  return user.role === Role.MEMBER;
}

/**
 * Check if user has any of the specified roles
 */
export function hasRole(user: JWTPayload, roles: Role[]): boolean {
  return roles.includes(user.role);
}

/**
 * Check if user can manage tenants (admin only)
 */
export function canManageTenant(user: JWTPayload): boolean {
  return isAdmin(user);
}

/**
 * Check if user can upgrade subscription (admin only)
 */
export function canUpgradeSubscription(user: JWTPayload): boolean {
  return isAdmin(user);
}

/**
 * Check if user can invite other users (admin only)
 */
export function canInviteUsers(user: JWTPayload): boolean {
  return isAdmin(user);
}

/**
 * Check if user can access notes (both admin and member)
 */
export function canAccessNotes(user: JWTPayload): boolean {
  return hasRole(user, [Role.ADMIN, Role.MEMBER]);
}

/**
 * Check if user can create notes (both admin and member)
 */
export function canCreateNotes(user: JWTPayload): boolean {
  return hasRole(user, [Role.ADMIN, Role.MEMBER]);
}

/**
 * Check if user can edit a specific note
 * Users can edit their own notes, admins can edit any note in their tenant
 */
export function canEditNote(context: PermissionContext): boolean {
  const { user, resourceTenantId, resourceUserId } = context;
  
  // Must be in the same tenant
  if (resourceTenantId && resourceTenantId !== user.tenantId) {
    return false;
  }
  
  // Admins can edit any note in their tenant
  if (isAdmin(user)) {
    return true;
  }
  
  // Members can only edit their own notes
  if (isMember(user) && resourceUserId) {
    return resourceUserId === user.userId;
  }
  
  return false;
}

/**
 * Check if user can delete a specific note
 * Same rules as editing notes
 */
export function canDeleteNote(context: PermissionContext): boolean {
  return canEditNote(context);
}

/**
 * Check if user can view a specific note
 * Users can view notes in their tenant, with same ownership rules as editing
 */
export function canViewNote(context: PermissionContext): boolean {
  return canEditNote(context);
}

/**
 * Get all permissions for a user role
 */
export function getUserPermissions(user: JWTPayload): string[] {
  const permissions: string[] = [];
  
  if (canAccessNotes(user)) {
    permissions.push('notes:read', 'notes:create');
  }
  
  if (isAdmin(user)) {
    permissions.push(
      'notes:edit:all',
      'notes:delete:all',
      'tenant:manage',
      'subscription:upgrade',
      'users:invite'
    );
  } else if (isMember(user)) {
    permissions.push(
      'notes:edit:own',
      'notes:delete:own'
    );
  }
  
  return permissions;
}

/**
 * Validate permission for a specific action
 */
export function validatePermission(
  user: JWTPayload,
  action: string,
  context?: Omit<PermissionContext, 'user'>
): boolean {
  const fullContext: PermissionContext = { user, ...context };
  
  switch (action) {
    case 'tenant:manage':
    case 'subscription:upgrade':
    case 'users:invite':
      return isAdmin(user);
      
    case 'notes:read':
    case 'notes:create':
      return canAccessNotes(user);
      
    case 'notes:edit':
    case 'notes:delete':
    case 'notes:view':
      return canEditNote(fullContext);
      
    default:
      return false;
  }
}

/**
 * Permission error messages
 */
export const PERMISSION_ERRORS = {
  INSUFFICIENT_ROLE: 'Insufficient role permissions',
  ADMIN_REQUIRED: 'Admin role required for this action',
  MEMBER_REQUIRED: 'Member role required for this action',
  RESOURCE_ACCESS_DENIED: 'Access denied to this resource',
  TENANT_MISMATCH: 'Resource belongs to different tenant',
  OWNERSHIP_REQUIRED: 'You can only access your own resources',
} as const;

/**
 * Get appropriate error message for permission denial
 */
export function getPermissionError(
  user: JWTPayload,
  action: string,
  context?: Omit<PermissionContext, 'user'>
): string {
  if (!hasRole(user, [Role.ADMIN, Role.MEMBER])) {
    return PERMISSION_ERRORS.INSUFFICIENT_ROLE;
  }
  
  if (['tenant:manage', 'subscription:upgrade', 'users:invite'].includes(action)) {
    return PERMISSION_ERRORS.ADMIN_REQUIRED;
  }
  
  if (context?.resourceTenantId && context.resourceTenantId !== user.tenantId) {
    return PERMISSION_ERRORS.TENANT_MISMATCH;
  }
  
  if (context?.resourceUserId && context.resourceUserId !== user.userId && !isAdmin(user)) {
    return PERMISSION_ERRORS.OWNERSHIP_REQUIRED;
  }
  
  return PERMISSION_ERRORS.RESOURCE_ACCESS_DENIED;
}