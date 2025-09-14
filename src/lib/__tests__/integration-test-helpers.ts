import { PrismaClient } from '@/generated/prisma';
import { hashPassword } from '@/lib/auth';
import { NextRequest } from 'next/server';

/**
 * Integration test helpers for setting up test data
 */

export interface TestTenant {
  id: string;
  slug: string;
  name: string;
  plan: 'FREE' | 'PRO';
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'MEMBER';
  tenantId: string;
}

export interface TestData {
  tenants: {
    acme: TestTenant;
    globex: TestTenant;
  };
  users: {
    acmeAdmin: TestUser;
    acmeMember: TestUser;
    globexAdmin: TestUser;
    globexMember: TestUser;
  };
}

/**
 * Set up test database with tenants and users
 */
export async function setupTestDatabase(prisma: PrismaClient): Promise<TestData> {
  // Clean up existing data
  await cleanupTestDatabase(prisma);

  // Create test tenants
  const acmeTenant = await prisma.tenant.create({
    data: {
      slug: 'acme',
      name: 'Acme Corp',
      plan: 'FREE',
    },
  });

  const globexTenant = await prisma.tenant.create({
    data: {
      slug: 'globex',
      name: 'Globex Inc',
      plan: 'FREE',
    },
  });

  // Create test users
  const hashedPassword = await hashPassword('password');

  const acmeAdmin = await prisma.user.create({
    data: {
      email: 'admin@acme.test',
      password: hashedPassword,
      role: 'ADMIN',
      tenantId: acmeTenant.id,
    },
  });

  const acmeMember = await prisma.user.create({
    data: {
      email: 'user@acme.test',
      password: hashedPassword,
      role: 'MEMBER',
      tenantId: acmeTenant.id,
    },
  });

  const globexAdmin = await prisma.user.create({
    data: {
      email: 'admin@globex.test',
      password: hashedPassword,
      role: 'ADMIN',
      tenantId: globexTenant.id,
    },
  });

  const globexMember = await prisma.user.create({
    data: {
      email: 'user@globex.test',
      password: hashedPassword,
      role: 'MEMBER',
      tenantId: globexTenant.id,
    },
  });

  return {
    tenants: {
      acme: acmeTenant,
      globex: globexTenant,
    },
    users: {
      acmeAdmin,
      acmeMember,
      globexAdmin,
      globexMember,
    },
  };
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(prisma: PrismaClient): Promise<void> {
  // Delete in correct order to avoid foreign key constraints
  await prisma.note.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

/**
 * Create test notes for a user
 */
export async function createTestNotes(
  prisma: PrismaClient,
  userId: string,
  tenantId: string,
  count: number = 3
) {
  const notes = [];
  for (let i = 1; i <= count; i++) {
    const note = await prisma.note.create({
      data: {
        title: `Test Note ${i}`,
        content: `This is test note ${i} content`,
        userId,
        tenantId,
      },
    });
    notes.push(note);
  }
  return notes;
}

/**
 * Create a mock NextRequest for testing
 */
export function createMockRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/test',
  body?: any,
  headers?: Record<string, string>
): NextRequest {
  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(url, requestInit);
}

/**
 * Extract JSON response from NextResponse
 */
export async function extractJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

/**
 * Generate JWT token for testing
 */
export function generateTestToken(user: TestUser, tenant: TestTenant): string {
  const { generateToken } = require('@/lib/auth');
  return generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
  });
}

/**
 * Create authorization header with JWT token
 */
export function createAuthHeader(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}