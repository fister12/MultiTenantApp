import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createTenantAwareDb } from '@/lib/db-helpers';
import { JWTPayload } from '@/types';

// Mock dependencies
vi.mock('@/lib/db-helpers');
vi.mock('@/lib/middleware', () => ({
  withSecureMemberRole: (handler: any) => handler,
  withSecureAdminRole: (handler: any) => handler,
  withMemberRole: (handler: any) => handler,
  withAdminRole: (handler: any) => handler,
  AuthenticatedRequest: {},
}));

const mockCreateTenantAwareDb = vi.mocked(createTenantAwareDb);

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

function createMockRequest(
  method: string,
  noteId: string,
  body?: any
): MockAuthenticatedRequest {
  const url = new URL(`http://localhost:3000/api/notes/${noteId}`);

  const req = new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer valid-token',
    },
  }) as MockAuthenticatedRequest;

  req.user = {
    userId: 'user-1',
    email: 'user@acme.test',
    role: 'MEMBER',
    tenantId: 'tenant-1',
    tenantSlug: 'acme',
  };

  req.tenantContext = {
    tenantId: 'tenant-1',
    tenantSlug: 'acme',
    userId: 'user-1',
    userRole: 'MEMBER',
  };

  return req;
}

describe('/api/notes/[id]', () => {
  const validNoteId = 'note-1234567890';
  const mockTenantDb = {
    validateResourceAccess: vi.fn(),
    validateNoteAccess: vi.fn(),
    db: {
      note: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTenantAwareDb.mockReturnValue(mockTenantDb as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/notes/[id]', () => {
    it('should retrieve a note successfully', async () => {
      // Arrange
      const mockNote = {
        id: validNoteId,
        title: 'Test Note',
        content: 'Test content',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        userId: 'user-1',
        user: { email: 'user@acme.test' },
      };

      mockTenantDb.validateResourceAccess.mockResolvedValue(true);
      mockTenantDb.db.note.findUnique.mockResolvedValue(mockNote);

      const req = createMockRequest('GET', validNoteId);

      // Act
      const { GET } = await import('../route');
      const response = await GET(req, { params: { id: validNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNote);
      expect(mockTenantDb.validateResourceAccess).toHaveBeenCalledWith('note', validNoteId);
    });

    it('should return 404 for non-existent note', async () => {
      // Arrange
      mockTenantDb.validateResourceAccess.mockResolvedValue(false);

      const req = createMockRequest('GET', validNoteId);

      // Act
      const { GET } = await import('../route');
      const response = await GET(req, { params: { id: validNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(result.error.message).toBe('Note not found or access denied');
    });

    it('should validate note ID format', async () => {
      // Arrange
      const invalidNoteId = 'x'; // Too short to pass validation
      const req = createMockRequest('GET', invalidNoteId);

      // Act
      const { GET } = await import('../route');
      const response = await GET(req, { params: { id: invalidNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Invalid note ID format');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockTenantDb.validateResourceAccess.mockRejectedValue(new Error('Database error'));

      const req = createMockRequest('GET', validNoteId);

      // Act
      const { GET } = await import('../route');
      const response = await GET(req, { params: { id: validNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PUT /api/notes/[id]', () => {
    it('should update a note successfully', async () => {
      // Arrange
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content',
      };

      const updatedNote = {
        id: validNoteId,
        title: updateData.title,
        content: updateData.content,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        userId: 'user-1',
      };

      mockTenantDb.validateNoteAccess.mockResolvedValue(true);
      mockTenantDb.db.note.findFirst.mockResolvedValue({ id: validNoteId });
      mockTenantDb.db.note.update.mockResolvedValue(updatedNote);

      const req = createMockRequest('PUT', validNoteId, updateData);

      // Act
      const { PUT } = await import('../route');
      const response = await PUT(req, { params: { id: validNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedNote);
      expect(mockTenantDb.validateNoteAccess).toHaveBeenCalledWith(validNoteId);
      expect(mockTenantDb.db.note.update).toHaveBeenCalledWith({
        where: { id: validNoteId },
        data: {
          title: updateData.title,
          content: updateData.content,
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
    });

    it('should update only provided fields', async () => {
      // Arrange
      const updateData = {
        title: 'Updated Title Only',
      };

      const updatedNote = {
        id: validNoteId,
        title: updateData.title,
        content: 'Original content',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        userId: 'user-1',
      };

      mockTenantDb.validateNoteAccess.mockResolvedValue(true);
      mockTenantDb.db.note.findFirst.mockResolvedValue({ id: validNoteId });
      mockTenantDb.db.note.update.mockResolvedValue(updatedNote);

      const req = createMockRequest('PUT', validNoteId, updateData);

      // Act
      const { PUT } = await import('../route');
      const response = await PUT(req, { params: { id: validNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(mockTenantDb.db.note.update).toHaveBeenCalledWith({
        where: { id: validNoteId },
        data: {
          title: updateData.title,
        },
        select: expect.any(Object),
      });
    });

    it('should return 404 for non-existent or unauthorized note', async () => {
      // Arrange
      const updateData = {
        title: 'Updated Title',
      };

      mockTenantDb.validateNoteAccess.mockResolvedValue(false);

      const req = createMockRequest('PUT', validNoteId, updateData);

      // Act
      const { PUT } = await import('../route');
      const response = await PUT(req, { params: { id: validNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(result.error.message).toBe('Note not found or access denied');
    });

    it('should validate input data', async () => {
      // Arrange
      const invalidUpdateData = {
        title: '', // Empty title should be invalid
      };

      const req = createMockRequest('PUT', validNoteId, invalidUpdateData);

      // Act
      const { PUT } = await import('../route');
      const response = await PUT(req, { params: { id: validNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require at least one field for update', async () => {
      // Arrange
      const emptyUpdateData = {};

      const req = createMockRequest('PUT', validNoteId, emptyUpdateData);

      // Act
      const { PUT } = await import('../route');
      const response = await PUT(req, { params: { id: validNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate note ID format', async () => {
      // Arrange
      const invalidNoteId = 'x'; // Too short to pass validation
      const updateData = { title: 'Updated Title' };
      const req = createMockRequest('PUT', invalidNoteId, updateData);

      // Act
      const { PUT } = await import('../route');
      const response = await PUT(req, { params: { id: invalidNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Invalid note ID format');
    });
  });

  describe('DELETE /api/notes/[id]', () => {
    it('should delete a note successfully', async () => {
      // Arrange
      const existingNote = {
        id: validNoteId,
        title: 'Note to Delete',
      };

      mockTenantDb.validateNoteAccess.mockResolvedValue(true);
      mockTenantDb.db.note.findFirst.mockResolvedValue(existingNote);
      mockTenantDb.db.note.delete.mockResolvedValue(undefined);

      const req = createMockRequest('DELETE', validNoteId);

      // Act
      const { DELETE } = await import('../route');
      const response = await DELETE(req, { params: { id: validNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Note deleted successfully');
      expect(result.data.deletedNote).toEqual(existingNote);
      expect(mockTenantDb.validateNoteAccess).toHaveBeenCalledWith(validNoteId);
      expect(mockTenantDb.db.note.delete).toHaveBeenCalledWith({
        where: { id: validNoteId },
      });
    });

    it('should return 404 for non-existent or unauthorized note', async () => {
      // Arrange
      mockTenantDb.validateNoteAccess.mockResolvedValue(false);

      const req = createMockRequest('DELETE', validNoteId);

      // Act
      const { DELETE } = await import('../route');
      const response = await DELETE(req, { params: { id: validNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(result.error.message).toBe('Note not found or access denied');
    });

    it('should validate note ID format', async () => {
      // Arrange
      const invalidNoteId = 'x'; // Too short to pass validation
      const req = createMockRequest('DELETE', invalidNoteId);

      // Act
      const { DELETE } = await import('../route');
      const response = await DELETE(req, { params: { id: invalidNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Invalid note ID format');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockTenantDb.validateNoteAccess.mockRejectedValue(new Error('Database error'));

      const req = createMockRequest('DELETE', validNoteId);

      // Act
      const { DELETE } = await import('../route');
      const response = await DELETE(req, { params: { id: validNoteId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INTERNAL_ERROR');
    });
  });
});