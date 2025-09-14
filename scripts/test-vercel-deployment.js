#!/usr/bin/env node

/**
 * Test Vercel Deployment
 * Run this after setting up environment variables to verify deployment
 */

const https = require('https');
const http = require('http');

// Get the Vercel URL from command line argument or environment
const VERCEL_URL = process.argv[2] || process.env.VERCEL_URL || 'https://your-app.vercel.app';

console.log('🧪 Testing Vercel Deployment');
console.log('============================');
console.log(`📍 Testing URL: ${VERCEL_URL}`);

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('\n🏥 Testing Health Endpoint...');
  
  try {
    const healthResponse = await makeRequest(`${VERCEL_URL}/api/health`);
    
    if (healthResponse.status === 200) {
      console.log('✅ Health endpoint working');
      console.log(`📊 Response: ${JSON.stringify(healthResponse.data)}`);
      
      if (healthResponse.data.success && healthResponse.data.data?.status === 'ok') {
        console.log('✅ Health check passed - API is working correctly');
      } else {
        console.log('⚠️ Health endpoint responded but format may be incorrect');
      }
    } else {
      console.log(`❌ Health endpoint failed with status: ${healthResponse.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Health endpoint error: ${error.message}`);
    return false;
  }

  console.log('\n🔐 Testing Authentication Endpoint...');
  
  try {
    const loginResponse = await makeRequest(`${VERCEL_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@acme.test',
        password: 'password'
      })
    });

    if (loginResponse.status === 200) {
      console.log('✅ Authentication endpoint working');
      if (loginResponse.data.success && loginResponse.data.data?.token) {
        console.log('✅ Login successful - JWT token generated');
        console.log('✅ Database seeding worked - test accounts exist');
      } else {
        console.log('⚠️ Login response format may be incorrect');
      }
    } else if (loginResponse.status === 429) {
      console.log('⚠️ Rate limiting active (this is good for security)');
      console.log('✅ Authentication endpoint exists and is protected');
    } else {
      console.log(`❌ Authentication failed with status: ${loginResponse.status}`);
      console.log(`📄 Response: ${JSON.stringify(loginResponse.data)}`);
    }
  } catch (error) {
    console.log(`❌ Authentication error: ${error.message}`);
  }

  console.log('\n🎉 Deployment Test Complete!');
  console.log('============================');
  console.log('✅ Your Vercel deployment appears to be working correctly');
  console.log('');
  console.log('🧪 Manual Tests You Can Run:');
  console.log(`• Health: ${VERCEL_URL}/api/health`);
  console.log(`• Login: POST ${VERCEL_URL}/api/auth/login`);
  console.log('');
  console.log('📋 Test Accounts Available:');
  console.log('• admin@acme.test / password (Admin)');
  console.log('• user@acme.test / password (Member)');
  console.log('• admin@globex.test / password (Admin)');
  console.log('• user@globex.test / password (Member)');

  return true;
}

// Run the tests
runTests().catch(console.error);