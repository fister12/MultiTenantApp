import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { 
  withAuth, 
  withRole, 
  withAdminRole, 
  withMemberRole, 
  withPermission, 
  withTenantIsolation, 
  withTenantValidation 
} from '../middleware';
import { generateToken, type JWTPayload } from '../auth';
import { Role } from '@/types';
import { Role } from '@/types';
import { Role } from '@/types';
import { Role } from '@/types';
import { Role } from '@/types';
import { Role } from '@/types';
import { Role } from '@/types';
import { Role } from '@/types';
// Remove Role import since we'll use string literals

// Mock NextResponse.json
vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...actual,
    NextResponse: {
      json: vi.fn((body, init) => ({
        json: () => Promise.resolve(body),
        status: init?.status || 200,
        body,
      })),
    },
  };
});

describe('Authentication Middleware', () => {
  const mockPayload: JWTPayload = {
    userId: 'user123',
    email: 'admin@acme.test',
    role: 'ADMIN',
    tenantId: 'tenant123',
    tenantSlug: 'acme',
  };

  const memberPayload: JWTPayload = {
    userId: 'user456',
    email: 'user@acme.test',
    role: Role.MEMBER,
    tenantId: 'tenant123',
    tenantSlug: 'acme',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withAuth middleware', () => {
    it('should authenticate valid token and call handler', async () => {
      const token = generateToken(mockPayload);
      const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const middleware = withAuth(mockHandler);
      await middleware(request);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            userId: mockPayload.userId,
            email: mockPayload.email,
            role: mockPayload.role,
            tenantId: mockPayload.tenantId,
            tenantSlug: mockPayload.tenantSlug,
          }),
          tenantContext: expect.objectContaining({
            tenantId: mockPayload.tenantId,
            tenantSlug: mockPayload.tenantSlug,
            userId: mockPayload.userId,
            userRole: mockPayload.role,
          }),
        })
      );
    });

    it('should reject request without authorization header', async () => {
      const mockHandler = vi.fn();
      
      const request = new NextRequest('http://localhost:3000/api/test');

      const middleware = withAuth(mockHandler);
      const response = await middleware(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: { message: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    });

    it('should reject request with invalid token', async () => {
      const mockHandler = vi.fn();
      
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      const middleware = withAuth(mockHandler);
      const response = await middleware(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    });

    it('should reject request with malformed authorization header', async () => {
      const mockHandler = vi.fn();
      
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: 'InvalidFormat token',
        },
      });

      const middleware = withAuth(mockHandler);
      const response = await middleware(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: { message: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    });
  });

  describe('withRole middleware', () => {
    it('should allow access for user with correct role', async () => {
      const token = generateToken(mockPayload);
      const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      
      const request = new NextRequest('http://localhost:3000/api/admin', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const middleware = withRole([Role.ADMIN])(mockHandler);
      await middleware(request);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should deny access for user with incorrect role', async () => {
      const token = generateToken(memberPayload);
      const mockHandler = vi.fn();
      
      const request = new NextRequest('http://localhost:3000/api/admin', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const middleware = withRole([Role.ADMIN])(mockHandler);
      const response = await middleware(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: { message: 'Admin role required for this action', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    });

    it('should allow access for multiple valid roles', async () => {
      const token = generateToken(memberPayload);
      const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      
      const request = new NextRequest('http://localhost:3000/api/notes', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const middleware = withRole([Role.ADMIN, Role.MEMBER])(mockHandler);
      await middleware(request);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('withTenantIsolation middleware', () => {
    it('should allow access when tenant slug matches user tenant', async () => {
      const token = generateToken(mockPayload);
      const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      
      const request = new NextRequest('http://localhost:3000/api/tenants/acme/upgrade', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const middleware = withTenantIsolation(mockHandler);
      await middleware(request);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should deny access when tenant slug does not match user tenant', async () => {
      const token = generateToken(mockPayload); // acme tenant
      const mockHandler = vi.fn();
      
      const request = new NextRequest('http://localhost:3000/api/tenants/globex/upgrade', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const middleware = withTenantIsolation(mockHandler);
      const response = await middleware(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: { message: 'Access denied: tenant isolation violation', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    });

    it('should allow access for routes without tenant slug', async () => {
      const token = generateToken(mockPayload);
      const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      
      const request = new NextRequest('http://localhost:3000/api/notes', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const middleware = withTenantIsolation(mockHandler);
      await middleware(request);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should handle authentication errors properly', async () => {
      const mockHandler = vi.fn();
      
      const request = new NextRequest('http://localhost:3000/api/tenants/acme/upgrade');

      const middleware = withTenantIsolation(mockHandler);
      const response = await middleware(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: { message: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    });
  });

  describe('withTenantValidation middleware', () => {
    it('should allow access with valid tenant context', async () => {
      const token = generateToken(mockPayload);
      const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      
      const request = new NextRequest('http://localhost:3000/api/notes', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const middleware = withTenantValidation(mockHandler);
      await middleware(request);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should reject requests with invalid tenant slug format', async () => {
      const invalidPayload = { ...mockPayload, tenantSlug: 'INVALID_SLUG' };
      const token = generateToken(invalidPayload);
      const mockHandler = vi.fn();
      
      const request = new NextRequest('http://localhost:3000/api/notes', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const middleware = withTenantValidation(mockHandler);
      await middleware(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: { message: 'Invalid tenant identifier', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    });

    it('should handle tenant isolation violations', async () => {
      const token = generateToken(mockPayload); // acme tenant
      const mockHandler = vi.fn();
      
      const request = new NextRequest('http://localhost:3000/api/tenants/globex/upgrade', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const middleware = withTenantValidation(mockHandler);
      await middleware(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: { message: 'Access denied: tenant isolation violation', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    });
  });

  describe('Enhanced Role Middleware', () => {
    describe('withAdminRole middleware', () => {
      it('should allow access for admin users', async () => {
        const token = generateToken(mockPayload);
        const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
        
        const request = new NextRequest('http://localhost:3000/api/admin', {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        const middleware = withAdminRole(mockHandler);
        await middleware(request);

        expect(mockHandler).toHaveBeenCalled();
      });

      it('should deny access for member users', async () => {
        const token = generateToken(memberPayload);
        const mockHandler = vi.fn();
        
        const request = new NextRequest('http://localhost:3000/api/admin', {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        const middleware = withAdminRole(mockHandler);
        await middleware(request);

        expect(mockHandler).not.toHaveBeenCalled();
        expect(NextResponse.json).toHaveBeenCalledWith(
          { error: { message: 'Admin role required for this action', code: 'FORBIDDEN' } },
          { status: 403 }
        );
      });
    });

    describe('withMemberRole middleware', () => {
      it('should allow access for both admin and member users', async () => {
        const adminToken = generateToken(mockPayload);
        const memberToken = generateToken(memberPayload);
        const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
        
        // Test admin access
        const adminRequest = new NextRequest('http://localhost:3000/api/notes', {
          headers: {
            authorization: `Bearer ${adminToken}`,
          },
        });

        const adminMiddleware = withMemberRole(mockHandler);
        await adminMiddleware(adminRequest);
        expect(mockHandler).toHaveBeenCalled();

        // Reset mock
        mockHandler.mockClear();

        // Test member access
        const memberRequest = new NextRequest('http://localhost:3000/api/notes', {
          headers: {
            authorization: `Bearer ${memberToken}`,
          },
        });

        const memberMiddleware = withMemberRole(mockHandler);
        await memberMiddleware(memberRequest);
        expect(mockHandler).toHaveBeenCalled();
      });
    });

    describe('withPermission middleware', () => {
      it('should allow access when user has required permission', async () => {
        const token = generateToken(mockPayload);
        const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
        
        const request = new NextRequest('http://localhost:3000/api/tenants/upgrade', {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        const middleware = withPermission('subscription:upgrade')(mockHandler);
        await middleware(request);

        expect(mockHandler).toHaveBeenCalled();
      });

      it('should deny access when user lacks required permission', async () => {
        const token = generateToken(memberPayload);
        const mockHandler = vi.fn();
        
        const request = new NextRequest('http://localhost:3000/api/tenants/upgrade', {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        const middleware = withPermission('subscription:upgrade')(mockHandler);
        await middleware(request);

        expect(mockHandler).not.toHaveBeenCalled();
        expect(NextResponse.json).toHaveBeenCalledWith(
          { error: { message: 'Admin role required for this action', code: 'FORBIDDEN' } },
          { status: 403 }
        );
      });

      it('should use context function to validate resource-specific permissions', async () => {
        const token = generateToken(memberPayload);
        const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
        
        const request = new NextRequest('http://localhost:3000/api/notes/note123', {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        // Mock context function that returns user's own resource
        const getContext = (req: any) => ({
          resourceTenantId: 'tenant123',
          resourceUserId: 'user456', // Same as memberPayload.userId
        });

        const middleware = withPermission('notes:edit', getContext)(mockHandler);
        await middleware(request);

        expect(mockHandler).toHaveBeenCalled();
      });

      it('should deny access when context validation fails', async () => {
        const token = generateToken(memberPayload);
        const mockHandler = vi.fn();
        
        const request = new NextRequest('http://localhost:3000/api/notes/note123', {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        // Mock context function that returns other user's resource
        const getContext = (req: any) => ({
          resourceTenantId: 'tenant123',
          resourceUserId: 'other-user', // Different from memberPayload.userId
        });

        const middleware = withPermission('notes:edit', getContext)(mockHandler);
        await middleware(request);

        expect(mockHandler).not.toHaveBeenCalled();
        expect(NextResponse.json).toHaveBeenCalledWith(
          { error: { message: 'You can only access your own resources', code: 'FORBIDDEN' } },
          { status: 403 }
        );
      });
    });
  });

  describe('Middleware Integration', () => {
    it('should work with combined role and tenant isolation middleware', async () => {
      const token = generateToken(mockPayload);
      const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      
      const request = new NextRequest('http://localhost:3000/api/tenants/acme/upgrade', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      // Combine role and tenant isolation
      const middleware = withRole([Role.ADMIN])(withTenantIsolation(mockHandler));
      await middleware(request);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should reject when role is wrong even if tenant is correct', async () => {
      const token = generateToken(memberPayload); // MEMBER role
      const mockHandler = vi.fn();
      
      const request = new NextRequest('http://localhost:3000/api/tenants/acme/upgrade', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const middleware = withRole([Role.ADMIN])(withTenantIsolation(mockHandler));
      await middleware(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: { message: 'Admin role required for this action', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    });

    it('should work with full validation stack', async () => {
      const token = generateToken(mockPayload);
      const mockHandler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      
      const request = new NextRequest('http://localhost:3000/api/tenants/acme/upgrade', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      // Full middleware stack
      const middleware = withRole([Role.ADMIN])(withTenantValidation(mockHandler));
      await middleware(request);

      expect(mockHandler).toHaveBeenCalled();
    });
  });
});