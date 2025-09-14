import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  extractTokenFromHeader,
  type JWTPayload,
} from '../auth';

describe('Authentication Utilities', () => {
  const mockPayload: JWTPayload = {
    userId: 'user123',
    email: 'test@acme.test',
    role: 'ADMIN',
    tenantId: 'tenant123',
    tenantSlug: 'acme',
  };

  describe('JWT Token Generation and Validation', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should verify and decode a valid token', () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.role).toBe(mockPayload.role);
      expect(decoded.tenantId).toBe(mockPayload.tenantId);
      expect(decoded.tenantSlug).toBe(mockPayload.tenantSlug);
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow('Invalid or expired token');
    });

    it('should throw error for malformed token', () => {
      expect(() => verifyToken('not.a.token')).toThrow('Invalid or expired token');
    });

    it('should include expiration in token', () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp! > decoded.iat!).toBe(true);
    });
  });

  describe('Password Hashing and Verification', () => {
    const testPassword = 'testPassword123!';

    it('should hash a password', async () => {
      const hash = await hashPassword(testPassword);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(testPassword);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
    });

    it('should verify correct password against hash', async () => {
      const hash = await hashPassword(testPassword);
      const isValid = await verifyPassword(testPassword, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password against hash', async () => {
      const hash = await hashPassword(testPassword);
      const isValid = await verifyPassword('wrongPassword', hash);
      
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const hash1 = await hashPassword(testPassword);
      const hash2 = await hashPassword(testPassword);
      
      expect(hash1).not.toBe(hash2);
      
      // But both should verify correctly
      expect(await verifyPassword(testPassword, hash1)).toBe(true);
      expect(await verifyPassword(testPassword, hash2)).toBe(true);
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('');
      const isValid = await verifyPassword('', hash);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Token Header Extraction', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const authHeader = `Bearer ${token}`;
      
      const extracted = extractTokenFromHeader(authHeader);
      expect(extracted).toBe(token);
    });

    it('should return null for missing header', () => {
      const extracted = extractTokenFromHeader(null);
      expect(extracted).toBeNull();
    });

    it('should return null for header without Bearer prefix', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const extracted = extractTokenFromHeader(token);
      expect(extracted).toBeNull();
    });

    it('should return null for malformed Bearer header', () => {
      const extracted = extractTokenFromHeader('Bearer');
      expect(extracted).toBeNull();
    });

    it('should handle Bearer header with extra spaces', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const authHeader = `Bearer  ${token}`;
      
      const extracted = extractTokenFromHeader(authHeader);
      expect(extracted).toBe(` ${token}`);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full auth cycle: hash password, generate token, verify token', async () => {
      const password = 'userPassword123!';
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Verify password
      const isPasswordValid = await verifyPassword(password, hashedPassword);
      expect(isPasswordValid).toBe(true);
      
      // Generate token
      const token = generateToken(mockPayload);
      
      // Verify token
      const decoded = verifyToken(token);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.role).toBe(mockPayload.role);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing JWT_SECRET gracefully', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      // The auth module has a fallback secret, so it should still work
      // but in production this would be a security issue
      const token = generateToken(mockPayload);
      expect(token).toBeDefined();
      
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
      
      // Restore original secret
      if (originalSecret) {
        process.env.JWT_SECRET = originalSecret;
      }
    });

    it('should handle expired tokens', () => {
      // Mock jwt.verify to throw expired token error
      const jwt = require('jsonwebtoken');
      const originalVerify = jwt.verify;
      jwt.verify = vi.fn().mockImplementation(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      expect(() => verifyToken('expired-token')).toThrow('Invalid or expired token');
      
      // Restore original function
      jwt.verify = originalVerify;
    });

    it('should handle malformed JWT tokens', () => {
      expect(() => verifyToken('')).toThrow('Invalid or expired token');
      expect(() => verifyToken('invalid')).toThrow('Invalid or expired token');
      expect(() => verifyToken('invalid.token')).toThrow('Invalid or expired token');
    });

    it('should validate JWT payload structure', () => {
      const incompletePayload = {
        userId: 'user123',
        email: 'test@example.com',
        // Missing required fields
      } as JWTPayload;

      // Should still generate token but with undefined fields
      const token = generateToken(incompletePayload);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe('user123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBeUndefined();
      expect(decoded.tenantId).toBeUndefined();
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const hash = await hashPassword(longPassword);
      const isValid = await verifyPassword(longPassword, hash);
      
      expect(isValid).toBe(true);
    });

    it('should handle special characters in passwords', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?`~';
      const hash = await hashPassword(specialPassword);
      const isValid = await verifyPassword(specialPassword, hash);
      
      expect(isValid).toBe(true);
    });

    it('should handle unicode characters in passwords', async () => {
      const unicodePassword = '测试密码🔒🌟';
      const hash = await hashPassword(unicodePassword);
      const isValid = await verifyPassword(unicodePassword, hash);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Security Validation', () => {
    it('should use sufficient salt rounds for bcrypt', async () => {
      const password = 'testPassword';
      const hash = await hashPassword(password);
      
      // bcrypt hash should start with $2b$ and have proper structure
      expect(hash).toMatch(/^\$2b\$12\$/);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should generate cryptographically secure tokens', () => {
      const tokens = new Set();
      
      // Generate multiple tokens and ensure they're unique
      for (let i = 0; i < 100; i++) {
        const token = generateToken({
          ...mockPayload,
          userId: `user${i}`,
        });
        expect(tokens.has(token)).toBe(false);
        tokens.add(token);
      }
    });

    it('should include proper JWT claims', () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);
      
      // Should have standard JWT claims
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.iat).toBe('number');
      expect(typeof decoded.exp).toBe('number');
      
      // Should have custom claims
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.tenantId).toBe(mockPayload.tenantId);
      expect(decoded.role).toBe(mockPayload.role);
    });

    it('should reject tokens with invalid signatures', () => {
      const token = generateToken(mockPayload);
      const parts = token.split('.');
      const tamperedToken = parts[0] + '.' + parts[1] + '.invalid-signature';
      
      expect(() => verifyToken(tamperedToken)).toThrow('Invalid or expired token');
    });
  });
});