import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiResponse } from '@/types';

// Import Prisma types safely
let Prisma: any;
try {
  Prisma = require('@prisma/client').Prisma;
} catch {
  // Fallback for testing or when Prisma is not available
  Prisma = {
    PrismaClientKnownRequestError: class {},
    PrismaClientValidationError: class {},
    PrismaClientInitializationError: class {},
  };
}

// Standard error codes
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Resources
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  
  // Tenant & Subscription
  TENANT_ISOLATION_VIOLATION = 'TENANT_ISOLATION_VIOLATION',
  SUBSCRIPTION_LIMIT_EXCEEDED = 'SUBSCRIPTION_LIMIT_EXCEEDED',
  INVALID_TENANT = 'INVALID_TENANT',
  
  // Rate Limiting & Security
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  REQUEST_TOO_LARGE = 'REQUEST_TOO_LARGE',
  INVALID_CONTENT_TYPE = 'INVALID_CONTENT_TYPE',
  
  // Server Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

// Error details interface
export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

// Custom application error class
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Predefined error creators
export const createError = {
  unauthorized: (message = 'Authentication required'): AppError =>
    new AppError(ErrorCode.UNAUTHORIZED, message, 401),
    
  forbidden: (message = 'Insufficient permissions'): AppError =>
    new AppError(ErrorCode.FORBIDDEN, message, 403),
    
  notFound: (resource = 'Resource', message?: string): AppError =>
    new AppError(
      ErrorCode.RESOURCE_NOT_FOUND,
      message || `${resource} not found`,
      404
    ),
    
  validation: (message = 'Invalid input data', details?: Record<string, unknown>): AppError =>
    new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details),
    
  tenantIsolation: (message = 'Access denied: tenant isolation violation'): AppError =>
    new AppError(ErrorCode.TENANT_ISOLATION_VIOLATION, message, 403),
    
  subscriptionLimit: (message = 'Subscription limit exceeded', details?: Record<string, unknown>): AppError =>
    new AppError(ErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED, message, 403, details),
    
  rateLimit: (message = 'Rate limit exceeded'): AppError =>
    new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429),
    
  internal: (message = 'Internal server error'): AppError =>
    new AppError(ErrorCode.INTERNAL_SERVER_ERROR, message, 500),
    
  database: (message = 'Database operation failed'): AppError =>
    new AppError(ErrorCode.DATABASE_ERROR, message, 500),
};

// Error handler function
export function handleError(error: unknown): ErrorDetails {
  // Log the error for debugging
  console.error('Error occurred:', error);

  // Handle known AppError instances
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid input data',
      statusCode: 400,
      details: {
        issues: error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    };
  }

  // Handle Prisma errors by checking error name and properties
  if (error && typeof error === 'object' && 'name' in error) {
    const errorObj = error as any;
    
    if (errorObj.name === 'PrismaClientKnownRequestError' && 'code' in errorObj) {
      switch (errorObj.code) {
        case 'P2002':
          return {
            code: ErrorCode.RESOURCE_ALREADY_EXISTS,
            message: 'Resource already exists',
            statusCode: 409,
            details: { field: errorObj.meta?.target },
          };
        case 'P2025':
          return {
            code: ErrorCode.RESOURCE_NOT_FOUND,
            message: 'Resource not found',
            statusCode: 404,
          };
        case 'P2003':
          return {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Foreign key constraint violation',
            statusCode: 400,
          };
        default:
          return {
            code: ErrorCode.DATABASE_ERROR,
            message: 'Database operation failed',
            statusCode: 500,
            details: { prismaCode: errorObj.code },
          };
      }
    }

    if (errorObj.name === 'PrismaClientValidationError') {
      return {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid database query',
        statusCode: 400,
      };
    }

    if (errorObj.name === 'PrismaClientInitializationError') {
      return {
        code: ErrorCode.DATABASE_ERROR,
        message: 'Database connection failed',
        statusCode: 500,
      };
    }
  }

  // Handle JWT errors
  if (error instanceof Error) {
    if (error.name === 'JsonWebTokenError') {
      return {
        code: ErrorCode.INVALID_TOKEN,
        message: 'Invalid token',
        statusCode: 401,
      };
    }
    if (error.name === 'TokenExpiredError') {
      return {
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'Token expired',
        statusCode: 401,
      };
    }
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: error.message || 'An unexpected error occurred',
      statusCode: 500,
    };
  }

  // Fallback for unknown error types
  return {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    message: 'An unexpected error occurred',
    statusCode: 500,
  };
}

// Create standardized error response
export function createErrorResponse<T = never>(error: unknown): NextResponse<ApiResponse<T>> {
  const errorDetails = handleError(error);
  
  return NextResponse.json(
    {
      success: false,
      error: {
        code: errorDetails.code,
        message: errorDetails.message,
        details: errorDetails.details,
      },
    },
    { status: errorDetails.statusCode }
  );
}

// Success response helper
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status: statusCode }
  );
}

// Async error wrapper for API handlers
export function withErrorHandling<T extends unknown[], R>(
  handler: (...args: T) => Promise<NextResponse<ApiResponse<R>>>
) {
  return async (...args: T): Promise<NextResponse<ApiResponse<R>>> => {
    try {
      return await handler(...args);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
}

// Validation helper
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): T {
  if (value === null || value === undefined || value === '') {
    throw createError.validation(`${fieldName} is required`);
  }
  return value;
}

// Input sanitization helpers
export function sanitizeString(input: string, maxLength?: number): string {
  let sanitized = input.trim();
  
  if (maxLength && sanitized.length > maxLength) {
    throw createError.validation(`Input exceeds maximum length of ${maxLength} characters`);
  }
  
  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>]/g, '');
  
  return sanitized;
}

export function validateEmail(email: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createError.validation('Invalid email format');
  }
  return email.toLowerCase();
}

export function validateId(id: string, fieldName = 'ID'): string {
  if (!id || typeof id !== 'string') {
    throw createError.validation(`${fieldName} is required`);
  }
  
  // Validate ID format (alphanumeric, underscore, hyphen, minimum 10 chars)
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) {
    throw createError.validation(`Invalid ${fieldName} format`);
  }
  
  return id;
}