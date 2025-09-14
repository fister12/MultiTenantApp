/**
 * Example implementations showing how to use tenant context and isolation middleware
 * in API routes. These examples demonstrate best practices for tenant-aware operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withTenantValidation, withRole, AuthenticatedRequest } from './middleware';
import { createTenantAwareDb } from './db-helpers';

// Example 1: Basic tenant-scoped notes listing
export const getNotesHandler = withTenantValidation(async (req: AuthenticatedRequest) => {
  try {
    const tenantDb = createTenantAwareDb(req.tenantContext!);
    
    // All notes are automatically scoped to the current tenant
    const notes = await tenantDb.db.note.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { email: true, role: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notes' } },
      { status: 500 }
    );
  }
});

// Example 2: Note creation with subscription limit validation
export const createNoteHandler = withTenantValidation(async (req: AuthenticatedRequest) => {
  try {
    const tenantDb = createTenantAwareDb(req.tenantContext!);
    const body = await req.json();

    // Validate input
    if (!body.title || !body.content) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Title and content are required' } },
        { status: 400 }
      );
    }

    // Check subscription limits
    const limitCheck = await tenantDb.checkNoteLimit();
    if (!limitCheck.canCreate) {
      return NextResponse.json(
        { 
          error: { 
            code: 'SUBSCRIPTION_LIMIT_EXCEEDED', 
            message: `Note limit reached. Current plan allows ${limitCheck.limit} notes.`,
            details: { currentCount: limitCheck.currentCount, limit: limitCheck.limit }
          } 
        },
        { status: 403 }
      );
    }

    // Create note (automatically scoped to tenant and user)
    const note = await tenantDb.db.note.create({
      data: {
        title: body.title,
        content: body.content,
      },
      include: {
        user: {
          select: { email: true, role: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: note,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create note' } },
      { status: 500 }
    );
  }
});

// Example 3: Note update with ownership validation
export const updateNoteHandler = withTenantValidation(async (req: AuthenticatedRequest) => {
  try {
    const tenantDb = createTenantAwareDb(req.tenantContext!);
    const url = new URL(req.url);
    const noteId = url.pathname.split('/').pop();
    const body = await req.json();

    if (!noteId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Note ID is required' } },
        { status: 400 }
      );
    }

    // Validate note ownership (ensures note belongs to current user and tenant)
    const hasAccess = await tenantDb.validateNoteAccess(noteId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Note not found or access denied' } },
        { status: 404 }
      );
    }

    // Update note (automatically scoped to tenant)
    const updatedNote = await tenantDb.db.note.update({
      where: { id: noteId },
      data: {
        title: body.title,
        content: body.content,
      },
      include: {
        user: {
          select: { email: true, role: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedNote,
    });
  } catch (error) {
    console.error('Error updating note:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update note' } },
      { status: 500 }
    );
  }
});

// Example 4: Admin-only tenant upgrade
export const upgradeTenantHandler = withRole(['ADMIN'])(
  withTenantValidation(async (req: AuthenticatedRequest) => {
    try {
      const tenantDb = createTenantAwareDb(req.tenantContext!);

      // Upgrade tenant to PRO plan
      await tenantDb.upgradeTenantToPro();

      // Get updated tenant info
      const tenant = await tenantDb.getCurrentTenant();

      return NextResponse.json({
        success: true,
        data: {
          message: 'Tenant upgraded to PRO plan successfully',
          tenant: {
            slug: tenant?.slug,
            plan: tenant?.plan,
          },
        },
      });
    } catch (error) {
      console.error('Error upgrading tenant:', error);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to upgrade tenant' } },
        { status: 500 }
      );
    }
  })
);

// Example 5: Tenant statistics (admin only)
export const getTenantStatsHandler = withRole(['ADMIN'])(
  withTenantValidation(async (req: AuthenticatedRequest) => {
    try {
      const tenantDb = createTenantAwareDb(req.tenantContext!);
      const stats = await tenantDb.getTenantStats();

      return NextResponse.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error fetching tenant stats:', error);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tenant statistics' } },
        { status: 500 }
      );
    }
  })
);

// Example 6: Cross-tenant access prevention demonstration
export const attemptCrossTenantAccess = withTenantValidation(async (req: AuthenticatedRequest) => {
  try {
    const tenantDb = createTenantAwareDb(req.tenantContext!);
    
    // This will automatically fail if trying to access notes from another tenant
    // because all queries are scoped to the current tenant
    const notes = await tenantDb.db.note.findMany();
    
    // Even if someone tries to manually specify a different tenant ID in the query,
    // the tenant-scoped Prisma client will override it with the correct tenant ID
    
    return NextResponse.json({
      success: true,
      data: notes,
      message: 'Only notes from your tenant are returned',
    });
  } catch (error) {
    console.error('Error in cross-tenant access example:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch data' } },
      { status: 500 }
    );
  }
});

// Example 7: Resource validation before operations
export const validateResourceHandler = withTenantValidation(async (req: AuthenticatedRequest) => {
  try {
    const tenantDb = createTenantAwareDb(req.tenantContext!);
    const url = new URL(req.url);
    const resourceId = url.searchParams.get('resourceId');
    const resourceType = url.searchParams.get('type') as 'user' | 'note';

    if (!resourceId || !resourceType) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Resource ID and type are required' } },
        { status: 400 }
      );
    }

    // Validate that the resource belongs to the current tenant
    const hasAccess = await tenantDb.validateResourceAccess(resourceType, resourceId);

    return NextResponse.json({
      success: true,
      data: {
        resourceId,
        resourceType,
        hasAccess,
        tenantSlug: req.tenantContext!.tenantSlug,
      },
    });
  } catch (error) {
    console.error('Error validating resource:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to validate resource' } },
      { status: 500 }
    );
  }
});

/**
 * Usage in actual API route files:
 * 
 * // app/api/notes/route.ts
 * export const GET = getNotesHandler;
 * export const POST = createNoteHandler;
 * 
 * // app/api/notes/[id]/route.ts
 * export const PUT = updateNoteHandler;
 * 
 * // app/api/tenants/[slug]/upgrade/route.ts
 * export const POST = upgradeTenantHandler;
 * 
 * // app/api/admin/stats/route.ts
 * export const GET = getTenantStatsHandler;
 */