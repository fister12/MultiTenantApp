import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity, RATE_LIMIT_CONFIGS } from '../security';
import { withAuthRateLimit } from '../middleware';

// Mock handler for testing
const mockHandler = vi.fn(async (req: any) => {
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

describe('Security Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API Security Middleware Integration', () => {
    it('should apply CORS headers to responses', async () => {
      const handler = withAPISecurity(RATE_LIMIT_CONFIGS.default)(mockHandler);
      const req = createMockRequest({
        headers: { 'origin': 'http://localhost:3000' }
      });

      const response = await handler(req);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(mockHandler).toHaveBeenCalledOnce();
    });

    it('should handle preflight OPTIONS requests', async () => {
      const handler = withAPISecurity(RATE_LIMIT_CONFIGS.default)(mockHandler);
      const req = createMockRequest({
        method: 'OPTIONS',
        headers: { 'origin': 'http://localhost:3000' }
      });

      const response = await handler(req);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should apply rate limiting', async () => {
      const config = { windowMs: 60000, maxRequests: 1 };
      const handler = withAPISecurity(config)(mockHandler);
      const req = createMockRequest({ url: 'http://localhost:3000/api/rate-limit-test' });

      // First request should succeed
      const response1 = await handler(req);
      expect(response1.status).toBe(200);

      // Second request should be rate limited
      const response2 = await handler(req);
      expect(response2.status).toBe(429);
      
      const data = await response2.json();
      expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should reject unauthorized origins', async () => {
      const handler = withAPISecurity(RATE_LIMIT_CONFIGS.default)(mockHandler);
      const req = createMockRequest({
        method: 'OPTIONS',
        headers: { 'origin': 'http://malicious-site.com' }
      });

      const response = await handler(req);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('null');
    });
  });

  describe('Auth Rate Limiting', () => {
    it('should apply auth rate limiting configuration', async () => {
      const handler = withAuthRateLimit(mockHandler);
      const req = createMockRequest({
        url: 'http://localhost:3000/api/auth-rate-test',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { email: 'test@example.com', password: 'password' }
      });

      const response = await handler(req);
      
      // Should succeed and include rate limit headers with auth config
      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('5'); // Auth limit
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should validate content type for auth requests', async () => {
      const handler = withAuthRateLimit(mockHandler);
      const req = createMockRequest({
        url: 'http://localhost:3000/api/content-type-test',
        method: 'POST',
        headers: { 'content-type': 'text/plain' }
      });

      const response = await handler(req);
      expect(response.status).toBe(415);
      
      const data = await response.json();
      expect(data.error.code).toBe('INVALID_CONTENT_TYPE');
    });

    it('should enforce request size limits', async () => {
      const handler = withAuthRateLimit(mockHandler);
      const req = createMockRequest({
        url: 'http://localhost:3000/api/size-limit-test',
        method: 'POST',
        headers: { 
          'content-type': 'application/json',
          'content-length': '20000' // Exceeds 10KB limit
        }
      });

      const response = await handler(req);
      expect(response.status).toBe(413);
      
      const data = await response.json();
      expect(data.error.code).toBe('REQUEST_TOO_LARGE');
    });
  });

  describe('Security Headers', () => {
    it('should include all required security headers', async () => {
      const handler = withAPISecurity(RATE_LIMIT_CONFIGS.default)(mockHandler);
      const req = createMockRequest();

      const response = await handler(req);

      // Check all security headers are present
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    });

    it('should remove sensitive headers', async () => {
      const handler = withAPISecurity(RATE_LIMIT_CONFIGS.default)(mockHandler);
      const req = createMockRequest();

      const response = await handler(req);

      expect(response.headers.get('Server')).toBeNull();
      expect(response.headers.get('X-Powered-By')).toBeNull();
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include rate limit headers in responses', async () => {
      const handler = withAPISecurity(RATE_LIMIT_CONFIGS.default)(mockHandler);
      const req = createMockRequest({ url: 'http://localhost:3000/api/rate-headers-test' });

      const response = await handler(req);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    it('should include retry-after header when rate limited', async () => {
      const config = { windowMs: 60000, maxRequests: 1 };
      const handler = withAPISecurity(config)(mockHandler);
      const req = createMockRequest({ url: 'http://localhost:3000/api/retry-test' });

      // First request succeeds
      await handler(req);

      // Second request is rate limited
      const response = await handler(req);
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });
  });
});