/**
 * Authentication helper utilities for common use cases
 */

import { generateToken, verifyToken, hashPassword, verifyPassword, type JWTPayload } from './auth';

/**
 * Create a user session token after successful login
 */
export async function createUserSession(
  user: {
    id: string;
    email: string;
    password: string;
    role: 'ADMIN' | 'MEMBER';
    tenantId: string;
    tenantSlug: string;
  },
  providedPassword: string
): Promise<{ token: string; user: Omit<typeof user, 'password'> } | null> {
  // Verify password
  const isValidPassword = await verifyPassword(providedPassword, user.password);
  if (!isValidPassword) {
    return null;
  }

  // Create JWT payload
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
  };

  // Generate token
  const token = generateToken(payload);

  // Return token and safe user data
  const { password, ...safeUser } = user;
  return {
    token,
    user: safeUser,
  };
}

/**
 * Validate a request token and return user context
 */
export function validateRequestToken(authHeader: string | null): JWTPayload | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    return verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Check if user has required role
 */
export function hasRole(user: JWTPayload, requiredRoles: ('ADMIN' | 'MEMBER')[]): boolean {
  return requiredRoles.includes(user.role);
}

/**
 * Check if user belongs to specific tenant
 */
export function belongsToTenant(user: JWTPayload, tenantSlug: string): boolean {
  return user.tenantSlug === tenantSlug;
}