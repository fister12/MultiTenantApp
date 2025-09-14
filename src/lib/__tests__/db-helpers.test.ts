import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantAwareDb, createTenantAwareDb } from '../db-helpers';
import { TenantContext } from '../tenant-context';

// Mock the tenant-scoped Prisma
const mockTenantScopedPrisma = {
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  note: {
    count: vi.fn(),
  },
  user: {
    count: vi.fn(),
  },
  validateTenantOwnership: vi.fn(),
  validateNoteOwnership: vi.fn(),
};

// Mock the tenant context module
vi.mock('../tenant-context', async () => {
  const actual = await vi.importActual('../tenant-context');
  return {
    ...actual,
    createTenantScopedPrisma: vi.fn(() => mockTenantScopedPrisma),
  };
});

// Mock Prisma client
vi.mock('../../generated/prisma', () => ({
  PrismaClient: vi.fn(() => ({})),
}));

describe('TenantAwareDb', () => {
  const mockTenantContext: TenantContext = {
    tenantId: 'tenant123',
    tenantSlug: 'acme',
    userId: 'user123',
    userRole: 'ADMIN',
  };

  const memberContext: TenantContext = {
    tenantId: 'tenant123',
    tenantSlug: 'acme',
    userId: 'user456',
    userRole: 'MEMBER',
  };

  let tenantAwareDb: TenantAwareDb;

  beforeEach(() => {
    vi.clearAllMocks();
    tenantAwareDb = createTenantAwareDb(mockTenantContext);
  });

  describe('resource validation', () => {
    it('should validate resource access', async () => {
      mockTenantScopedPrisma.validateTenantOwnership.mockResolvedValue(true);

      const isValid = await tenantAwareDb.validateResourceAccess('user', 'user456');

      expect(isValid).toBe(true);
      expect(mockTenantScopedPrisma.validateTenantOwnership).toHaveBeenCalledWith('user', 'user456');
    });

    it('should validate note access', async () => {
      mockTenantScopedPrisma.validateNoteOwnership.mockResolvedValue(true);

      const isValid = await tenantAwareDb.validateNoteAccess('note123');

      expect(isValid).toBe(true);
      expect(mockTenantScopedPrisma.validateNoteOwnership).toHaveBeenCalledWith('note123');
    });
  });

  describe('tenant operations', () => {
    it('should get current tenant', async () => {
      const mockTenant = { id: 'tenant123', slug: 'acme', plan: 'FREE' };
      mockTenantScopedPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const tenant = await tenantAwareDb.getCurrentTenant();

      expect(tenant).toEqual(mockTenant);
      expect(mockTenantScopedPrisma.tenant.findUnique).toHaveBeenCalled();
    });
  });

  describe('subscription limits', () => {
    it('should check note limit for FREE plan', async () => {
      const mockTenant = { id: 'tenant123', slug: 'acme', plan: 'FREE' };
      mockTenantScopedPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockTenantScopedPrisma.note.count.mockResolvedValue(2);

      const result = await tenantAwareDb.checkNoteLimit();

      expect(result).toEqual({
        canCreate: true,
        currentCount: 2,
        limit: 3,
      });
    });

    it('should reject note creation when FREE plan limit is reached', async () => {
      const mockTenant = { id: 'tenant123', slug: 'acme', plan: 'FREE' };
      mockTenantScopedPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockTenantScopedPrisma.note.count.mockResolvedValue(3);

      const result = await tenantAwareDb.checkNoteLimit();

      expect(result).toEqual({
        canCreate: false,
        currentCount: 3,
        limit: 3,
      });
    });

    it('should allow unlimited notes for PRO plan', async () => {
      const mockTenant = { id: 'tenant123', slug: 'acme', plan: 'PRO' };
      mockTenantScopedPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockTenantScopedPrisma.note.count.mockResolvedValue(100);

      const result = await tenantAwareDb.checkNoteLimit();

      expect(result).toEqual({
        canCreate: true,
        currentCount: 100,
        limit: null,
      });
    });

    it('should throw error when tenant not found', async () => {
      mockTenantScopedPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(tenantAwareDb.checkNoteLimit()).rejects.toThrow('Tenant not found');
    });
  });

  describe('subscription upgrade', () => {
    it('should allow admin to upgrade tenant to PRO', async () => {
      mockTenantScopedPrisma.tenant.update.mockResolvedValue({ plan: 'PRO' });

      await tenantAwareDb.upgradeTenantToPro();

      expect(mockTenantScopedPrisma.tenant.update).toHaveBeenCalledWith({
        data: { plan: 'PRO' },
      });
    });

    it('should reject upgrade for non-admin users', async () => {
      const memberDb = createTenantAwareDb(memberContext);

      await expect(memberDb.upgradeTenantToPro()).rejects.toThrow(
        'Only administrators can upgrade tenant subscription'
      );

      expect(mockTenantScopedPrisma.tenant.update).not.toHaveBeenCalled();
    });
  });

  describe('tenant statistics', () => {
    it('should get tenant statistics', async () => {
      const mockTenant = { id: 'tenant123', slug: 'acme', plan: 'FREE' };
      mockTenantScopedPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockTenantScopedPrisma.user.count.mockResolvedValue(5);
      mockTenantScopedPrisma.note.count.mockResolvedValue(12);

      const stats = await tenantAwareDb.getTenantStats();

      expect(stats).toEqual({
        userCount: 5,
        noteCount: 12,
        plan: 'FREE',
        tenantSlug: 'acme',
      });
    });
  });
});