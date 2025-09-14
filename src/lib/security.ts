import { NextRequest, NextResponse } from 'next/server';
import { AuthenticatedRequest } from './middleware';

// Rate limiting store (in-memory for simplicity, use Redis in production)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configuration
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
}

// Default rate limit configurations for different endpoints
export const RATE_LIMIT_CONFIGS = {
  default: { windowMs: 15 * 60 * 1000, maxRequests: 100 }, // 100 requests per 15 minutes
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 login attempts per 15 minutes
  notes: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 requests per minute for notes
  upgrade: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 upgrade attempts per hour
} as const;

/**
 * Get client IP address from request
 */
function getClientIP(req: NextRequest): string {
  // Check various headers for the real IP
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to a default IP for development
  return '127.0.0.1';
}

/**
 * Rate limiting middleware
 */
export function withRateLimit(config: RateLimitConfig = RATE_LIMIT_CONFIGS.default) {
  return function(handler: (req: NextRequest | AuthenticatedRequest) => Promise<NextResponse>) {
    return async (req: NextRequest | AuthenticatedRequest): Promise<NextResponse> => {
      const clientIP = getClientIP(req as NextRequest);
      const key = `${clientIP}:${req.url}`;
      const now = Date.now();
      
      // Clean up expired entries periodically
      if (Math.random() < 0.01) { // 1% chance to clean up
        for (const [entryKey, entry] of rateLimitStore.entries()) {
          if (now > entry.resetTime) {
            rateLimitStore.delete(entryKey);
          }
        }
      }
      
      // Get or create rate limit entry
      let entry = rateLimitStore.get(key);
      
      if (!entry || now > entry.resetTime) {
        // Create new entry or reset expired entry
        entry = {
          count: 1,
          resetTime: now + config.windowMs,
        };
        rateLimitStore.set(key, entry);
      } else {
        // Increment existing entry
        entry.count++;
      }
      
      // Check if rate limit exceeded
      if (entry.count > config.maxRequests) {
        const resetTimeSeconds = Math.ceil((entry.resetTime - now) / 1000);
        
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: config.message || 'Too many requests. Please try again later.',
              details: {
                limit: config.maxRequests,
                windowMs: config.windowMs,
                resetIn: resetTimeSeconds,
              },
            },
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': config.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString(),
              'Retry-After': resetTimeSeconds.toString(),
            },
          }
        );
      }
      
      // Add rate limit headers to successful responses
      const response = await handler(req);
      
      response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', (config.maxRequests - entry.count).toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());
      
      return response;
    };
  };
}

/**
 * CORS configuration
 */
export const CORS_CONFIG = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://your-frontend-domain.com',
        'https://your-dashboard-domain.com',
        // Add your production domains here
      ]
    : ['http://localhost:3000', 'http://127.0.0.1:3000'], // Development origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * CORS middleware
 */
export function withCORS(handler: (req: NextRequest | AuthenticatedRequest) => Promise<NextResponse>) {
  return async (req: NextRequest | AuthenticatedRequest): Promise<NextResponse> => {
    const origin = req.headers.get('origin');
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin && CORS_CONFIG.origin.includes(origin) ? origin : 'null',
          'Access-Control-Allow-Methods': CORS_CONFIG.methods.join(', '),
          'Access-Control-Allow-Headers': CORS_CONFIG.allowedHeaders.join(', '),
          'Access-Control-Allow-Credentials': CORS_CONFIG.credentials.toString(),
          'Access-Control-Max-Age': CORS_CONFIG.maxAge.toString(),
        },
      });
    }
    
    // Process the actual request
    const response = await handler(req);
    
    // Add CORS headers to the response
    if (origin && CORS_CONFIG.origin.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    response.headers.set('Access-Control-Allow-Methods', CORS_CONFIG.methods.join(', '));
    response.headers.set('Access-Control-Allow-Headers', CORS_CONFIG.allowedHeaders.join(', '));
    response.headers.set('Access-Control-Allow-Credentials', CORS_CONFIG.credentials.toString());
    
    return response;
  };
}

/**
 * Security headers middleware
 */
export function withSecurityHeaders(handler: (req: NextRequest | AuthenticatedRequest) => Promise<NextResponse>) {
  return async (req: NextRequest | AuthenticatedRequest): Promise<NextResponse> => {
    const response = await handler(req);
    
    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Content Security Policy for API responses
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none';"
    );
    
    // Remove potentially sensitive headers
    response.headers.delete('Server');
    response.headers.delete('X-Powered-By');
    
    return response;
  };
}

/**
 * Input validation middleware using Zod schemas
 */
export function withInputValidation<T>(
  schema: { parse: (data: any) => T },
  source: 'body' | 'query' | 'params' = 'body'
) {
  return function(handler: (req: NextRequest | AuthenticatedRequest, validatedData: T) => Promise<NextResponse>) {
    return async (req: NextRequest | AuthenticatedRequest): Promise<NextResponse> => {
      try {
        let data: any;
        
        switch (source) {
          case 'body':
            data = await (req as NextRequest).json();
            break;
          case 'query':
            const { searchParams } = new URL((req as NextRequest).url);
            data = Object.fromEntries(searchParams.entries());
            break;
          case 'params':
            // Extract params from URL - this would need to be implemented based on your routing
            data = {}; // Placeholder
            break;
          default:
            throw new Error(`Unsupported validation source: ${source}`);
        }
        
        const validatedData = schema.parse(data);
        return handler(req, validatedData);
      } catch (error: any) {
        console.error('Input validation error:', error);
        
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input data',
              details: error.issues || error.message,
            },
          },
          { status: 400 }
        );
      }
    };
  };
}

/**
 * Comprehensive API security middleware that combines all security measures
 */
export function withAPISecurity(
  rateLimitConfig: RateLimitConfig = RATE_LIMIT_CONFIGS.default
) {
  return function(handler: (req: NextRequest | AuthenticatedRequest) => Promise<NextResponse>) {
    return withCORS(
      withSecurityHeaders(
        withRateLimit(rateLimitConfig)(handler)
      )
    );
  };
}

/**
 * Request size validation middleware
 */
export function withRequestSizeLimit(maxSizeBytes: number = 1024 * 1024) { // 1MB default
  return function(handler: (req: NextRequest | AuthenticatedRequest) => Promise<NextResponse>) {
    return async (req: NextRequest | AuthenticatedRequest): Promise<NextResponse> => {
      const contentLength = req.headers.get('content-length');
      
      if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'REQUEST_TOO_LARGE',
              message: 'Request body too large',
              details: {
                maxSize: maxSizeBytes,
                receivedSize: parseInt(contentLength, 10),
              },
            },
          },
          { status: 413 }
        );
      }
      
      return handler(req);
    };
  };
}

/**
 * Content type validation middleware
 */
export function withContentTypeValidation(allowedTypes: string[] = ['application/json']) {
  return function(handler: (req: NextRequest | AuthenticatedRequest) => Promise<NextResponse>) {
    return async (req: NextRequest | AuthenticatedRequest): Promise<NextResponse> => {
      // Skip validation for GET requests and OPTIONS
      if (req.method === 'GET' || req.method === 'OPTIONS') {
        return handler(req);
      }
      
      const contentType = req.headers.get('content-type');
      
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_CONTENT_TYPE',
              message: 'Invalid content type',
              details: {
                allowed: allowedTypes,
                received: contentType,
              },
            },
          },
          { status: 415 }
        );
      }
      
      return handler(req);
    };
  };
}