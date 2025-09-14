import { PrismaClient } from '../generated/prisma';
import { TenantContext, TenantScopedPrisma, createTenantScopedPrisma } from './tenant-context';

// Global Prisma client instance
let prisma: PrismaClient;

// Initialize Prisma client
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

// Create tenant-scoped database client
export function getTenantDb(tenantContext: TenantContext): TenantScopedPrisma {
  const prismaClient = getPrismaClient();
  return createTenantScopedPrisma(prismaClient, tenantContext);
}

// Tenant-aware database operations
export class TenantAwareDb {
  private tenantDb: TenantScopedPrisma;
  private context: TenantContext;

  constructor(tenantContext: TenantContext) {
    this.context = tenantContext;
    this.tenantDb = getTenantDb(tenantContext);
  }

  // Get tenant-scoped Prisma client
  get db(): TenantScopedPrisma {
    return this.tenantDb;
  }

  // Validate resource ownership before operations
  async validateResourceAccess(resourceType: 'user' | 'note', resourceId: string): Promise<boolean> {
    return this.tenantDb.validateTenantOwnership(resourceType, resourceId);
  }

  // Validate note ownership for current user
  async validateNoteAccess(noteId: string): Promise<boolean> {
    return this.tenantDb.validateNoteOwnership(noteId);
  }

  // Get current tenant information
  async getCurrentTenant() {
    return this.tenantDb.tenant.findUnique();
  }

  // Check subscription limits
  async checkNoteLimit(): Promise<{ canCreate: boolean; currentCount: number; limit: number | null }> {
    const tenant = await this.getCurrentTenant();
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const currentCount = await this.tenantDb.note.count();
    
    if (tenant.plan === 'FREE') {
      const limit = 3;
      return {
        canCreate: currentCount < limit,
        currentCount,
        limit,
      };
    }

    // PRO plan has unlimited notes
    return {
      canCreate: true,
      currentCount,
      limit: null,
    };
  }

  // Upgrade tenant subscription
  async upgradeTenantToPro(): Promise<void> {
    // Only admins can upgrade
    if (this.context.userRole !== 'ADMIN') {
      throw new Error('Only administrators can upgrade tenant subscription');
    }

    await this.tenantDb.tenant.update({
      data: { plan: 'PRO' },
    });
  }

  // Get tenant statistics
  async getTenantStats() {
    const [userCount, noteCount, tenant] = await Promise.all([
      this.tenantDb.user.count(),
      this.tenantDb.note.count(),
      this.getCurrentTenant(),
    ]);

    return {
      userCount,
      noteCount,
      plan: tenant?.plan,
      tenantSlug: this.context.tenantSlug,
    };
  }
}

// Helper function to create tenant-aware database instance
export function createTenantAwareDb(tenantContext: TenantContext): TenantAwareDb {
  return new TenantAwareDb(tenantContext);
}

// Cleanup function for tests
export async function disconnectDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}