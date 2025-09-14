import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError, z } from 'zod';
import {
  ErrorCode,
  AppError,
  createError,
  handleError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  validateRequired,
  sanitizeString,
  validateEmail,
  validateId,
} from '../error-handler';

// Mock Prisma for testing
const mockPrismaError = {
  PrismaClientKnownRequestError: class {
    code: string;
    meta?: any;
    message: string;
    clientVersion: string;
    
    constructor(message: string, options: { code: string; clientVersion: string; meta?: any }) {
      this.message = message;
      this.code = options.code;
      this.clientVersion = options.clientVersion;
      this.meta = options.meta;
      this.name = 'PrismaClientKnownRequestError';
    }
  },
  PrismaClientValidationError: class {
    message: string;
    constructor(message: string) {
      this.message = message;
      this.name = 'PrismaClientValidationError';
    }
  },
  PrismaClientInitializationError: class {
    message: string;
    constructor(message: string) {
      this.message = message;
      this.name = 'PrismaClientInitializationError';
    }
  },
};

// Mock the Prisma import
vi.mock('@prisma/client', () => ({
  Prisma: mockPrismaError,
}));

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      data,
      status: options?.status || 200,
    })),
  },
}));

describe('Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('AppError', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Test error',
        400,
        { field: 'email' }
      );

      expect(error.name).toBe('AppError');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('createError helpers', () => {
    it('should create unauthorized error', () => {
      const error = createError.unauthorized('Custom message');
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.message).toBe('Custom message');
      expect(error.statusCode).toBe(401);
    });

    it('should create validation error with details', () => {
      const details = { field: 'email', value: 'invalid' };
      const error = createError.validation('Invalid input', details);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual(details);
    });

    it('should create not found error', () => {
      const error = createError.notFound('User');
      expect(error.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('handleError', () => {
    it('should handle AppError instances', () => {
      const appError = createError.forbidden('Access denied');
      const result = handleError(appError);

      expect(result.code).toBe(ErrorCode.FORBIDDEN);
      expect(result.message).toBe('Access denied');
      expect(result.statusCode).toBe(403);
    });

    it('should handle Zod validation errors', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      try {
        schema.parse({ email: 'invalid', age: 15 });
      } catch (zodError) {
        const result = handleError(zodError);
        expect(result.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.message).toBe('Invalid input data');
        expect(result.statusCode).toBe(400);
        expect(result.details?.issues).toBeDefined();
      }
    });

    it('should handle Prisma known request errors', () => {
      const prismaError = {
        name: 'PrismaClientKnownRequestError',
        message: 'Unique constraint failed',
        code: 'P2002',
        clientVersion: '4.0.0',
        meta: { target: ['email'] },
      };

      const result = handleError(prismaError);
      expect(result.code).toBe(ErrorCode.RESOURCE_ALREADY_EXISTS);
      expect(result.message).toBe('Resource already exists');
      expect(result.statusCode).toBe(409);
    });

    it('should handle JWT errors', () => {
      const jwtError = new Error('Invalid token');
      jwtError.name = 'JsonWebTokenError';

      const result = handleError(jwtError);
      expect(result.code).toBe(ErrorCode.INVALID_TOKEN);
      expect(result.message).toBe('Invalid token');
      expect(result.statusCode).toBe(401);
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');
      const result = handleError(genericError);

      expect(result.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(result.message).toBe('Something went wrong');
      expect(result.statusCode).toBe(500);
    });

    it('should handle unknown error types', () => {
      const unknownError = 'string error';
      const result = handleError(unknownError);

      expect(result.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(result.message).toBe('An unexpected error occurred');
      expect(result.statusCode).toBe(500);
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with correct format', () => {
      const error = createError.validation('Invalid input');
      const response = createErrorResponse(error);

      expect(response.data).toEqual({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid input',
          details: undefined,
        },
      });
      expect(response.status).toBe(400);
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response with correct format', () => {
      const data = { id: '123', name: 'Test' };
      const response = createSuccessResponse(data, 201);

      expect(response.data).toEqual({
        success: true,
        data,
      });
      expect(response.status).toBe(201);
    });

    it('should use default status code 200', () => {
      const data = { message: 'Success' };
      const response = createSuccessResponse(data);

      expect(response.status).toBe(200);
    });
  });

  describe('withErrorHandling', () => {
    it('should wrap handler and catch errors', async () => {
      const mockHandler = vi.fn().mockRejectedValue(createError.internal('Test error'));
      const wrappedHandler = withErrorHandling(mockHandler);

      const result = await wrappedHandler('arg1', 'arg2');

      expect(mockHandler).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result.data.success).toBe(false);
      expect(result.data.error?.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    });

    it('should return successful response when no error', async () => {
      const mockResponse = { data: { id: '123' }, status: 200 };
      const mockHandler = vi.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withErrorHandling(mockHandler);

      const result = await wrappedHandler();

      expect(result).toBe(mockResponse);
    });
  });

  describe('validation helpers', () => {
    describe('validateRequired', () => {
      it('should return value if valid', () => {
        expect(validateRequired('test', 'field')).toBe('test');
        expect(validateRequired(123, 'number')).toBe(123);
      });

      it('should throw error for null/undefined/empty', () => {
        expect(() => validateRequired(null, 'field')).toThrow();
        expect(() => validateRequired(undefined, 'field')).toThrow();
        expect(() => validateRequired('', 'field')).toThrow();
      });
    });

    describe('sanitizeString', () => {
      it('should trim and sanitize string', () => {
        expect(sanitizeString('  test  ')).toBe('test');
        expect(sanitizeString('test<script>alert()</script>')).toBe('testscriptalert()/script');
      });

      it('should enforce max length', () => {
        expect(() => sanitizeString('toolong', 3)).toThrow();
      });
    });

    describe('validateEmail', () => {
      it('should validate and normalize email', () => {
        expect(validateEmail('Test@Example.COM')).toBe('test@example.com');
      });

      it('should throw error for invalid email', () => {
        expect(() => validateEmail('invalid-email')).toThrow();
        expect(() => validateEmail('test@')).toThrow();
      });
    });

    describe('validateId', () => {
      it('should validate ID format', () => {
        expect(validateId('abc123def456')).toBe('abc123def456');
        expect(validateId('test_id-123')).toBe('test_id-123');
      });

      it('should throw error for invalid ID', () => {
        expect(() => validateId('short')).toThrow();
        expect(() => validateId('invalid@id')).toThrow();
        expect(() => validateId('')).toThrow();
      });
    });
  });
});