/**
 * Manual test script for tenant upgrade endpoint
 * Run with: npx tsx src/test/tenant-upgrade-manual.ts
 */

import { generateToken } from '../lib/auth';

const BASE_URL = 'http://localhost:3000';

async function testTenantUpgrade() {
  console.log('🧪 Testing Tenant Upgrade Endpoint\n');

  // Test data - these should match the seeded accounts
  const adminToken = generateToken({
    userId: 'admin-user-id',
    email: 'admin@acme.test',
    role: 'ADMIN',
    tenantId: 'acme-tenant-id',
    tenantSlug: 'acme',
  });

  const memberToken = generateToken({
    userId: 'member-user-id',
    email: 'user@acme.test',
    role: 'MEMBER',
    tenantId: 'acme-tenant-id',
    tenantSlug: 'acme',
  });

  // Test 1: Admin upgrade (should succeed)
  console.log('1. Testing admin upgrade...');
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/acme/upgrade`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    
    if (response.status === 200 && data.success) {
      console.log('   ✅ Admin upgrade test passed\n');
    } else {
      console.log('   ❌ Admin upgrade test failed\n');
    }
  } catch (error) {
    console.log('   ❌ Admin upgrade test error:', error);
  }

  // Test 2: Member upgrade (should fail)
  console.log('2. Testing member upgrade (should fail)...');
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/acme/upgrade`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    
    if (response.status === 403 && !data.success) {
      console.log('   ✅ Member upgrade rejection test passed\n');
    } else {
      console.log('   ❌ Member upgrade rejection test failed\n');
    }
  } catch (error) {
    console.log('   ❌ Member upgrade test error:', error);
  }

  // Test 3: No authentication (should fail)
  console.log('3. Testing no authentication (should fail)...');
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/acme/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    
    if (response.status === 401 && !data.success) {
      console.log('   ✅ No auth rejection test passed\n');
    } else {
      console.log('   ❌ No auth rejection test failed\n');
    }
  } catch (error) {
    console.log('   ❌ No auth test error:', error);
  }

  // Test 4: Cross-tenant access (should fail)
  console.log('4. Testing cross-tenant access (should fail)...');
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/globex/upgrade`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`, // Acme admin trying to upgrade Globex
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    
    if (response.status === 403 && !data.success) {
      console.log('   ✅ Cross-tenant rejection test passed\n');
    } else {
      console.log('   ❌ Cross-tenant rejection test failed\n');
    }
  } catch (error) {
    console.log('   ❌ Cross-tenant test error:', error);
  }

  console.log('🏁 Tenant upgrade endpoint tests completed!');
}

// Run the tests
testTenantUpgrade().catch(console.error);