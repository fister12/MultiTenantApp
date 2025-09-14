/**
 * Security Configuration Documentation
 * 
 * This file documents the security measures implemented in the multi-tenant notes application.
 * All API endpoints are protected with comprehensive security middleware.
 */

import { RATE_LIMIT_CONFIGS, CORS_CONFIG } from './security';

/**
 * Security Features Overview:
 * 
 * 1. CORS (Cross-Origin Resource Sharing)
 *    - Configured to allow specific origins based on environment
 *    - Development: localhost:3000, 127.0.0.1:3000
 *    - Production: Add your production domains to CORS_CONFIG.origin
 *    - Supports preflight OPTIONS requests
 *    - Includes credentials support for authenticated requests
 * 
 * 2. Rate Limiting
 *    - In-memory rate limiting (use Redis in production for distributed systems)
 *    - Different limits for different endpoint types:
 *      - Default: 100 requests per 15 minutes
 *      - Auth: 5 requests per 15 minutes (login attempts)
 *      - Notes: 30 requests per minute
 *      - Upgrade: 3 requests per hour
 *    - Includes proper HTTP headers (X-RateLimit-*)
 *    - Returns 429 status with retry information
 * 
 * 3. Security Headers
 *    - X-Content-Type-Options: nosniff
 *    - X-Frame-Options: DENY
 *    - X-XSS-Protection: 1; mode=block
 *    - Referrer-Policy: strict-origin-when-cross-origin
 *    - Content-Security-Policy: Restrictive policy for API responses
 *    - Permissions-Policy: Disables camera, microphone, geolocation
 *    - Removes Server and X-Powered-By headers
 * 
 * 4. Input Validation
 *    - Zod schema validation for all request bodies
 *    - Request size limits (configurable, default 1MB)
 *    - Content-type validation for POST/PUT requests
 *    - Comprehensive error responses with validation details
 * 
 * 5. Authentication & Authorization
 *    - JWT token validation on protected endpoints
 *    - Role-based access control (Admin, Member)
 *    - Tenant isolation enforcement
 *    - Secure password hashing with bcrypt
 * 
 * 6. Additional Security Measures
 *    - SQL injection prevention via Prisma ORM
 *    - XSS prevention through proper output encoding
 *    - CSRF protection through JWT tokens and CORS
 *    - Audit logging for security violations
 */

/**
 * Endpoint Security Configuration
 */
export const ENDPOINT_SECURITY = {
  // Authentication endpoints
  '/api/auth/login': {
    middleware: ['withAuthRateLimit'],
    rateLimit: RATE_LIMIT_CONFIGS.auth,
    features: ['CORS', 'SecurityHeaders', 'RateLimit', 'RequestSizeLimit', 'ContentTypeValidation'],
    maxRequestSize: 1024 * 10, // 10KB
    allowedContentTypes: ['application/json'],
  },

  // Health check endpoint
  '/api/health': {
    middleware: ['withAPISecurity'],
    rateLimit: RATE_LIMIT_CONFIGS.default,
    features: ['CORS', 'SecurityHeaders', 'RateLimit'],
    authentication: false,
  },

  // Notes CRUD endpoints
  '/api/notes': {
    middleware: ['withSecureMemberRole'],
    rateLimit: RATE_LIMIT_CONFIGS.notes,
    features: ['CORS', 'SecurityHeaders', 'RateLimit', 'Authentication', 'TenantIsolation', 'RoleValidation'],
    requiredRole: ['ADMIN', 'MEMBER'],
    tenantIsolation: true,
  },

  '/api/notes/[id]': {
    middleware: ['withSecureMemberRole'],
    rateLimit: RATE_LIMIT_CONFIGS.notes,
    features: ['CORS', 'SecurityHeaders', 'RateLimit', 'Authentication', 'TenantIsolation', 'RoleValidation', 'OwnershipValidation'],
    requiredRole: ['ADMIN', 'MEMBER'],
    tenantIsolation: true,
    ownershipValidation: true,
  },

  // Tenant upgrade endpoint
  '/api/tenants/[slug]/upgrade': {
    middleware: ['withUpgradeRateLimit'],
    rateLimit: RATE_LIMIT_CONFIGS.upgrade,
    features: ['CORS', 'SecurityHeaders', 'RateLimit', 'Authentication', 'TenantIsolation', 'AdminRoleValidation'],
    requiredRole: ['ADMIN'],
    tenantIsolation: true,
  },
} as const;

/**
 * Security Best Practices Implemented:
 * 
 * 1. Defense in Depth
 *    - Multiple layers of security (authentication, authorization, validation, rate limiting)
 *    - Each layer provides independent protection
 * 
 * 2. Principle of Least Privilege
 *    - Users can only access resources they own within their tenant
 *    - Role-based permissions limit actions based on user role
 * 
 * 3. Fail Secure
 *    - Default deny for all operations
 *    - Explicit permission checks required
 *    - Comprehensive error handling without information leakage
 * 
 * 4. Security by Design
 *    - Security middleware applied at the framework level
 *    - Consistent security patterns across all endpoints
 *    - Automated security testing
 * 
 * 5. Monitoring and Logging
 *    - Security violations are logged
 *    - Rate limit violations tracked
 *    - Authentication failures monitored
 */

/**
 * Production Security Recommendations:
 * 
 * 1. Rate Limiting
 *    - Use Redis or similar for distributed rate limiting
 *    - Implement IP-based and user-based rate limiting
 *    - Consider implementing progressive delays for repeated violations
 * 
 * 2. CORS Configuration
 *    - Update CORS_CONFIG.origin with your production domains
 *    - Use environment variables for domain configuration
 *    - Regularly review and update allowed origins
 * 
 * 3. Security Headers
 *    - Consider implementing HSTS (HTTP Strict Transport Security)
 *    - Add CSP reporting for policy violations
 *    - Implement security header testing in CI/CD
 * 
 * 4. Monitoring
 *    - Implement security event monitoring
 *    - Set up alerts for unusual patterns
 *    - Regular security audits and penetration testing
 * 
 * 5. Infrastructure
 *    - Use HTTPS everywhere
 *    - Implement WAF (Web Application Firewall)
 *    - Regular security updates and patches
 */

export { RATE_LIMIT_CONFIGS, CORS_CONFIG };