#!/usr/bin/env node

/**
 * Post-Deployment Testing Script
 * 
 * This script tests the deployed application to ensure all functionality works correctly.
 * Run this after deploying to Vercel to verify the deployment.
 */

const https = require('https');
const http = require('http');

function log(message) {
  console.log(`🧪 ${message}`);
}

function error(message) {
  console.error(`❌ ${message}`);
}

function success(message) {
  console.log(`✅ ${message}`);
}

function warning(message) {
  console.warn(`⚠️  ${message}`);
}

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https://') ? https : http;
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = protocol.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testDeployment(baseUrl) {
  log(`Testing deployment at: ${baseUrl}`);
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };

  // Test 1: Health Check
  try {
    log('Testing health endpoint...');
    const response = await makeRequest(`${baseUrl}/api/health`);
    
    if (response.status === 200 && response.data.status === 'ok') {
      success('Health check passed');
      results.passed++;
    } else {
      error(`Health check failed: ${response.status} - ${JSON.stringify(response.data)}`);
      results.failed++;
    }
  } catch (err) {
    error(`Health check error: ${err.message}`);
    results.failed++;
  }

  // Test 2: CORS Headers
  try {
    log('Testing CORS configuration...');
    const response = await makeRequest(`${baseUrl}/api/health`);
    
    const corsHeaders = [
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers'
    ];
    
    let corsConfigured = true;
    corsHeaders.forEach(header => {
      if (!response.headers[header]) {
        corsConfigured = false;
      }
    });
    
    if (corsConfigured) {
      success('CORS headers configured correctly');
      results.passed++;
    } else {
      warning('Some CORS headers may be missing');
      results.warnings++;
    }
  } catch (err) {
    error(`CORS test error: ${err.message}`);
    results.failed++;
  }

  // Test 3: Authentication Endpoint
  try {
    log('Testing authentication endpoint...');
    const response = await makeRequest(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: {
        email: 'admin@acme.test',
        password: 'password'
      }
    });
    
    if (response.status === 200 && response.data.token) {
      success('Authentication endpoint working');
      results.passed++;
      
      // Store token for further tests
      global.testToken = response.data.token;
    } else {
      error(`Authentication failed: ${response.status} - ${JSON.stringify(response.data)}`);
      results.failed++;
    }
  } catch (err) {
    error(`Authentication test error: ${err.message}`);
    results.failed++;
  }

  // Test 4: Protected Endpoint (Notes API)
  if (global.testToken) {
    try {
      log('Testing protected notes endpoint...');
      const response = await makeRequest(`${baseUrl}/api/notes`, {
        headers: {
          'Authorization': `Bearer ${global.testToken}`
        }
      });
      
      if (response.status === 200 && Array.isArray(response.data)) {
        success('Protected notes endpoint working');
        results.passed++;
      } else {
        error(`Notes endpoint failed: ${response.status} - ${JSON.stringify(response.data)}`);
        results.failed++;
      }
    } catch (err) {
      error(`Notes endpoint test error: ${err.message}`);
      results.failed++;
    }
  } else {
    warning('Skipping protected endpoint test (no auth token)');
    results.warnings++;
  }

  // Test 5: Security Headers
  try {
    log('Testing security headers...');
    const response = await makeRequest(`${baseUrl}/api/health`);
    
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection'
    ];
    
    let securityConfigured = true;
    securityHeaders.forEach(header => {
      if (!response.headers[header]) {
        securityConfigured = false;
      }
    });
    
    if (securityConfigured) {
      success('Security headers configured correctly');
      results.passed++;
    } else {
      warning('Some security headers may be missing');
      results.warnings++;
    }
  } catch (err) {
    error(`Security headers test error: ${err.message}`);
    results.failed++;
  }

  // Test 6: Frontend Accessibility
  try {
    log('Testing frontend accessibility...');
    const response = await makeRequest(baseUrl);
    
    if (response.status === 200) {
      success('Frontend is accessible');
      results.passed++;
    } else {
      error(`Frontend not accessible: ${response.status}`);
      results.failed++;
    }
  } catch (err) {
    error(`Frontend test error: ${err.message}`);
    results.failed++;
  }

  // Results Summary
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  
  if (results.failed === 0) {
    success('\n🎉 All critical tests passed! Your deployment is working correctly.');
    
    if (results.warnings > 0) {
      warning('Consider addressing the warnings above for optimal performance.');
    }
    
    console.log('\n🔗 Test your application:');
    console.log(`   Frontend: ${baseUrl}`);
    console.log(`   Health Check: ${baseUrl}/api/health`);
    console.log(`   Login: ${baseUrl}/login`);
    
    console.log('\n👥 Test Accounts (password: "password"):');
    console.log('   - admin@acme.test (Admin, Acme tenant)');
    console.log('   - user@acme.test (Member, Acme tenant)');
    console.log('   - admin@globex.test (Admin, Globex tenant)');
    console.log('   - user@globex.test (Member, Globex tenant)');
    
    process.exit(0);
  } else {
    error('\n🚫 Some tests failed. Please check the deployment configuration.');
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const baseUrl = process.argv[2];
  
  if (!baseUrl) {
    error('Please provide the base URL of your deployed application');
    console.log('Usage: node scripts/post-deployment-test.js https://your-app.vercel.app');
    process.exit(1);
  }
  
  testDeployment(baseUrl).catch(err => {
    error(`Test execution failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { testDeployment };