import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { JWTPayload } from '@/types';

// Mock the subscription module
vi.mock('@/lib/subscription', () => ({
  createSubscriptionManager: vi.fn(() => ({
    getSubscriptionStatus: vi.fn(),
  })),
}));

// Mock the middleware
vi.mock('@/lib/middleware', () => ({
  withAuth: vi.fn((handler) => handler),
}));

// Mock authenticated request
interface MockAuthenticatedRequest extends NextRequest {
  user: JWTPayload;
  tenantContext: {
    tenantId: string;
    tenantSlug: string;
    userId: string;
    userRole: 'ADMIN' | 'MEMBER';
  };
}

function createMockAuthenticatedRequest(method: string, url: string): MockAuthenticatedRequest {
  const req = new NextRequest(url, {
    method,
    headers: {
      'authorization': 'Bearer valid-token',
    },
  }) as MockAuthenticatedRequest;

  req.user = {
    userId: 'user1',
    email: 'admin@acme.test',
    role: 'ADMIN',
    tenantId: 'tenant1',
    tenantSlug: 'acme',
  };

  req.tenantContext = {
    tenantId: 'tenant1',
    tenantSlug: 'acme',
    userId: 'user1',
    userRole: 'ADMIN',
  };

  return req;
}

describe('/api/subscription/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return subscription status for authenticated user', async () => {
      const { createSubscriptionManager } = await import('@/lib/subscription');
      const mockManager = {
        getSubscriptionStatus: vi.fn().mockResolvedValue({
          plan: 'FREE',
          noteCount: 2,
          noteLimit: 3,
          canCreateNotes: true,
          canUpgrade: true,
        }),
      };
      
      (createSubscriptionManager as any).mockReturnValue(mockManager);

      const request = createMockAuthenticatedRequest('GET', 'http://localhost:3000/api/subscription/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        plan: 'FREE',
        noteCount: 2,
        noteLimit: 3,
        canCreateNotes: true,
        canUpgrade: true,
      });
    });

    it('should return PRO plan status', async () => {
      const { createSubscriptionManager } = await import('@/lib/subscription');
      const mockManager = {
        getSubscriptionStatus: vi.fn().mockResolvedValue({
          plan: 'PRO',
          noteCount: 10,
          noteLimit: null,
          canCreateNotes: true,
          canUpgrade: false,
        }),
      };
      
      (createSubscriptionManager as any).mockReturnValue(mockManager);

      const request = createMockAuthenticatedRequest('GET', 'http://localhost:3000/api/subscription/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        plan: 'PRO',
        noteCount: 10,
        noteLimit: null,
        canCreateNotes: true,
        canUpgrade: false,
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscription/status');
      // Remove tenant context to simulate unauthenticated request
      (request as any).tenantContext = null;
      
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle subscription manager errors', async () => {
      const { createSubscriptionManager } = await import('@/lib/subscription');
      const mockManager = {
        getSubscriptionStatus: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      
      (createSubscriptionManager as any).mockReturnValue(mockManager);

      const request = createMockAuthenticatedRequest('GET', 'http://localhost:3000/api/subscription/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});