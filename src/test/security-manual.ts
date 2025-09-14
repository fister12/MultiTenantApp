/**
 * Manual Security Testing Script
 * 
 * This script demonstrates the security features implemented in the API.
 * Run this with: npm run dev (in another terminal) and then tsx src/test/security-manual.ts
 */

const API_BASE = 'http://localhost:3000/api';

interface TestResult {
  test: string;
  status: number;
  success: boolean;
  message: string;
  headers?: Record<string, string>;
}

async function makeRequest(
  endpoint: string, 
  options: RequestInit = {}
): Promise<TestResult> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    
    // Extract relevant headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (key.startsWith('x-ratelimit-') || 
          key.startsWith('access-control-') || 
          key.startsWith('x-content-type-') ||
          key.startsWith('x-frame-') ||
          key.startsWith('x-xss-')) {
        headers[key] = value;
      }
    });

    return {
      test: `${options.method || 'GET'} ${endpoint}`,
      status: response.status,
      success: response.ok,
      message: data.error?.message || data.message || 'Success',
      headers,
    };
  } catch (error) {
    return {
      test: `${options.method || 'GET'} ${endpoint}`,
      status: 0,
      success: false,
      message: `Network error: ${error}`,
    };
  }
}

async function runSecurityTests() {
  console.log('🔒 Running Security Feature Tests\n');
  
  const results: TestResult[] = [];

  // Test 1: Health endpoint with security headers
  console.log('1. Testing health endpoint security headers...');
  const healthResult = await makeRequest('/health');
  results.push(healthResult);
  console.log(`   Status: ${healthResult.status}`);
  console.log(`   Security Headers: ${Object.keys(healthResult.headers || {}).length} found`);
  if (healthResult.headers) {
    Object.entries(healthResult.headers).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  }
  console.log();

  // Test 2: CORS preflight request
  console.log('2. Testing CORS preflight request...');
  const corsResult = await makeRequest('/health', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'GET',
    },
  });
  results.push(corsResult);
  console.log(`   Status: ${corsResult.status}`);
  console.log(`   CORS Headers: ${Object.keys(corsResult.headers || {}).filter(h => h.startsWith('access-control')).length} found`);
  console.log();

  // Test 3: Rate limiting (multiple requests)
  console.log('3. Testing rate limiting...');
  const rateLimitResults = [];
  for (let i = 0; i < 3; i++) {
    const result = await makeRequest('/health');
    rateLimitResults.push(result);
    console.log(`   Request ${i + 1}: Status ${result.status}, Remaining: ${result.headers?.['x-ratelimit-remaining'] || 'N/A'}`);
  }
  console.log();

  // Test 4: Invalid content type for auth endpoint
  console.log('4. Testing content type validation...');
  const contentTypeResult = await makeRequest('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: 'invalid content type',
  });
  results.push(contentTypeResult);
  console.log(`   Status: ${contentTypeResult.status} (should be 415)`);
  console.log(`   Message: ${contentTypeResult.message}`);
  console.log();

  // Test 5: Request size limit
  console.log('5. Testing request size limits...');
  const largePayload = 'x'.repeat(15000); // 15KB payload
  const sizeResult = await makeRequest('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Length': largePayload.length.toString(),
    },
    body: JSON.stringify({ data: largePayload }),
  });
  results.push(sizeResult);
  console.log(`   Status: ${sizeResult.status} (should be 413)`);
  console.log(`   Message: ${sizeResult.message}`);
  console.log();

  // Test 6: Unauthorized origin CORS
  console.log('6. Testing unauthorized origin CORS...');
  const unauthorizedCorsResult = await makeRequest('/health', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://malicious-site.com',
    },
  });
  results.push(unauthorizedCorsResult);
  console.log(`   Status: ${unauthorizedCorsResult.status}`);
  console.log(`   Origin header: ${unauthorizedCorsResult.headers?.['access-control-allow-origin'] || 'Not set'}`);
  console.log();

  // Summary
  console.log('📊 Test Summary:');
  console.log('================');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} Test ${index + 1}: ${result.test} - ${result.status} - ${result.message}`);
  });

  const passedTests = results.filter(r => r.success).length;
  console.log(`\n${passedTests}/${results.length} tests passed`);

  // Security feature verification
  console.log('\n🛡️  Security Features Verified:');
  console.log('================================');
  
  const hasSecurityHeaders = results.some(r => 
    r.headers && Object.keys(r.headers).some(h => h.startsWith('x-'))
  );
  console.log(`✅ Security Headers: ${hasSecurityHeaders ? 'Implemented' : 'Missing'}`);
  
  const hasCors = results.some(r => 
    r.headers && Object.keys(r.headers).some(h => h.startsWith('access-control'))
  );
  console.log(`✅ CORS Configuration: ${hasCors ? 'Implemented' : 'Missing'}`);
  
  const hasRateLimit = results.some(r => 
    r.headers && Object.keys(r.headers).some(h => h.startsWith('x-ratelimit'))
  );
  console.log(`✅ Rate Limiting: ${hasRateLimit ? 'Implemented' : 'Missing'}`);
  
  const hasContentValidation = results.some(r => 
    r.status === 415 && r.message.includes('content type')
  );
  console.log(`✅ Content Type Validation: ${hasContentValidation ? 'Implemented' : 'Missing'}`);
  
  const hasSizeValidation = results.some(r => 
    r.status === 413 && r.message.includes('too large')
  );
  console.log(`✅ Request Size Limits: ${hasSizeValidation ? 'Implemented' : 'Missing'}`);
}

// Run the tests
runSecurityTests().catch(console.error);