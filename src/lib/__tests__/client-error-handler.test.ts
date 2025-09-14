import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseApiError,
  getUserFriendlyMessage,
  formatErrorForDisplay,
  apiRequest,
  createAuthenticatedApiRequest,
  handleComponentError,
  extractValidationErrors,
  retryApiRequest,
} from '../client-error-handler';

// Mock fetch
global.fetch = vi.fn();

describe('Client Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('parseApiError', () => {
    it('should parse API error response', () => {
      const apiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: { field: 'email' },
        },
      };

      const result = parseApiError(apiResponse);
      expect(result.code).toBe('VALIDATION_ERROR');
      expect(result.message).toBe('Invalid input');
      expect(result.details).toEqual({ field: 'email' });
    });

    it('should handle fetch errors', () => {
      const fetchError = new TypeError('Failed to fetch');
      const result = parseApiError(fetchError);

      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.message).toBe('Network connection failed');
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');
      const result = parseApiError(genericError);

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('Something went wrong');
    });

    it('should handle unknown error types', () => {
      const unknownError = 'string error';
      const result = parseApiError(unknownError);

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('An unexpected error occurred');
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly message for known codes', () => {
      const error = { code: 'UNAUTHORIZED', message: 'Token invalid' };
      const result = getUserFriendlyMessage(error);

      expect(result).toBe('Please log in to continue.');
    });

    it('should return original message if user-friendly', () => {
      const error = { code: 'UNKNOWN_CODE', message: 'Please try again later' };
      const result = getUserFriendlyMessage(error);

      expect(result).toBe('Please try again later');
    });

    it('should return fallback for technical messages', () => {
      const error = { code: 'UNKNOWN_CODE', message: 'Prisma database connection failed' };
      const result = getUserFriendlyMessage(error);

      expect(result).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('formatErrorForDisplay', () => {
    it('should format error with default config', () => {
      const error = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'email' },
      };

      const result = formatErrorForDisplay(error);
      expect(result.message).toBe('Please check your input and try again.');
      expect(result.code).toBeUndefined();
      expect(result.details).toBeUndefined();
    });

    it('should include code and details when configured', () => {
      const error = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'email' },
      };

      const result = formatErrorForDisplay(error, {
        showCode: true,
        showDetails: true,
      });

      expect(result.code).toBe('VALIDATION_ERROR');
      expect(result.details).toEqual({ field: 'email' });
    });
  });

  describe('apiRequest', () => {
    it('should make successful API request', async () => {
      const mockData = { id: '123', name: 'Test' };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: mockData,
        }),
      };

      (fetch as any).mockResolvedValue(mockResponse);

      const result = await apiRequest('/api/test');
      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith('/api/test', {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should handle API error response', async () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
      };
      
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue(errorResponse),
      };

      (fetch as any).mockResolvedValue(mockResponse);

      await expect(apiRequest('/api/test')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Resource not found',
      });
    });

    it('should handle network errors', async () => {
      (fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(apiRequest('/api/test')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    it('should handle abort errors', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      (fetch as any).mockRejectedValue(abortError);

      await expect(apiRequest('/api/test')).rejects.toMatchObject({
        code: 'REQUEST_CANCELLED',
      });
    });
  });

  describe('createAuthenticatedApiRequest', () => {
    it('should add authorization header', async () => {
      const mockToken = 'test-token';
      const getToken = vi.fn().mockReturnValue(mockToken);
      const authenticatedRequest = createAuthenticatedApiRequest(getToken);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { message: 'success' },
        }),
      };

      (fetch as any).mockResolvedValue(mockResponse);

      await authenticatedRequest('/api/protected');

      const callArgs = (fetch as any).mock.calls[0];
      expect(callArgs[0]).toBe('/api/protected');
      expect(callArgs[1].headers.Authorization).toBe(`Bearer ${mockToken}`);
      // The Content-Type is added by the base apiRequest function
      expect(callArgs[1].headers).toHaveProperty('Authorization', `Bearer ${mockToken}`);
    });

    it('should throw error when no token available', async () => {
      const getToken = vi.fn().mockReturnValue(null);
      const authenticatedRequest = createAuthenticatedApiRequest(getToken);

      await expect(authenticatedRequest('/api/protected')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });

  describe('handleComponentError', () => {
    it('should handle and log component errors', () => {
      const error = new Error('Component error');
      const result = handleComponentError(error, 'TestComponent');

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('Component error');
      expect(console.error).toHaveBeenCalledWith('Error in TestComponent:', error);
    });
  });

  describe('extractValidationErrors', () => {
    it('should extract field errors from validation error', () => {
      const error = {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          issues: [
            { field: 'email', message: 'Invalid email' },
            { path: ['password'], message: 'Too short' },
          ],
        },
      };

      const result = extractValidationErrors(error);
      expect(result).toEqual({
        email: 'Invalid email',
        password: 'Too short',
      });
    });

    it('should return empty object for non-validation errors', () => {
      const error = {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      };

      const result = extractValidationErrors(error);
      expect(result).toEqual({});
    });
  });

  describe('retryApiRequest', () => {
    it('should retry failed requests', async () => {
      const mockRequest = vi.fn()
        .mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
        .mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
        .mockResolvedValueOnce('success');

      const result = await retryApiRequest(mockRequest, 3, 10);
      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(3);
    });

    it('should not retry certain error types', async () => {
      // Create an error that will be parsed as UNAUTHORIZED
      const unauthorizedError = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized access',
        },
      };
      const mockRequest = vi.fn().mockRejectedValue(unauthorizedError);

      try {
        await retryApiRequest(mockRequest, 3, 10);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toMatchObject({ code: 'UNAUTHORIZED' });
      }
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should throw last error after max retries', async () => {
      // Create an error that will be parsed as NETWORK_ERROR
      const networkError = new TypeError('Failed to fetch');
      const mockRequest = vi.fn().mockRejectedValue(networkError);

      try {
        await retryApiRequest(mockRequest, 2, 10);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toMatchObject({ code: 'NETWORK_ERROR' });
      }
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });
  });
});