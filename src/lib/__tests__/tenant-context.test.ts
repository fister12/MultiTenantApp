import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '../../generated/prisma';
import {
  TenantContext,
  createTenantContext,
  TenantScopedPrisma,
  createTenantScopedPrisma,
  isValidTenantSlug,
  extractTenantSlugFromUrl,
} from '../tenant-context';
import { JWTPayload } from '../auth';

// Mock Prisma client
const mockPrisma = {
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  note: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaClient;

describe('Tenant Context', () => {
  const mockJWTPayload: JWTPayload = {
    userId: 'user123',
    email: 'admin@acme.test',
    role: 'ADMIN',
    tenantId: 'tenant123',
    tenantSlug: 'acme',
  };

  const mockTenantContext: TenantContext = {
    tenantId: 'tenant123',
    tenantSlug: 'acme',
    userId: 'user123',
    userRole: 'ADMIN',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTenantContext', () => {
    it('should create tenant context from JWT payload', () => {
      const context = createTenantContext(mockJWTPayload);

      expect(context).toEqual({
        tenantId: 'tenant123',
        tenantSlug: 'acme',
        userId: 'user123',
        userRole: 'ADMIN',
      });
    });
  });

  describe('isValidTenantSlug', () => {
    it('should validate correct tenant slugs', () => {
      expect(isValidTenantSlug('acme')).toBe(true);
      expect(isValidTenantSlug('globex')).toBe(true);
      expect(isValidTenantSlug('my-company')).toBe(true);
      expect(isValidTenantSlug('company123')).toBe(true);
    });

    it('should reject invalid tenant slugs', () => {
      expect(isValidTenantSlug('ACME')).toBe(false); // uppercase
      expect(isValidTenantSlug('acme_corp')).toBe(false); // underscore
      expect(isValidTenantSlug('acme corp')).toBe(false); // space
      expect(isValidTenantSlug('a')).toBe(false); // too short
      expect(isValidTenantSlug('')).toBe(false); // empty
      expect(isValidTenantSlug('a'.repeat(51))).toBe(false); // too long
    });
  });

  describe('extractTenantSlugFromUrl', () => {
    it('should extract tenant slug from API URLs', () => {
      expect(extractTenantSlugFromUrl('http://localhost:3000/api/tenants/acme/upgrade')).toBe('acme');
      expect(extractTenantSlugFromUrl('http://localhost:3000/api/tenants/globex/users')).toBe('globex');
      expect(extractTenantSlugFromUrl('https://example.com/tenants/my-company/settings')).toBe('my-company');
    });

    it('should return null for URLs without tenant slug', () => {
      expect(extractTenantSlugFromUrl('http://localhost:3000/api/notes')).toBe(null);
      expect(extractTenantSlugFromUrl('http://localhost:3000/api/health')).toBe(null);
      expect(extractTenantSlugFromUrl('http://localhost:3000/login')).toBe(null);
    });

    it('should return null for invalid tenant slugs in URLs', () => {
      expect(extractTenantSlugFromUrl('http://localhost:3000/api/tenants/INVALID/upgrade')).toBe(null);
      expect(extractTenantSlugFromUrl('http://localhost:3000/api/tenants/invalid_slug/upgrade')).toBe(null);
    });

    it('should handle malformed URLs gracefully', () => {
      expect(extractTenantSlugFromUrl('not-a-url')).toBe(null);
      expect(extractTenantSlugFromUrl('')).toBe(null);
    });
  });
});

describe('TenantScopedPrisma', () => {
  let tenantScopedPrisma: TenantScopedPrisma;
  const mockTenantContext: TenantContext = {
    tenantId: 'tenant123',
    tenantSlug: 'acme',
    userId: 'user123',
    userRole: 'ADMIN',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tenantScopedPrisma = createTenantScopedPrisma(mockPrisma, mockTenantContext);
  });

  describe('user operations', () => {
    it('should scope user findMany to tenant', async () => {
      await tenantScopedPrisma.user.findMany({ where: { role: 'ADMIN' } });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'ADMIN',
          tenantId: 'tenant123',
        },
      });
    });

    it('should scope user findUnique to tenant', async () => {
      await tenantScopedPrisma.user.findUnique({ where: { id: 'user456' } });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'user456',
          tenantId: 'tenant123',
        },
      });
    });

    it('should scope user create to tenant', async () => {
      await tenantScopedPrisma.user.create({
        data: { email: 'new@acme.test', password: 'hashed', role: 'MEMBER' },
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@acme.test',
          password: 'hashed',
          role: 'MEMBER',
          tenantId: 'tenant123',
        },
      });
    });

    it('should scope user count to tenant', async () => {
      await tenantScopedPrisma.user.count();

      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant123',
        },
      });
    });
  });

  describe('note operations', () => {
    it('should scope note findMany to tenant', async () => {
      await tenantScopedPrisma.note.findMany({ where: { title: { contains: 'test' } } });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith({
        where: {
          title: { contains: 'test' },
          tenantId: 'tenant123',
        },
      });
    });

    it('should scope note create to tenant and user', async () => {
      await tenantScopedPrisma.note.create({
        data: { title: 'Test Note', content: 'Content' },
      });

      expect(mockPrisma.note.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Note',
          content: 'Content',
          tenantId: 'tenant123',
          userId: 'user123',
        },
      });
    });

    it('should scope note update to tenant', async () => {
      await tenantScopedPrisma.note.update({
        where: { id: 'note123' },
        data: { title: 'Updated Title' },
      });

      expect(mockPrisma.note.update).toHaveBeenCalledWith({
        where: {
          id: 'note123',
          tenantId: 'tenant123',
        },
        data: { title: 'Updated Title' },
      });
    });

    it('should scope note delete to tenant', async () => {
      await tenantScopedPrisma.note.delete({ where: { id: 'note123' } });

      expect(mockPrisma.note.delete).toHaveBeenCalledWith({
        where: {
          id: 'note123',
          tenantId: 'tenant123',
        },
      });
    });
  });

  describe('tenant operations', () => {
    it('should only allow access to current tenant', async () => {
      await tenantScopedPrisma.tenant.findUnique();

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'tenant123',
        },
      });
    });

    it('should only allow updating current tenant', async () => {
      await tenantScopedPrisma.tenant.update({ data: { plan: 'PRO' } });

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        data: { plan: 'PRO' },
        where: {
          id: 'tenant123',
        },
      });
    });
  });

  describe('ownership validation', () => {
    it('should validate tenant ownership for users', async () => {
      (mockPrisma.user.findUnique as any).mockResolvedValue({ tenantId: 'tenant123' });

      const isValid = await tenantScopedPrisma.validateTenantOwnership('user', 'user456');

      expect(isValid).toBe(true);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user456' },
        select: { tenantId: true },
      });
    });

    it('should reject resources from different tenants', async () => {
      (mockPrisma.user.findUnique as any).mockResolvedValue({ tenantId: 'different-tenant' });

      const isValid = await tenantScopedPrisma.validateTenantOwnership('user', 'user456');

      expect(isValid).toBe(false);
    });

    it('should validate note ownership for current user', async () => {
      (mockPrisma.note.findUnique as any).mockResolvedValue({
        tenantId: 'tenant123',
        userId: 'user123',
      });

      const isValid = await tenantScopedPrisma.validateNoteOwnership('note123');

      expect(isValid).toBe(true);
      expect(mockPrisma.note.findUnique).toHaveBeenCalledWith({
        where: { id: 'note123' },
        select: { tenantId: true, userId: true },
      });
    });

    it('should reject notes from different users', async () => {
      (mockPrisma.note.findUnique as any).mockResolvedValue({
        tenantId: 'tenant123',
        userId: 'different-user',
      });

      const isValid = await tenantScopedPrisma.validateNoteOwnership('note123');

      expect(isValid).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      (mockPrisma.user.findUnique as any).mockRejectedValue(new Error('Database error'));

      const isValid = await tenantScopedPrisma.validateTenantOwnership('user', 'user456');

      expect(isValid).toBe(false);
    });
  });

  describe('context access', () => {
    it('should return tenant context', () => {
      const context = tenantScopedPrisma.getContext();

      expect(context).toEqual({
        tenantId: 'tenant123',
        tenantSlug: 'acme',
        userId: 'user123',
        userRole: 'ADMIN',
      });
    });

    it('should return immutable context copy', () => {
      const context1 = tenantScopedPrisma.getContext();
      const context2 = tenantScopedPrisma.getContext();
      
      // Should be equal but not the same reference
      expect(context1).toEqual(context2);
      expect(context1).not.toBe(context2);
      
      // Modifying returned context should not affect internal state
      context1.tenantId = 'modified';
      const context3 = tenantScopedPrisma.getContext();
      expect(context3.tenantId).toBe('tenant123');
    });
  });

  describe('Advanced Tenant Isolation', () => {
    it('should prevent cross-tenant data access in complex queries', async () => {
      await tenantScopedPrisma.user.findMany({
        where: {
          role: 'ADMIN',
          notes: {
            some: {
              title: { contains: 'test' }
            }
          }
        },
        include: {
          notes: true
        }
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'ADMIN',
          notes: {
            some: {
              title: { contains: 'test' }
            }
          },
          tenantId: 'tenant123',
        },
        include: {
          notes: true
        }
      });
    });

    it('should handle nested where conditions correctly', async () => {
      await tenantScopedPrisma.note.findMany({
        where: {
          OR: [
            { title: { contains: 'urgent' } },
            { content: { contains: 'important' } }
          ],
          user: {
            role: 'ADMIN'
          }
        }
      });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: 'urgent' } },
            { content: { contains: 'important' } }
          ],
          user: {
            role: 'ADMIN'
          },
          tenantId: 'tenant123',
        }
      });
    });

    it('should validate tenant ownership for different resource types', async () => {
      // Test user ownership validation
      (mockPrisma.user.findUnique as any).mockResolvedValue({ tenantId: 'tenant123' });
      expect(await tenantScopedPrisma.validateTenantOwnership('user', 'user456')).toBe(true);

      // Test note ownership validation
      (mockPrisma.note.findUnique as any).mockResolvedValue({ tenantId: 'tenant123' });
      expect(await tenantScopedPrisma.validateTenantOwnership('note', 'note456')).toBe(true);

      // Test invalid resource type
      expect(await tenantScopedPrisma.validateTenantOwnership('invalid' as any, 'resource456')).toBe(false);
    });

    it('should handle null/undefined resources gracefully', async () => {
      (mockPrisma.user.findUnique as any).mockResolvedValue(null);
      expect(await tenantScopedPrisma.validateTenantOwnership('user', 'nonexistent')).toBe(false);

      (mockPrisma.note.findUnique as any).mockResolvedValue(undefined);
      expect(await tenantScopedPrisma.validateNoteOwnership('nonexistent')).toBe(false);
    });
  });

  describe('Performance and Optimization', () => {
    it('should use efficient queries for ownership validation', async () => {
      await tenantScopedPrisma.validateTenantOwnership('user', 'user123');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user123' },
        select: { tenantId: true }, // Only select needed field
      });
    });

    it('should use efficient queries for note ownership validation', async () => {
      await tenantScopedPrisma.validateNoteOwnership('note123');
      
      expect(mockPrisma.note.findUnique).toHaveBeenCalledWith({
        where: { id: 'note123' },
        select: { tenantId: true, userId: true }, // Only select needed fields
      });
    });
  });
});