import { NextRequest, NextResponse } from 'next/server';
import { withSecureMemberRole, AuthenticatedRequest } from '@/lib/middleware';
import { createTenantAwareDb } from '@/lib/db-helpers';
import { 
  withErrorHandling, 
  createSuccessResponse, 
  createError,
  validateId,
  sanitizeString 
} from '@/lib/error-handler';
import { 
  updateNoteSchema, 
  noteIdSchema, 
  validateRequestBody, 
  validatePathParams 
} from '@/lib/validation';

/**
 * GET /api/notes/[id] - Retrieve a specific note
 * Requirements: 4.3, 4.6
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withSecureMemberRole(withErrorHandling(async (authReq: AuthenticatedRequest): Promise<NextResponse> => {
    const tenantContext = authReq.tenantContext!;
    const { id: noteId } = await params;
    
    // Validate note ID format
    const validatedParams = validatePathParams(noteIdSchema, { id: noteId });
    const validNoteId = validateId(validatedParams.id, 'Note ID');
    
    // Create tenant-aware database client
    const tenantDb = createTenantAwareDb(tenantContext);
    
    // Validate note exists and belongs to tenant
    const noteExists = await tenantDb.validateResourceAccess('note', validNoteId);
    if (!noteExists) {
      throw createError.notFound('Note', 'Note not found or access denied');
    }
    
    // Fetch the note with tenant isolation
    const note = await tenantDb.db.note.findUnique({
      where: { id: validNoteId },
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
    });
    
    if (!note) {
      throw createError.notFound('Note');
    }
    
    return createSuccessResponse(note);
  }))(req);
}

/**
 * PUT /api/notes/[id] - Update a specific note
 * Requirements: 4.4, 4.6
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withSecureMemberRole(withErrorHandling(async (authReq: AuthenticatedRequest): Promise<NextResponse> => {
    const user = authReq.user!;
    const tenantContext = authReq.tenantContext!;
    const { id: noteId } = await params;
    
    // Validate note ID format
    const validatedParams = validatePathParams(noteIdSchema, { id: noteId });
    const validNoteId = validateId(validatedParams.id, 'Note ID');
    
    // Parse and validate request body
    const body = await authReq.json();
    const validatedData = validateRequestBody(updateNoteSchema, body);
    
    // Sanitize input data
    const updateData: { title?: string; content?: string } = {};
    if (validatedData.title) {
      updateData.title = sanitizeString(validatedData.title, 200);
    }
    if (validatedData.content) {
      updateData.content = sanitizeString(validatedData.content, 10000);
    }
    
    // Create tenant-aware database client
    const tenantDb = createTenantAwareDb(tenantContext);
    
    // Validate note ownership (user can only update their own notes)
    const noteOwnership = await tenantDb.validateNoteAccess(validNoteId);
    if (!noteOwnership) {
      throw createError.notFound('Note', 'Note not found or access denied');
    }
    
    // Check if note exists and belongs to the current user
    const existingNote = await tenantDb.db.note.findFirst({
      where: {
        id: validNoteId,
        userId: user.userId,
      },
      select: { id: true },
    });
    
    if (!existingNote) {
      throw createError.notFound('Note', 'Note not found or you do not have permission to update it');
    }
    
    // Update the note
    const updatedNote = await tenantDb.db.note.update({
      where: { id: validNoteId },
      data: updateData,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
      },
    });
    
    return createSuccessResponse(updatedNote);
  }))(req);
}

/**
 * DELETE /api/notes/[id] - Delete a specific note
 * Requirements: 4.5, 4.6
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withSecureMemberRole(withErrorHandling(async (authReq: AuthenticatedRequest): Promise<NextResponse> => {
    const user = authReq.user!;
    const tenantContext = authReq.tenantContext!;
    const { id: noteId } = await params;
    
    // Validate note ID format
    const validatedParams = validatePathParams(noteIdSchema, { id: noteId });
    const validNoteId = validateId(validatedParams.id, 'Note ID');
    
    // Create tenant-aware database client
    const tenantDb = createTenantAwareDb(tenantContext);
    
    // Validate note ownership (user can only delete their own notes)
    const noteOwnership = await tenantDb.validateNoteAccess(validNoteId);
    if (!noteOwnership) {
      throw createError.notFound('Note', 'Note not found or access denied');
    }
    
    // Check if note exists and belongs to the current user
    const existingNote = await tenantDb.db.note.findFirst({
      where: {
        id: validNoteId,
        userId: user.userId,
      },
      select: { id: true, title: true },
    });
    
    if (!existingNote) {
      throw createError.notFound('Note', 'Note not found or you do not have permission to delete it');
    }
    
    // Delete the note
    await tenantDb.db.note.delete({
      where: { id: validNoteId },
    });
    
    return createSuccessResponse({
      message: 'Note deleted successfully',
      deletedNote: {
        id: existingNote.id,
        title: existingNote.title,
      },
    });
  }))(req);
}