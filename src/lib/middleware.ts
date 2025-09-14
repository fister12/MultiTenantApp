import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader, JWTPayload } from './auth';
import { TenantContext, createTenantContext, extractTenantSlugFromUrl } from './tenant-context';
import { 
  hasRole, 
  validatePermission, 
  getPermissionError, 
  PermissionContext,
  isAdmin,
  isMember 
} from './permissions';
import { 
  withAPISecurity, 
  withRateLimit, 
  withCORS, 
  withSecurityHeaders,
  withRequestSizeLimit,
  withContentTypeValidation,
  RATE_LIMIT_CONFIGS 
} from './security';
import { Role } from '../types';

// Extended request interface with user and tenant context
export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
  tenantContext?: TenantContext;
}

// Error response helper
function createErrorResponse(message: string, status: number) {
  return NextResponse.json(
    { 
      error: { message, code: getErrorCode(status) } 
    },
    { status }
  );
}

function getErrorCode(status: number): string {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    case 400:
      return 'VALIDATION_ERROR';
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Authentication middleware that validates JWT tokens and extracts tenant context
 */
export function withAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.get('authorization');
      const token = extractTokenFromHeader(authHeader);

      if (!token) {
        return createErrorResponse('Missing or invalid authorization header', 401);
      }

      // Verify and decode token
      const payload = verifyToken(token);
      
      // Add user and tenant context to request
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.user = payload;
      authenticatedReq.tenantContext = createTenantContext(payload);

      // Call the actual handler
      return handler(authenticatedReq);
    } catch (error) {
      console.error('Authentication error:', error);
      return createErrorResponse('Invalid or expired token', 401);
    }
  };
}

/**
 * Role-based authorization middleware
 */
export function withRole(roles: Role[]) {
  return function(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
    return withAuth(async (req: AuthenticatedRequest): Promise<NextResponse> => {
      const user = req.user!; // Safe because withAuth ensures user exists

      if (!hasRole(user, roles)) {
        // Determine appropriate error message based on required roles
        let errorMessage = 'Insufficient permissions';
        if (roles.length === 1 && roles[0] === Role.ADMIN) {
          errorMessage = 'Admin role required for this action';
        } else if (roles.length === 1 && roles[0] === Role.MEMBER) {
          errorMessage = 'Member role required for this action';
        }
        return createErrorResponse(errorMessage, 403);
      }

      return handler(req);
    });
  };
}

/**
 * Admin-only authorization middleware
 */
export function withAdminRole(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return withRole([Role.ADMIN])(handler);
}

/**
 * Member or Admin authorization middleware
 */
export function withMemberRole(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return withRole([Role.ADMIN, Role.MEMBER])(handler);
}

/**
 * Permission-based authorization middleware
 */
export function withPermission(action: string, getContext?: (req: AuthenticatedRequest) => Omit<PermissionContext, 'user'>) {
  return function(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
    return withAuth(async (req: AuthenticatedRequest): Promise<NextResponse> => {
      const user = req.user!; // Safe because withAuth ensures user exists
      const context = getContext ? getContext(req) : undefined;

      if (!validatePermission(user, action, context)) {
        const errorMessage = getPermissionError(user, action, context);
        return createErrorResponse(errorMessage, 403);
      }

      return handler(req);
    });
  };
}

/**
 * Tenant isolation middleware that ensures users can only access their tenant's data
 */
export function withTenantIsolation(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return withAuth(async (req: AuthenticatedRequest): Promise<NextResponse> => {
    const user = req.user!; // Safe because withAuth ensures user exists
    const tenantContext = req.tenantContext!; // Safe because withAuth ensures tenant context exists
    
    // Extract tenant slug from URL if present
    const requestedTenantSlug = extractTenantSlugFromUrl(req.url);
    
    if (requestedTenantSlug && requestedTenantSlug !== tenantContext.tenantSlug) {
      console.warn(`Tenant isolation violation: User ${user.email} (tenant: ${tenantContext.tenantSlug}) attempted to access tenant ${requestedTenantSlug}`);
      return createErrorResponse('Access denied: tenant isolation violation', 403);
    }

    return handler(req);
  });
}

/**
 * Enhanced tenant validation middleware with additional security checks
 */
export function withTenantValidation(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return withTenantIsolation(async (req: AuthenticatedRequest): Promise<NextResponse> => {
    const tenantContext = req.tenantContext!;
    
    // Additional validation checks
    if (!tenantContext.tenantId || !tenantContext.tenantSlug) {
      console.error('Invalid tenant context: missing tenant ID or slug');
      return createErrorResponse('Invalid tenant context', 400);
    }

    // Validate tenant slug format
    if (!/^[a-z0-9-]+$/.test(tenantContext.tenantSlug)) {
      console.error(`Invalid tenant slug format: ${tenantContext.tenantSlug}`);
      return createErrorResponse('Invalid tenant identifier', 400);
    }

    return handler(req);
  });
}

/**
 * Secure authentication middleware with rate limiting and security headers
 */
export function withSecureAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return withAPISecurity(RATE_LIMIT_CONFIGS.default)(
    withAuth(handler)
  );
}

/**
 * Secure role-based authorization middleware
 */
export function withSecureRole(roles: Role[]) {
  return function(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
    return withAPISecurity(RATE_LIMIT_CONFIGS.default)(
      withRole(roles)(handler)
    );
  };
}

/**
 * Secure admin-only authorization middleware
 */
export function withSecureAdminRole(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return withAPISecurity(RATE_LIMIT_CONFIGS.default)(
    withAdminRole(handler)
  );
}

/**
 * Secure member authorization middleware
 */
export function withSecureMemberRole(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return withAPISecurity(RATE_LIMIT_CONFIGS.notes)(
    withMemberRole(handler)
  );
}

/**
 * Authentication middleware with enhanced rate limiting for auth endpoints
 */
export function withAuthRateLimit(handler: (req: NextRequest) => Promise<NextResponse>) {
  return withAPISecurity(RATE_LIMIT_CONFIGS.auth)(
    withRequestSizeLimit(1024 * 10)(  // 10KB limit for auth requests
      withContentTypeValidation(['application/json'])(
        handler
      )
    )
  );
}

/**
 * Upgrade endpoint middleware with strict rate limiting
 */
export function withUpgradeRateLimit(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return withAPISecurity(RATE_LIMIT_CONFIGS.upgrade)(
    withAdminRole(handler)
  );
}