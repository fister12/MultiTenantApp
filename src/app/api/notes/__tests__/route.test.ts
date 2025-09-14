import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createTenantAwareDb } from '@/lib/db-helpers';
import { validateNoteCreationLimit } from '@/lib/subscription';
import { JWTPayload } from '@/types';

// Mock dependencies
vi.mock('@/lib/db-helpers');
vi.mock('@/lib/subscription');
vi.mock('@/lib/middleware', () => ({
  withSecureMemberRole: (handler: any) => handler,
  withSecureAdminRole: (handler: any) => handler,
  withMemberRole: (handler: any) => handler,
  withAdminRole: (handler: any) => handler,
  AuthenticatedRequest: {},
}));

const mockCreateTenantAwareDb = vi.mocked(createTenantAwareDb);
const mockValidateNoteCreationLimit = vi.mocked(validateNoteCreationLimit);

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
  body?: any,
  searchParams?: Record<string, string>
): MockAuthenticatedRequest {
  const url = new URL('http://localhost:3000/api/notes');
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

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

describe('/api/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/notes', () => {
    const mockTenantDb = {
      db: {
        note: {
          create: vi.fn(),
        },
      },
    };

    beforeEach(() => {
      mockCreateTenantAwareDb.mockReturnValue(mockTenantDb as any);
    });

    it('should create a note successfully', async () => {
      // Arrange
      const noteData = {
        title: 'Test Note',
        content: 'This is a test note content',
      };

      const createdNote = {
        id: 'note-1',
        title: noteData.title,
        content: noteData.content,
        createdAt: '2025-09-13T11:52:30.349Z',
        updatedAt: '2025-09-13T11:52:30.349Z',
        userId: 'user-1',
      };

      mockValidateNoteCreationLimit.mockResolvedValue({
        isValid: true,
        currentCount: 1,
        limit: 3,
      });

      mockTenantDb.db.note.create.mockResolvedValue(createdNote);

      const req = createMockRequest('POST', noteData);

      // Act
      const { POST } = await import('../route');
      const response = await POST(req);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(createdNote);
      expect(mockValidateNoteCreationLimit).toHaveBeenCalledWith(req.tenantContext);
      expect(mockTenantDb.db.note.create).toHaveBeenCalledWith({
        data: {
          title: noteData.title,
          content: noteData.content,
          userId: 'user-1',
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

    it('should reject note creation when subscription limit is exceeded', async () => {
      // Arrange
      const noteData = {
        title: 'Test Note',
        content: 'This is a test note content',
      };

      mockValidateNoteCreationLimit.mockResolvedValue({
        isValid: false,
        reason: 'Free plan is limited to 3 notes. Upgrade to Pro for unlimited notes.',
        currentCount: 3,
        limit: 3,
      });

      const req = createMockRequest('POST', noteData);

      // Act
      const { POST } = await import('../route');
      const response = await POST(req);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('SUBSCRIPTION_LIMIT_EXCEEDED');
      expect(result.error.details.currentCount).toBe(3);
      expect(result.error.details.limit).toBe(3);
      expect(mockTenantDb.db.note.create).not.toHaveBeenCalled();
    });

    it('should validate input data and reject invalid requests', async () => {
      // Arrange
      const invalidNoteData = {
        title: '', // Empty title should be invalid
        content: 'Valid content',
      };

      const req = createMockRequest('POST', invalidNoteData);

      // Act
      const { POST } = await import('../route');
      const response = await POST(req);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Invalid input data');
    });

    it('should reject requests with missing required fields', async () => {
      // Arrange
      const incompleteNoteData = {
        title: 'Valid title',
        // Missing content
      };

      const req = createMockRequest('POST', incompleteNoteData);

      // Act
      const { POST } = await import('../route');
      const response = await POST(req);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const noteData = {
        title: 'Test Note',
        content: 'This is a test note content',
      };

      mockValidateNoteCreationLimit.mockResolvedValue({
        isValid: true,
        currentCount: 1,
        limit: 3,
      });

      mockTenantDb.db.note.create.mockRejectedValue(new Error('Database error'));

      const req = createMockRequest('POST', noteData);

      // Act
      const { POST } = await import('../route');
      const response = await POST(req);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/notes', () => {
    const mockTenantDb = {
      db: {
        note: {
          count: vi.fn(),
          findMany: vi.fn(),
        },
      },
    };

    beforeEach(() => {
      mockCreateTenantAwareDb.mockReturnValue(mockTenantDb as any);
    });

    it('should list notes with default pagination', async () => {
      // Arrange
      const mockNotes = [
        {
          id: 'note-1',
          title: 'Note 1',
          content: 'Content 1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          userId: 'user-1',
          user: { email: 'user@acme.test' },
        },
        {
          id: 'note-2',
          title: 'Note 2',
          content: 'Content 2',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          userId: 'user-1',
          user: { email: 'user@acme.test' },
        },
      ];

      mockTenantDb.db.note.count.mockResolvedValue(2);
      mockTenantDb.db.note.findMany.mockResolvedValue(mockNotes);

      const req = createMockRequest('GET');

      // Act
      const { GET } = await import('../route');
      const response = await GET(req);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.notes).toEqual(mockNotes);
      expect(result.data.pagination).toEqual({
        page: 1,
        limit: 10,
        totalCount: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
      expect(result.data.sorting).toEqual({
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('should handle custom pagination parameters', async () => {
      // Arrange
      const mockNotes = [
        {
          id: 'note-1',
          title: 'Note 1',
          content: 'Content 1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          userId: 'user-1',
          user: { email: 'user@acme.test' },
        },
      ];

      mockTenantDb.db.note.count.mockResolvedValue(15);
      mockTenantDb.db.note.findMany.mockResolvedValue(mockNotes);

      const req = createMockRequest('GET', undefined, {
        page: '2',
        limit: '5',
        sortBy: 'title',
        sortOrder: 'asc',
      });

      // Act
      const { GET } = await import('../route');
      const response = await GET(req);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.pagination).toEqual({
        page: 2,
        limit: 5,
        totalCount: 15,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
      expect(result.data.sorting).toEqual({
        sortBy: 'title',
        sortOrder: 'asc',
      });
      expect(mockTenantDb.db.note.findMany).toHaveBeenCalledWith({
        select: expect.any(Object),
        orderBy: { title: 'asc' },
        skip: 5, // (page 2 - 1) * limit 5
        take: 5,
      });
    });

    it('should validate pagination parameters', async () => {
      // Arrange
      const req = createMockRequest('GET', undefined, {
        page: '0', // Invalid page
        limit: '5',
      });

      // Act
      const { GET } = await import('../route');
      const response = await GET(req);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Page must be greater than 0');
    });

    it('should validate limit parameters', async () => {
      // Arrange
      const req = createMockRequest('GET', undefined, {
        page: '1',
        limit: '150', // Exceeds maximum limit
      });

      // Act
      const { GET } = await import('../route');
      const response = await GET(req);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Limit must be between 1 and 100');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockTenantDb.db.note.count.mockRejectedValue(new Error('Database error'));

      const req = createMockRequest('GET');

      // Act
      const { GET } = await import('../route');
      const response = await GET(req);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INTERNAL_ERROR');
    });
  });
});