/**
 * Manual test script to verify the authentication endpoint works correctly
 * This can be run to test the actual API endpoint functionality
 */

import { POST } from '../app/api/auth/login/route';
import { NextRequest } from 'next/server';

async function testAuthEndpoint() {
  console.log('Testing authentication endpoint...');

  // Test successful login
  const loginRequest = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@acme.test',
      password: 'password',
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  try {
    const response = await POST(loginRequest);
    const data = await response.json();
    
    console.log('Login Response Status:', response.status);
    console.log('Login Response Data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data.token) {
      console.log('✅ Authentication endpoint working correctly!');
      console.log('Token generated:', data.data.token.substring(0, 20) + '...');
      console.log('User data:', data.data.user);
    } else {
      console.log('❌ Authentication endpoint failed');
    }
  } catch (error) {
    console.error('❌ Error testing authentication endpoint:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAuthEndpoint();
}

export { testAuthEndpoint };