#!/usr/bin/env tsx

/**
 * Manual Final Validation Script
 * 
 * This script performs comprehensive testing of the deployed application
 * to validate all requirements are met.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const EXTERNAL_ORIGIN = 'https://external-dashboard.com';

// Test accounts
const TEST_ACCOUNTS = [
  { email: 'admin@acme.test', password: 'password', tenant: 'acme', role: 'ADMIN' },
  { email: 'user@acme.test', password: 'password', tenant: 'acme', role: 'MEMBER' },
  { email: 'admin@globex.test', password: 'password', tenant: 'globex', role: 'ADMIN' },
  { email: 'user@globex.test', password: 'password', tenant: 'globex', role: 'MEMBER' }
];

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

class FinalValidator {
  private results: TestResult[] = [];

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    try {
      console.log(`🧪 Running: ${name}`);
      await testFn();
      this.results.push({ name, passed: true });
      console.log(`✅ PASSED: ${name}`);
    } catch (error) {
      this.results.push({ 
        name, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`❌ FAILED: ${name} - ${error}`);
    }
  }

  async validatePredefinedAccounts(): Promise<void> {
    console.log('\n📋 1. Testing Predefined Accounts Login Functionality');
    
    for (const account of TEST_ACCOUNTS) {
      await this.runTest(`Login ${account.email}`, async () => {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: account.email,
            password: account.password
          })
        });

        if (!response.ok) {
          throw new Error(`Login failed with status ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.token) {
          throw new Error('No token returned');
        }
        
        if (data.user.email !== account.email) {
          throw new Error(`Email mismatch: expected ${account.email}, got ${data.user.email}`);
        }
        
        if (data.user.role !== account.role) {
          throw new Error(`Role mismatch: expected ${account.role}, got ${data.user.role}`);
        }
        
        if (data.user.tenant.slug !== account.tenant) {
          throw new Error(`Tenant mismatch: expected ${account.tenant}, got ${data.user.tenant.slug}`);
        }
      });
    }

    // Test invalid credentials
    await this.runTest('Reject invalid credentials', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@acme.test',
          password: 'wrongpassword'
        })
      });

      if (response.status !== 401) {
        throw new Error(`Expected 401, got ${response.status}`);
      }
    });
  }

  async validateTenantIsolation(): Promise<void> {
    console.log('\n🔒 2. Testing Tenant Isolation');

    // Get tokens for both tenants
    const acmeResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@acme.test', password: 'password' })
    });
    const acmeData = await acmeResponse.json();
    const acmeToken = acmeData.token;

    const globexResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@globex.test', password: 'password' })
    });
    const globexData = await globexResponse.json();
    const globexToken = globexData.token;

    // Create notes for each tenant
    let acmeNoteId: string;
    let globexNoteId: string;

    await this.runTest('Create Acme note', async () => {
      const response = await fetch(`${BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${acmeToken}`
        },
        body: JSON.stringify({
          title: 'Acme Isolation Test',
          content: 'This note belongs to Acme'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create note: ${response.status}`);
      }

      const note = await response.json();
      acmeNoteId = note.id;
    });

    await this.runTest('Create Globex note', async () => {
      const response = await fetch(`${BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${globexToken}`
        },
        body: JSON.stringify({
          title: 'Globex Isolation Test',
          content: 'This note belongs to Globex'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create note: ${response.status}`);
      }

      const note = await response.json();
      globexNoteId = note.id;
    });

    // Test cross-tenant access prevention
    await this.runTest('Prevent cross-tenant note access', async () => {
      const response = await fetch(`${BASE_URL}/api/notes/${globexNoteId}`, {
        headers: { 'Authorization': `Bearer ${acmeToken}` }
      });

      if (response.status !== 404) {
        throw new Error(`Expected 404 for cross-tenant access, got ${response.status}`);
      }
    });

    await this.runTest('Tenant-scoped note listing', async () => {
      const acmeNotesResponse = await fetch(`${BASE_URL}/api/notes`, {
        headers: { 'Authorization': `Bearer ${acmeToken}` }
      });
      const acmeNotes = await acmeNotesResponse.json();

      const globexNotesResponse = await fetch(`${BASE_URL}/api/notes`, {
        headers: { 'Authorization': `Bearer ${globexToken}` }
      });
      const globexNotes = await globexNotesResponse.json();

      const acmeNoteIds = acmeNotes.map((note: any) => note.id);
      const globexNoteIds = globexNotes.map((note: any) => note.id);

      if (!acmeNoteIds.includes(acmeNoteId)) {
        throw new Error('Acme note not found in Acme tenant notes');
      }

      if (acmeNoteIds.includes(globexNoteId)) {
        throw new Error('Globex note found in Acme tenant notes');
      }

      if (!globexNoteIds.includes(globexNoteId)) {
        throw new Error('Globex note not found in Globex tenant notes');
      }

      if (globexNoteIds.includes(acmeNoteId)) {
        throw new Error('Acme note found in Globex tenant notes');
      }
    });
  }

  async validateSubscriptionLimits(): Promise<void> {
    console.log('\n💳 3. Testing Subscription Limits and Upgrade');

    // Get tokens
    const adminResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@acme.test', password: 'password' })
    });
    const adminData = await adminResponse.json();
    const adminToken = adminData.token;

    const userResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@acme.test', password: 'password' })
    });
    const userData = await userResponse.json();
    const userToken = userData.token;

    // Ensure Acme is on FREE plan and clear notes
    await prisma.tenant.update({
      where: { slug: 'acme' },
      data: { plan: 'FREE' }
    });
    await prisma.note.deleteMany({
      where: { tenant: { slug: 'acme' } }
    });

    await this.runTest('FREE plan allows 3 notes', async () => {
      for (let i = 1; i <= 3; i++) {
        const response = await fetch(`${BASE_URL}/api/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify({
            title: `Limit Test Note ${i}`,
            content: `Content ${i}`
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create note ${i}: ${response.status}`);
        }
      }
    });

    await this.runTest('FREE plan blocks 4th note', async () => {
      const response = await fetch(`${BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          title: 'Should Fail',
          content: 'This should be blocked'
        })
      });

      if (response.status !== 403) {
        throw new Error(`Expected 403 for note limit, got ${response.status}`);
      }

      const error = await response.json();
      if (error.error.code !== 'SUBSCRIPTION_LIMIT_EXCEEDED') {
        throw new Error(`Expected SUBSCRIPTION_LIMIT_EXCEEDED, got ${error.error.code}`);
      }
    });

    await this.runTest('Admin can upgrade subscription', async () => {
      const response = await fetch(`${BASE_URL}/api/tenants/acme/upgrade`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      if (!response.ok) {
        throw new Error(`Upgrade failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.tenant.plan !== 'PRO') {
        throw new Error(`Expected PRO plan, got ${data.tenant.plan}`);
      }
    });

    await this.runTest('Member cannot upgrade subscription', async () => {
      // Reset to FREE for this test
      await prisma.tenant.update({
        where: { slug: 'acme' },
        data: { plan: 'FREE' }
      });

      const response = await fetch(`${BASE_URL}/api/tenants/acme/upgrade`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      if (response.status !== 403) {
        throw new Error(`Expected 403 for member upgrade, got ${response.status}`);
      }
    });

    await this.runTest('PRO plan allows unlimited notes', async () => {
      // Set to PRO plan
      await prisma.tenant.update({
        where: { slug: 'acme' },
        data: { plan: 'PRO' }
      });

      const response = await fetch(`${BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          title: 'PRO Plan Note',
          content: 'This should work on PRO'
        })
      });

      if (!response.ok) {
        throw new Error(`PRO plan note creation failed: ${response.status}`);
      }
    });
  }

  async validateCORS(): Promise<void> {
    console.log('\n🌐 4. Testing CORS Configuration');

    await this.runTest('CORS preflight request', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': EXTERNAL_ORIGIN,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
      const allowMethods = response.headers.get('Access-Control-Allow-Methods');
      const allowHeaders = response.headers.get('Access-Control-Allow-Headers');

      if (!allowOrigin) {
        throw new Error('Missing Access-Control-Allow-Origin header');
      }

      if (!allowMethods) {
        throw new Error('Missing Access-Control-Allow-Methods header');
      }

      if (!allowHeaders) {
        throw new Error('Missing Access-Control-Allow-Headers header');
      }
    });

    await this.runTest('Cross-origin request handling', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        headers: { 'Origin': EXTERNAL_ORIGIN }
      });

      if (!response.ok) {
        throw new Error(`Cross-origin request failed: ${response.status}`);
      }

      const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
      if (!allowOrigin) {
        throw new Error('Missing CORS headers in actual request');
      }
    });
  }

  async validateHealthEndpoint(): Promise<void> {
    console.log('\n❤️ 5. Testing Health Endpoint');

    await this.runTest('Health endpoint returns correct response', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.status !== 'ok') {
        throw new Error(`Expected status 'ok', got '${data.status}'`);
      }
    });

    await this.runTest('Health endpoint accessible without auth', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);

      if (!response.ok) {
        throw new Error(`Health check should not require auth: ${response.status}`);
      }
    });

    await this.runTest('Health endpoint responds quickly', async () => {
      const startTime = Date.now();
      const response = await fetch(`${BASE_URL}/api/health`);
      const endTime = Date.now();

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const responseTime = endTime - startTime;
      if (responseTime > 1000) {
        throw new Error(`Health check too slow: ${responseTime}ms`);
      }
    });
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Final System Validation');
    console.log(`📍 Testing against: ${BASE_URL}`);
    console.log('=' .repeat(60));

    try {
      await this.validatePredefinedAccounts();
      await this.validateTenantIsolation();
      await this.validateSubscriptionLimits();
      await this.validateCORS();
      await this.validateHealthEndpoint();
    } finally {
      await prisma.$disconnect();
    }

    this.printSummary();
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL VALIDATION SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total:  ${total}`);
    console.log(`📊 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  • ${r.name}: ${r.error}`);
        });
    }

    console.log('\n' + (failed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED'));
    console.log('='.repeat(60));

    if (failed > 0) {
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new FinalValidator();
  validator.run().catch(console.error);
}

export { FinalValidator };