import { NextRequest, NextResponse } from 'next/server';
import { withSecureMemberRole, AuthenticatedRequest } from '@/lib/middleware';
import { createTenantAwareDb } from '@/lib/db-helpers';
import { validateNoteCreationLimit } from '@/lib/subscription';
import { ApiResponse } from '@/types';
import { 
  withErrorHandling, 
  createSuccessResponse, 
  createError,
  sanitizeString 
} from '@/lib/error-handler';
import { 
  createNoteSchema, 
  paginationSchema, 
  validateRequestBody, 
  validateQueryParams 
} from '@/lib/validation';

/**
 * POST /api/notes - Create a new note
 * Requirements: 4.1, 4.7
 */
export const POST = withSecureMemberRole(withErrorHandling(async (req: AuthenticatedRequest) => {
  const user = req.user!;
  const tenantContext = req.tenantContext!;
  
  // Parse and validate request body
  const body = await req.json();
  const validatedData = validateRequestBody(createNoteSchema, body);
  
  // Sanitize input data
  const title = sanitizeString(validatedData.title, 200);
  const content = sanitizeString(validatedData.content, 10000);
  
  // Check subscription limits for Free plan tenants
  const subscriptionValidation = await validateNoteCreationLimit(tenantContext);
  if (!subscriptionValidation.isValid) {
    throw createError.subscriptionLimit(
      subscriptionValidation.reason || 'Note creation limit exceeded',
      {
        currentCount: subscriptionValidation.currentCount,
        limit: subscriptionValidation.limit,
      }
    );
  }
  
  // Create tenant-aware database client
  const tenantDb = createTenantAwareDb(tenantContext);
  
  // Create the note with tenant isolation
  const note = await tenantDb.db.note.create({
    data: {
      title,
      content,
      userId: user.userId,
    },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
    },
  });
  
  return createSuccessResponse(note, 201);
}));

/**
 * GET /api/notes - List notes for the current tenant
 * Requirements: 4.2
 */
export const GET = withSecureMemberRole(withErrorHandling(async (req: AuthenticatedRequest) => {
  const tenantContext = req.tenantContext!;
  const { searchParams } = new URL(req.url);
  
  // Parse and validate query parameters
  const queryParams = Object.fromEntries(searchParams.entries());
  const validatedParams = validateQueryParams(paginationSchema, queryParams);
  
  // Create tenant-aware database client
  const tenantDb = createTenantAwareDb(tenantContext);
  
  // Calculate pagination offset
  const offset = (validatedParams.page - 1) * validatedParams.limit;
  
  // Get total count for pagination metadata
  const totalCount = await tenantDb.db.note.count();
  
  // Fetch notes with pagination and sorting
  const notes = await tenantDb.db.note.findMany({
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      user: {
        select: {
          email: true,
        },
      },
    },
    orderBy: {
      [validatedParams.sortBy]: validatedParams.sortOrder,
    },
    skip: offset,
    take: validatedParams.limit,
  });
  
  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / validatedParams.limit);
  const hasNextPage = validatedParams.page < totalPages;
  const hasPreviousPage = validatedParams.page > 1;
  
  return createSuccessResponse({
    notes,
    pagination: {
      page: validatedParams.page,
      limit: validatedParams.limit,
      totalCount,
      totalPages,
      hasNextPage,
      hasPreviousPage,
    },
    sorting: {
      sortBy: validatedParams.sortBy,
      sortOrder: validatedParams.sortOrder,
    },
  });
}));