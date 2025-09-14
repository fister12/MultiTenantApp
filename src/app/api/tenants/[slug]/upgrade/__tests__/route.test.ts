import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getPrismaClient } from '@/lib/db-helpers';
import { generateToken, hashPassword } from '@/lib/auth';

describe('/api/tenants/[slug]/upgrade', () => {
  const prisma = getPrismaClient();
  let testTenants: any[];
  let testUsers: any[];

  beforeEach(async () => {
    // Clean up database
    await prisma.note.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();

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

    const proTenant = await prisma.tenant.create({
      data: {
        slug: 'pro-tenant',
        name: 'Pro Corp',
        plan: 'PRO',
      },
    });

    testTenants = [acmeTenant, globexTenant, proTenant];

    // Create test users with hashed passwords
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

    const proAdmin = await prisma.user.create({
      data: {
        email: 'admin@pro-tenant.test',
        password: hashedPassword,
        role: 'ADMIN',
        tenantId: proTenant.id,
      },
    });

    testUsers = [acmeAdmin, acmeMember, globexAdmin, proAdmin];
  });

  afterEach(async () => {
    // Clean up database
    await prisma.note.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
  });

  describe('POST /api/tenants/[slug]/upgrade', () => {
    it('should successfully upgrade tenant subscription when called by admin', async () => {
      // Create admin token
      const adminToken = generateToken({
        userId: testUsers[0].id,
        email: testUsers[0].email,
        role: testUsers[0].role,
        tenantId: testUsers[0].tenantId,
        tenantSlug: testTenants[0].slug,
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/tenants/acme/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Call the handler
      const response = await POST(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Tenant subscription upgraded successfully');
      expect(data.data.tenant.slug).toBe('acme');
      expect(data.data.tenant.plan).toBe('PRO');

      // Verify database was updated
      const updatedTenant = await prisma.tenant.findUnique({
        where: { id: testTenants[0].id },
      });
      expect(updatedTenant?.plan).toBe('PRO');
    });

    it('should reject upgrade request from non-admin user', async () => {
      // Create member token
      const memberToken = generateToken({
        userId: testUsers[1].id,
        email: testUsers[1].email,
        role: testUsers[1].role,
        tenantId: testUsers[1].tenantId,
        tenantSlug: testTenants[0].slug,
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/tenants/acme/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Call the handler
      const response = await POST(request);
      const data = await response.json();



      // Assertions
      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
      expect(data.error.message).toBe('Admin role required for this action');

      // Verify tenant was not upgraded
      const tenant = await prisma.tenant.findUnique({
        where: { id: testTenants[0].id },
      });
      expect(tenant?.plan).toBe('FREE');
    });

    it('should reject upgrade request without authentication', async () => {
      // Create request without token
      const request = new NextRequest('http://localhost:3000/api/tenants/acme/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Call the handler
      const response = await POST(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
      expect(data.error.message).toBe('Missing or invalid authorization header');
    });

    it('should reject cross-tenant upgrade attempts', async () => {
      // Create admin token for Acme trying to upgrade Globex
      const adminToken = generateToken({
        userId: testUsers[0].id,
        email: testUsers[0].email,
        role: testUsers[0].role,
        tenantId: testUsers[0].tenantId,
        tenantSlug: testTenants[0].slug, // Acme admin
      });

      // Create request for Globex upgrade
      const request = new NextRequest('http://localhost:3000/api/tenants/globex/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Call the handler
      const response = await POST(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
      expect(data.error.message).toBe('Access denied: tenant isolation violation');

      // Verify Globex tenant was not upgraded
      const globexTenant = await prisma.tenant.findUnique({
        where: { id: testTenants[1].id },
      });
      expect(globexTenant?.plan).toBe('FREE');
    });

    it('should handle tenant already on PRO plan', async () => {
      // Create admin token for PRO tenant
      const adminToken = generateToken({
        userId: testUsers[3].id,
        email: testUsers[3].email,
        role: testUsers[3].role,
        tenantId: testUsers[3].tenantId,
        tenantSlug: testTenants[2].slug, // PRO tenant
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/tenants/pro-tenant/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Call the handler
      const response = await POST(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toBe('Tenant is already on PRO plan');
    });

    it('should handle tenant not found', async () => {
      // Create admin token with non-existent tenant
      const adminToken = generateToken({
        userId: 'non-existent-user',
        email: 'admin@nonexistent.test',
        role: 'ADMIN',
        tenantId: 'non-existent-tenant',
        tenantSlug: 'nonexistent',
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/tenants/nonexistent/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Call the handler
      const response = await POST(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(data.error.message).toBe('Tenant not found');
    });

    it('should handle invalid tenant slug in URL', async () => {
      // Create admin token
      const adminToken = generateToken({
        userId: testUsers[0].id,
        email: testUsers[0].email,
        role: testUsers[0].role,
        tenantId: testUsers[0].tenantId,
        tenantSlug: testTenants[0].slug,
      });

      // Create request with invalid URL structure
      const request = new NextRequest('http://localhost:3000/api/tenants//upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Call the handler
      const response = await POST(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toBe('Tenant slug is required');
    });

    it('should handle database errors gracefully', async () => {
      // Create admin token with invalid tenant ID to trigger database error
      const adminToken = generateToken({
        userId: 'invalid-user-id',
        email: 'admin@acme.test',
        role: 'ADMIN',
        tenantId: 'invalid-tenant-id',
        tenantSlug: 'acme',
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/tenants/acme/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Call the handler
      const response = await POST(request);
      const data = await response.json();

      // Assertions - this should result in a tenant not found error
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(data.error.message).toBe('Tenant not found');
    });

    it('should handle invalid JWT token', async () => {
      // Create request with invalid token
      const request = new NextRequest('http://localhost:3000/api/tenants/acme/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
        },
      });

      // Call the handler
      const response = await POST(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
      expect(data.error.message).toBe('Invalid or expired token');
    });
  });
});