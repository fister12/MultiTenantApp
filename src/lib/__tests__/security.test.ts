import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { 
  withRateLimit, 
  withCORS, 
  withSecurityHeaders, 
  withAPISecurity,
  withRequestSizeLimit,
  withContentTypeValidation,
  RATE_LIMIT_CONFIGS,
  CORS_CONFIG 
} from '../security';

// Mock handler for testing
const mockHandler = vi.fn(async (req: NextRequest) => {
  return NextResponse.json({ success: true, data: 'test' });
});

// Helper to create mock request
function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
} = {}): NextRequest {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    headers = {},
    body
  } = options;

  const request = new NextRequest(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });

  return request;
}

describe('Security Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear rate limit store between tests
    vi.clearAllTimers();
  });

  describe('withRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      const handler = withRateLimit({ windowMs: 60000, maxRequests: 5 })(mockHandler);
      const req = createMockRequest({ url: 'http://localhost:3000/api/test1' });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockHandler).toHaveBeenCalledOnce();
    });

    it('should block requests exceeding rate limit', async () => {
      const config = { windowMs: 60000, maxRequests: 2 };
      const handler = withRateLimit(config)(mockHandler);
      const req = createMockRequest({ url: 'http://localhost:3000/api/test2' });

      // Make requests up to the limit
      await handler(req);
      await handler(req);
      
      // This should be blocked
      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('2');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('should include rate limit headers in successful responses', async () => {
      const handler = withRateLimit({ windowMs: 60000, maxRequests: 5 })(mockHandler);
      const req = createMockRequest({ url: 'http://localhost:3000/api/test3' });

      const response = await handler(req);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('4');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });
  });

  describe('withCORS', () => {
    it('should handle preflight OPTIONS requests', async () => {
      const handler = withCORS(mockHandler);
      const req = createMockRequest({
        method: 'OPTIONS',
        headers: { 'origin': 'http://localhost:3000' }
      });

      const response = await handler(req);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should add CORS headers to regular requests', async () => {
      const handler = withCORS(mockHandler);
      const req = createMockRequest({
        headers: { 'origin': 'http://localhost:3000' }
      });

      const response = await handler(req);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(mockHandler).toHaveBeenCalledOnce();
    });

    it('should reject unauthorized origins', async () => {
      const handler = withCORS(mockHandler);
      const req = createMockRequest({
        method: 'OPTIONS',
        headers: { 'origin': 'http://malicious-site.com' }
      });

      const response = await handler(req);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('null');
    });
  });

  describe('withSecurityHeaders', () => {
    it('should add security headers to responses', async () => {
      const handler = withSecurityHeaders(mockHandler);
      const req = createMockRequest();

      const response = await handler(req);

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
      expect(mockHandler).toHaveBeenCalledOnce();
    });

    it('should remove sensitive headers', async () => {
      const handler = withSecurityHeaders(mockHandler);
      const req = createMockRequest();

      const response = await handler(req);

      expect(response.headers.get('Server')).toBeNull();
      expect(response.headers.get('X-Powered-By')).toBeNull();
    });
  });

  describe('withRequestSizeLimit', () => {
    it('should allow requests within size limit', async () => {
      const handler = withRequestSizeLimit(1024)(mockHandler);
      const req = createMockRequest({
        method: 'POST',
        headers: { 'content-length': '500' }
      });

      const response = await handler(req);

      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledOnce();
    });

    it('should reject requests exceeding size limit', async () => {
      const handler = withRequestSizeLimit(1024)(mockHandler);
      const req = createMockRequest({
        method: 'POST',
        headers: { 'content-length': '2048' }
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.error.code).toBe('REQUEST_TOO_LARGE');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('withContentTypeValidation', () => {
    it('should allow valid content types', async () => {
      const handler = withContentTypeValidation(['application/json'])(mockHandler);
      const req = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' }
      });

      const response = await handler(req);

      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledOnce();
    });

    it('should reject invalid content types', async () => {
      const handler = withContentTypeValidation(['application/json'])(mockHandler);
      const req = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'text/plain' }
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(415);
      expect(data.error.code).toBe('INVALID_CONTENT_TYPE');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should skip validation for GET requests', async () => {
      const handler = withContentTypeValidation(['application/json'])(mockHandler);
      const req = createMockRequest({
        method: 'GET',
        headers: { 'content-type': 'text/html' }
      });

      const response = await handler(req);

      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledOnce();
    });
  });

  describe('withAPISecurity', () => {
    it('should combine all security middleware', async () => {
      const handler = withAPISecurity(RATE_LIMIT_CONFIGS.default)(mockHandler);
      const req = createMockRequest({
        headers: { 'origin': 'http://localhost:3000' }
      });

      const response = await handler(req);

      // Check that all security features are applied
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(mockHandler).toHaveBeenCalledOnce();
    });
  });

  describe('Rate Limit Configurations', () => {
    it('should have correct default configuration', () => {
      expect(RATE_LIMIT_CONFIGS.default).toEqual({
        windowMs: 15 * 60 * 1000,
        maxRequests: 100
      });
    });

    it('should have stricter auth configuration', () => {
      expect(RATE_LIMIT_CONFIGS.auth).toEqual({
        windowMs: 15 * 60 * 1000,
        maxRequests: 5
      });
    });

    it('should have moderate notes configuration', () => {
      expect(RATE_LIMIT_CONFIGS.notes).toEqual({
        windowMs: 60 * 1000,
        maxRequests: 30
      });
    });

    it('should have strict upgrade configuration', () => {
      expect(RATE_LIMIT_CONFIGS.upgrade).toEqual({
        windowMs: 60 * 60 * 1000,
        maxRequests: 3
      });
    });
  });

  describe('CORS Configuration', () => {
    it('should have correct development origins', () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      expect(CORS_CONFIG.origin).toContain('http://localhost:3000');
      expect(CORS_CONFIG.origin).toContain('http://127.0.0.1:3000');

      process.env.NODE_ENV = originalEnv;
    });

    it('should have correct allowed methods', () => {
      expect(CORS_CONFIG.methods).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
    });

    it('should have correct allowed headers', () => {
      expect(CORS_CONFIG.allowedHeaders).toContain('Content-Type');
      expect(CORS_CONFIG.allowedHeaders).toContain('Authorization');
    });
  });
});