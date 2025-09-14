/**
 * Manual test script for health endpoint
 * This can be used to test the health endpoint manually
 */

import { GET } from '../app/api/health/route';
import { NextRequest } from 'next/server';

async function testHealthEndpoint() {
  console.log('Testing health endpoint...');
  
  try {
    const mockRequest = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(mockRequest);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    // Verify the response meets the requirement
    if (data.success && data.data?.status === 'ok') {
      console.log('✅ Health endpoint test PASSED - returns status: "ok"');
    } else {
      console.log('❌ Health endpoint test FAILED - does not return status: "ok"');
    }
  } catch (error) {
    console.error('❌ Health endpoint test FAILED with error:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testHealthEndpoint();
}

export { testHealthEndpoint };