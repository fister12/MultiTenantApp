#!/usr/bin/env node

/**
 * Script to run final validation tests
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Running Final System Validation Tests');
console.log('=' .repeat(50));

// Check if we're in development or production mode
const isDev = process.env.NODE_ENV !== 'production';
const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

console.log(`📍 Environment: ${isDev ? 'Development' : 'Production'}`);
console.log(`🌐 Base URL: ${baseUrl}`);

// Run the automated tests first
console.log('\n1️⃣ Running automated test suite...');

const testProcess = spawn('npm', ['run', 'test', '--', 'src/test/final-validation.test.ts', '--run'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Automated tests completed successfully');
    
    // Run manual validation script
    console.log('\n2️⃣ Running manual validation script...');
    
    const manualProcess = spawn('npx', ['tsx', 'src/test/manual-final-validation.ts'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: baseUrl
      }
    });

    manualProcess.on('close', (manualCode) => {
      if (manualCode === 0) {
        console.log('\n🎉 All validation tests passed!');
        console.log('\n✅ System is ready for production use');
        console.log('\n📋 Validation completed for:');
        console.log('  • Predefined accounts login functionality');
        console.log('  • Tenant isolation across all operations');
        console.log('  • Subscription limits and upgrade functionality');
        console.log('  • CORS configuration with external requests');
        console.log('  • Health endpoint accessibility');
      } else {
        console.log('\n❌ Manual validation failed');
        process.exit(1);
      }
    });

    manualProcess.on('error', (err) => {
      console.error('\n❌ Error running manual validation:', err.message);
      process.exit(1);
    });

  } else {
    console.log('\n❌ Automated tests failed');
    process.exit(1);
  }
});

testProcess.on('error', (err) => {
  console.error('\n❌ Error running automated tests:', err.message);
  process.exit(1);
});