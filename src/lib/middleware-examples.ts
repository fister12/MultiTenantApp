/**
 * Examples of how to use the role-based authorization middleware
 * These examples show different patterns for protecting API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  withAuth, 
  withRole, 
  withAdminRole, 
  withMemberRole, 
  withPermission, 
  withTenantValidation,
  AuthenticatedRequest 
} from './middleware';
import { Role } from '../types';

// Example 1: Admin-only endpoint (e.g., upgrade subscription)
export const adminOnlyHandler = withAdminRole(async (req: AuthenticatedRequest) => {
  // Only admin users can access this endpoint
  const { user, tenantContext } = req;
  
  return NextResponse.json({
    message: `Admin ${user!.email} from tenant ${tenantContext!.tenantSlug} accessed admin endpoint`,
    user: user,
    tenant: tenantContext
  });
});

// Example 2: Member or Admin endpoint (e.g., notes CRUD)
export const memberOrAdminHandler = withMemberRole(async (req: AuthenticatedRequest) => {
  // Both admin and member users can access this endpoint
  const { user, tenantContext } = req;
  
  return NextResponse.json({
    message: `User ${user!.email} (${user!.role}) from tenant ${tenantContext!.tenantSlug} accessed notes endpoint`,
    permissions: user!.role === Role.ADMIN ? 'full_access' : 'limited_access'
  });
});

// Example 3: Specific role requirement
export const specificRoleHandler = withRole([Role.ADMIN])(async (req: AuthenticatedRequest) => {
  // Only users with ADMIN role can access
  const { user } = req;
  
  return NextResponse.json({
    message: `Admin user ${user!.email} accessed specific role endpoint`
  });
});

// Example 4: Permission-based authorization
export const permissionBasedHandler = withPermission('subscription:upgrade')(async (req: AuthenticatedRequest) => {
  // Only users with subscription upgrade permission can access
  const { user, tenantContext } = req;
  
  return NextResponse.json({
    message: `User ${user!.email} upgraded tenant ${tenantContext!.tenantSlug} subscription`
  });
});

// Example 5: Resource-specific permission with context
export const resourceSpecificHandler = withPermission(
  'notes:edit',
  (req: AuthenticatedRequest) => {
    // Extract resource context from request (e.g., from URL params)
    const url = new URL(req.url);
    const noteId = url.pathname.split('/').pop();
    
    // In a real implementation, you would fetch the note from database
    // to get the actual resourceUserId and resourceTenantId
    return {
      resourceTenantId: req.user!.tenantId, // Same tenant
      resourceUserId: req.user!.userId,     // User's own note
    };
  }
)(async (req: AuthenticatedRequest) => {
  const { user } = req;
  
  return NextResponse.json({
    message: `User ${user!.email} can edit this note`
  });
});

// Example 6: Combined middleware stack
export const fullProtectionHandler = withRole([Role.ADMIN])(
  withTenantValidation(async (req: AuthenticatedRequest) => {
    // Full protection: authentication + admin role + tenant validation
    const { user, tenantContext } = req;
    
    return NextResponse.json({
      message: 'Fully protected endpoint accessed',
      user: {
        id: user!.userId,
        email: user!.email,
        role: user!.role
      },
      tenant: {
        id: tenantContext!.tenantId,
        slug: tenantContext!.tenantSlug
      }
    });
  })
);

// Example 7: Basic authentication only
export const basicAuthHandler = withAuth(async (req: AuthenticatedRequest) => {
  // Only requires valid JWT token
  const { user } = req;
  
  return NextResponse.json({
    message: `Authenticated user ${user!.email} accessed basic endpoint`
  });
});

// Example 8: Multiple role options
export const multiRoleHandler = withRole([Role.ADMIN, Role.MEMBER])(async (req: AuthenticatedRequest) => {
  // Both admin and member can access, but with different capabilities
  const { user } = req;
  
  const capabilities = user!.role === Role.ADMIN 
    ? ['read', 'write', 'delete', 'manage'] 
    : ['read', 'write'];
  
  return NextResponse.json({
    message: `User ${user!.email} accessed multi-role endpoint`,
    role: user!.role,
    capabilities
  });
});

/**
 * Usage in API routes:
 * 
 * // pages/api/admin/upgrade.ts
 * export default adminOnlyHandler;
 * 
 * // pages/api/notes/index.ts
 * export default memberOrAdminHandler;
 * 
 * // pages/api/notes/[id].ts
 * export default resourceSpecificHandler;
 */