'use client';

import { ApiResponse } from '@/types';

// Client-side error types
export interface ClientError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode?: number;
}

// Error display configuration
export interface ErrorDisplayConfig {
  showDetails: boolean;
  showCode: boolean;
  fallbackMessage: string;
}

// Default error display configuration
const DEFAULT_ERROR_CONFIG: ErrorDisplayConfig = {
  showDetails: false,
  showCode: false,
  fallbackMessage: 'An unexpected error occurred. Please try again.',
};

// User-friendly error messages
const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  // Authentication & Authorization
  UNAUTHORIZED: 'Please log in to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  INVALID_TOKEN: 'Your session has expired. Please log in again.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  
  // Validation
  VALIDATION_ERROR: 'Please check your input and try again.',
  INVALID_INPUT: 'The information you entered is not valid.',
  MISSING_REQUIRED_FIELD: 'Please fill in all required fields.',
  
  // Resources
  RESOURCE_NOT_FOUND: 'The requested item could not be found.',
  RESOURCE_ALREADY_EXISTS: 'This item already exists.',
  
  // Tenant & Subscription
  TENANT_ISOLATION_VIOLATION: 'Access denied. You can only access your organization\'s data.',
  SUBSCRIPTION_LIMIT_EXCEEDED: 'You have reached your plan limit. Please upgrade to continue.',
  INVALID_TENANT: 'Invalid organization. Please contact support.',
  
  // Rate Limiting & Security
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
  REQUEST_TOO_LARGE: 'The file or data you\'re trying to upload is too large.',
  INVALID_CONTENT_TYPE: 'Invalid file type or format.',
  
  // Server Errors
  INTERNAL_SERVER_ERROR: 'Something went wrong on our end. Please try again later.',
  DATABASE_ERROR: 'We\'re experiencing technical difficulties. Please try again later.',
  EXTERNAL_SERVICE_ERROR: 'External service is unavailable. Please try again later.',
  
  // Network Errors
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
};

// Parse API error response
export function parseApiError(response: unknown): ClientError {
  // Handle fetch errors
  if (response instanceof TypeError && response.message.includes('fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network connection failed',
    };
  }
  
  // Handle generic errors
  if (response instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: response.message,
    };
  }
  
  // Handle API response errors
  if (typeof response === 'object' && response !== null) {
    const apiResponse = response as Partial<ApiResponse>;
    
    if (apiResponse.error) {
      return {
        code: apiResponse.error.code || 'UNKNOWN_ERROR',
        message: apiResponse.error.message || 'An error occurred',
        details: apiResponse.error.details,
      };
    }
  }
  
  // Fallback for unknown error types
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
  };
}

// Get user-friendly error message
export function getUserFriendlyMessage(
  error: ClientError,
  config: Partial<ErrorDisplayConfig> = {}
): string {
  const finalConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
  
  // Use user-friendly message if available
  const friendlyMessage = USER_FRIENDLY_MESSAGES[error.code];
  if (friendlyMessage) {
    return friendlyMessage;
  }
  
  // Use original message if it's user-friendly (no technical jargon)
  if (error.message && !containsTechnicalJargon(error.message)) {
    return error.message;
  }
  
  // Fallback to generic message
  return finalConfig.fallbackMessage;
}

// Check if message contains technical jargon
function containsTechnicalJargon(message: string): boolean {
  const technicalTerms = [
    'prisma',
    'database',
    'sql',
    'jwt',
    'token',
    'middleware',
    'api',
    'server',
    'client',
    'request',
    'response',
    'error code',
    'stack trace',
    'exception',
  ];
  
  const lowerMessage = message.toLowerCase();
  return technicalTerms.some(term => lowerMessage.includes(term));
}

// Format error for display
export function formatErrorForDisplay(
  error: ClientError,
  config: Partial<ErrorDisplayConfig> = {}
): {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
} {
  const finalConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
  
  const result: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  } = {
    message: getUserFriendlyMessage(error, finalConfig),
  };
  
  if (finalConfig.showCode) {
    result.code = error.code;
  }
  
  if (finalConfig.showDetails && error.details) {
    result.details = error.details;
  }
  
  return result;
}

// API request wrapper with error handling
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw parseApiError(data);
    }
    
    if (!data.success) {
      throw parseApiError(data);
    }
    
    return data.data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw {
        code: 'REQUEST_CANCELLED',
        message: 'Request was cancelled',
      } as ClientError;
    }
    
    // If error is already a ClientError (from parseApiError above), re-throw it
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }
    
    throw parseApiError(error);
  }
}

// Authenticated API request wrapper
export function createAuthenticatedApiRequest(getToken: () => string | null) {
  return async function authenticatedApiRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = getToken();
    
    if (!token) {
      throw {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      } as ClientError;
    }
    
    return apiRequest<T>(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  };
}

// Error boundary helper for React components
export function handleComponentError(error: unknown, componentName: string): ClientError {
  console.error(`Error in ${componentName}:`, error);
  
  const clientError = parseApiError(error);
  
  // Log error for monitoring (in production, this would go to a service like Sentry)
  if (process.env.NODE_ENV === 'production') {
    // logErrorToService(clientError, componentName);
  }
  
  return clientError;
}

// Validation error helpers
export function extractValidationErrors(error: ClientError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  
  if (error.code === 'VALIDATION_ERROR' && error.details?.issues) {
    const issues = error.details.issues as Array<{
      field?: string;
      message?: string;
      path?: string[];
    }>;
    
    issues.forEach(issue => {
      const field = issue.field || (issue.path && issue.path.join('.')) || 'general';
      const message = issue.message || 'Invalid value';
      fieldErrors[field] = message;
    });
  }
  
  return fieldErrors;
}

// Retry logic for failed requests
export async function retryApiRequest<T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: ClientError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = parseApiError(error);
      
      // Don't retry for certain error types
      if (
        lastError.code === 'UNAUTHORIZED' ||
        lastError.code === 'FORBIDDEN' ||
        lastError.code === 'VALIDATION_ERROR' ||
        lastError.code === 'RESOURCE_NOT_FOUND'
      ) {
        throw lastError;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
}

// Toast notification helper (for use with toast libraries)
export function createErrorToast(error: ClientError): {
  type: 'error';
  title: string;
  message: string;
  duration?: number;
} {
  return {
    type: 'error',
    title: 'Error',
    message: getUserFriendlyMessage(error),
    duration: error.code === 'NETWORK_ERROR' ? 5000 : 3000,
  };
}