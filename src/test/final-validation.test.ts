import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../../prisma/seed';

const prisma = new PrismaClient();

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Test accounts from requirements
const TEST_ACCOUNTS = [
  { email: 'admin@acme.test', password: 'password', tenant: 'acme', role: 'ADMIN' },
  { email: 'user@acme.test', password: 'password', tenant: 'acme', role: 'MEMBER' },
  { email: 'admin@globex.test', password: 'password', tenant: 'globex', role: 'ADMIN' },
  { email: 'user@globex.test', password: 'password', tenant: 'globex', role: 'MEMBER' }
];

describe('Final System Validation', () => {
  beforeAll(async () => {
    // Ensure database is seeded with test data
    await seedDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Predefined Accounts Login Functionality', () => {
    TEST_ACCOUNTS.forEach(account => {
      it(`should successfully login ${account.email}`, async () => {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: account.email,
            password: account.password
          })
        });

        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data.token).toBeDefined();
        expect(data.user.email).toBe(account.email);
        expect(data.user.role).toBe(account.role);
        expect(data.user.tenant.slug).toBe(account.tenant);
      });
    });

    it('should reject invalid credentials', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'admin@acme.test',
          password: 'wrongpassword'
        })
      });

      expect(response.status).toBe(401);
    });
  });

  describe('2. Tenant Isolation Verification', () => {
    let acmeAdminToken: string;
    let globexAdminToken: string;
    let acmeNoteId: string;
    let globexNoteId: string;

    beforeAll(async () => {
      // Login as Acme admin
      const acmeResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@acme.test',
          password: 'password'
        })
      });
      const acmeData = await acmeResponse.json();
      acmeAdminToken = acmeData.token;

      // Login as Globex admin
      const globexResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@globex.test',
          password: 'password'
        })
      });
      const globexData = await globexResponse.json();
      globexAdminToken = globexData.token;

      // Create notes for each tenant
      const acmeNoteResponse = await fetch(`${BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${acmeAdminToken}`
        },
        body: JSON.stringify({
          title: 'Acme Test Note',
          content: 'This is an Acme note'
        })
      });
      const acmeNote = await acmeNoteResponse.json();
      acmeNoteId = acmeNote.id;

      const globexNoteResponse = await fetch(`${BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${globexAdminToken}`
        },
        body: JSON.stringify({
          title: 'Globex Test Note',
          content: 'This is a Globex note'
        })
      });
      const globexNote = await globexNoteResponse.json();
      globexNoteId = globexNote.id;
    });

    it('should prevent cross-tenant note access', async () => {
      // Acme user trying to access Globex note
      const response = await fetch(`${BASE_URL}/api/notes/${globexNoteId}`, {
        headers: {
          'Authorization': `Bearer ${acmeAdminToken}`
        }
      });

      expect(response.status).toBe(404);
    });

    it('should only return tenant-scoped notes in list', async () => {
      // Get Acme notes
      const acmeResponse = await fetch(`${BASE_URL}/api/notes`, {
        headers: {
          'Authorization': `Bearer ${acmeAdminToken}`
        }
      });
      const acmeNotes = await acmeResponse.json();

      // Get Globex notes
      const globexResponse = await fetch(`${BASE_URL}/api/notes`, {
        headers: {
          'Authorization': `Bearer ${globexAdminToken}`
        }
      });
      const globexNotes = await globexResponse.json();

      // Verify no cross-tenant contamination
      const acmeNoteIds = acmeNotes.map((note: any) => note.id);
      const globexNoteIds = globexNotes.map((note: any) => note.id);

      expect(acmeNoteIds).toContain(acmeNoteId);
      expect(acmeNoteIds).not.toContain(globexNoteId);
      expect(globexNoteIds).toContain(globexNoteId);
      expect(globexNoteIds).not.toContain(acmeNoteId);
    });

    it('should prevent cross-tenant note updates', async () => {
      // Acme user trying to update Globex note
      const response = await fetch(`${BASE_URL}/api/notes/${globexNoteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${acmeAdminToken}`
        },
        body: JSON.stringify({
          title: 'Hacked Note',
          content: 'This should not work'
        })
      });

      expect(response.status).toBe(404);
    });

    it('should prevent cross-tenant note deletion', async () => {
      // Acme user trying to delete Globex note
      const response = await fetch(`${BASE_URL}/api/notes/${globexNoteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${acmeAdminToken}`
        }
      });

      expect(response.status).toBe(404);
    });
  });

  describe('3. Subscription Limits and Upgrade Functionality', () => {
    let acmeAdminToken: string;
    let acmeUserToken: string;

    beforeAll(async () => {
      // Login as Acme admin
      const adminResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@acme.test',
          password: 'password'
        })
      });
      const adminData = await adminResponse.json();
      acmeAdminToken = adminData.token;

      // Login as Acme user
      const userResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@acme.test',
          password: 'password'
        })
      });
      const userData = await userResponse.json();
      acmeUserToken = userData.token;

      // Ensure Acme is on FREE plan
      await prisma.tenant.update({
        where: { slug: 'acme' },
        data: { plan: 'FREE' }
      });

      // Clear existing notes for clean test
      await prisma.note.deleteMany({
        where: { tenant: { slug: 'acme' } }
      });
    });

    it('should enforce FREE plan note limit (3 notes)', async () => {
      // Create 3 notes (should succeed)
      for (let i = 1; i <= 3; i++) {
        const response = await fetch(`${BASE_URL}/api/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${acmeUserToken}`
          },
          body: JSON.stringify({
            title: `Note ${i}`,
            content: `Content ${i}`
          })
        });
        expect(response.status).toBe(201);
      }

      // Try to create 4th note (should fail)
      const response = await fetch(`${BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${acmeUserToken}`
        },
        body: JSON.stringify({
          title: 'Note 4',
          content: 'This should fail'
        })
      });

      expect(response.status).toBe(403);
      const error = await response.json();
      expect(error.error.code).toBe('SUBSCRIPTION_LIMIT_EXCEEDED');
    });

    it('should allow admin to upgrade tenant subscription', async () => {
      const response = await fetch(`${BASE_URL}/api/tenants/acme/upgrade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${acmeAdminToken}`
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.tenant.plan).toBe('PRO');
    });

    it('should prevent non-admin from upgrading subscription', async () => {
      const response = await fetch(`${BASE_URL}/api/tenants/acme/upgrade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${acmeUserToken}`
        }
      });

      expect(response.status).toBe(403);
    });

    it('should allow unlimited notes after upgrade to PRO', async () => {
      // Ensure tenant is on PRO plan
      await prisma.tenant.update({
        where: { slug: 'acme' },
        data: { plan: 'PRO' }
      });

      // Should be able to create more than 3 notes
      const response = await fetch(`${BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${acmeUserToken}`
        },
        body: JSON.stringify({
          title: 'PRO Plan Note',
          content: 'This should work on PRO plan'
        })
      });

      expect(response.status).toBe(201);
    });
  });

  describe('4. CORS Configuration Validation', () => {
    it('should include proper CORS headers', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'OPTIONS'
      });

      // Check for CORS headers
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
    });

    it('should handle cross-origin requests', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        headers: {
          'Origin': 'https://external-dashboard.com'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });
  });

  describe('5. Health Endpoint Accessibility', () => {
    it('should return correct health status', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toEqual({ status: 'ok' });
    });

    it('should be accessible without authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      
      expect(response.status).toBe(200);
      // Should not require Authorization header
    });

    it('should respond quickly', async () => {
      const startTime = Date.now();
      const response = await fetch(`${BASE_URL}/api/health`);
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});