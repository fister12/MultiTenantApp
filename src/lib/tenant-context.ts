import { JWTPayload } from './auth';
import { PrismaClient } from '../generated/prisma';

// Tenant context interface
export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userRole: 'ADMIN' | 'MEMBER';
}

// Create tenant context from JWT payload
export function createTenantContext(payload: JWTPayload): TenantContext {
  return {
    tenantId: payload.tenantId,
    tenantSlug: payload.tenantSlug,
    userId: payload.userId,
    userRole: payload.role,
  };
}

// Tenant-scoped Prisma client wrapper
export class TenantScopedPrisma {
  private prisma: PrismaClient;
  private context: TenantContext;

  constructor(prisma: PrismaClient, context: TenantContext) {
    this.prisma = prisma;
    this.context = context;
  }

  // Tenant-scoped user operations
  get user() {
    return {
      findMany: (args?: any) => {
        return this.prisma.user.findMany({
          ...args,
          where: {
            ...args?.where,
            tenantId: this.context.tenantId,
          },
        });
      },
      findUnique: (args: any) => {
        return this.prisma.user.findUnique({
          ...args,
          where: {
            ...args.where,
            tenantId: this.context.tenantId,
          },
        });
      },
      findFirst: (args?: any) => {
        return this.prisma.user.findFirst({
          ...args,
          where: {
            ...args?.where,
            tenantId: this.context.tenantId,
          },
        });
      },
      create: (args: any) => {
        return this.prisma.user.create({
          ...args,
          data: {
            ...args.data,
            tenantId: this.context.tenantId,
          },
        });
      },
      update: (args: any) => {
        return this.prisma.user.update({
          ...args,
          where: {
            ...args.where,
            tenantId: this.context.tenantId,
          },
        });
      },
      delete: (args: any) => {
        return this.prisma.user.delete({
          ...args,
          where: {
            ...args.where,
            tenantId: this.context.tenantId,
          },
        });
      },
      count: (args?: any) => {
        return this.prisma.user.count({
          ...args,
          where: {
            ...args?.where,
            tenantId: this.context.tenantId,
          },
        });
      },
    };
  }

  // Tenant-scoped note operations
  get note() {
    return {
      findMany: (args?: any) => {
        return this.prisma.note.findMany({
          ...args,
          where: {
            ...args?.where,
            tenantId: this.context.tenantId,
          },
        });
      },
      findUnique: (args: any) => {
        return this.prisma.note.findUnique({
          ...args,
          where: {
            ...args.where,
            tenantId: this.context.tenantId,
          },
        });
      },
      findFirst: (args?: any) => {
        return this.prisma.note.findFirst({
          ...args,
          where: {
            ...args?.where,
            tenantId: this.context.tenantId,
          },
        });
      },
      create: (args: any) => {
        return this.prisma.note.create({
          ...args,
          data: {
            ...args.data,
            tenantId: this.context.tenantId,
            userId: this.context.userId, // Ensure note belongs to current user
          },
        });
      },
      update: (args: any) => {
        return this.prisma.note.update({
          ...args,
          where: {
            ...args.where,
            tenantId: this.context.tenantId,
          },
        });
      },
      delete: (args: any) => {
        return this.prisma.note.delete({
          ...args,
          where: {
            ...args.where,
            tenantId: this.context.tenantId,
          },
        });
      },
      count: (args?: any) => {
        return this.prisma.note.count({
          ...args,
          where: {
            ...args?.where,
            tenantId: this.context.tenantId,
          },
        });
      },
    };
  }

  // Tenant operations (only for current tenant)
  get tenant() {
    return {
      findUnique: () => {
        return this.prisma.tenant.findUnique({
          where: {
            id: this.context.tenantId,
          },
        });
      },
      update: (args: any) => {
        // Only allow updating current tenant
        return this.prisma.tenant.update({
          ...args,
          where: {
            id: this.context.tenantId,
          },
        });
      },
    };
  }

  // Get the current tenant context
  getContext(): TenantContext {
    return { ...this.context };
  }

  // Validate that a resource belongs to the current tenant
  async validateTenantOwnership(resourceType: 'user' | 'note', resourceId: string): Promise<boolean> {
    try {
      let resource;
      
      switch (resourceType) {
        case 'user':
          resource = await this.prisma.user.findUnique({
            where: { id: resourceId },
            select: { tenantId: true },
          });
          break;
        case 'note':
          resource = await this.prisma.note.findUnique({
            where: { id: resourceId },
            select: { tenantId: true },
          });
          break;
        default:
          return false;
      }

      return resource?.tenantId === this.context.tenantId;
    } catch (error) {
      console.error('Error validating tenant ownership:', error);
      return false;
    }
  }

  // Check if current user owns a specific note
  async validateNoteOwnership(noteId: string): Promise<boolean> {
    try {
      const note = await this.prisma.note.findUnique({
        where: { id: noteId },
        select: { tenantId: true, userId: true },
      });

      return note?.tenantId === this.context.tenantId && note?.userId === this.context.userId;
    } catch (error) {
      console.error('Error validating note ownership:', error);
      return false;
    }
  }
}

// Helper function to create tenant-scoped Prisma client
export function createTenantScopedPrisma(prisma: PrismaClient, context: TenantContext): TenantScopedPrisma {
  return new TenantScopedPrisma(prisma, context);
}

// Validate tenant slug format
export function isValidTenantSlug(slug: string): boolean {
  // Tenant slug should be lowercase alphanumeric with hyphens
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug) && slug.length >= 2 && slug.length <= 50;
}

// Extract tenant slug from various URL patterns
export function extractTenantSlugFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    
    // Look for tenant slug in different URL patterns:
    // /api/tenants/[slug]/...
    // /tenants/[slug]/...
    const tenantIndex = pathSegments.indexOf('tenants');
    if (tenantIndex !== -1 && tenantIndex + 1 < pathSegments.length) {
      const slug = pathSegments[tenantIndex + 1];
      return isValidTenantSlug(slug) ? slug : null;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}