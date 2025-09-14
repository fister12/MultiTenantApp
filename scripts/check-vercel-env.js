#!/usr/bin/env node

/**
 * Check Vercel Environment Variables Setup
 * Run this to verify your environment is configured correctly
 */

console.log('🔍 Vercel Environment Variables Checker');
console.log('=======================================');

const requiredVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'NODE_ENV'
];

const optionalVars = [
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL', 
  'POSTGRES_URL_NON_POOLING',
  'SEED_DATABASE',
  'JWT_EXPIRES_IN'
];

console.log('\n📋 Required Environment Variables:');
console.log('----------------------------------');

let missingRequired = [];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${varName === 'JWT_SECRET' ? '[HIDDEN]' : value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    missingRequired.push(varName);
  }
});

console.log('\n📋 Optional Environment Variables:');
console.log('----------------------------------');

optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`⚪ ${varName}: Not set (optional)`);
  }
});

console.log('\n📊 Summary:');
console.log('----------');

if (missingRequired.length === 0) {
  console.log('🎉 All required environment variables are set!');
  console.log('✅ Your deployment should work correctly.');
} else {
  console.log(`❌ Missing ${missingRequired.length} required variable(s):`);
  missingRequired.forEach(varName => {
    console.log(`   • ${varName}`);
  });
  
  console.log('\n🔧 To fix this:');
  console.log('1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
  console.log('2. Add the missing variables listed above');
  console.log('3. Redeploy your project');
}

console.log('\n📝 Quick Setup Guide:');
console.log('--------------------');
console.log('1. DATABASE_URL: Get from Vercel Postgres or your database provider');
console.log('2. JWT_SECRET: Use: vWC5WhqS+f3tTl1NBPf8C5pjhB6MTOOO63GJuQ2zTHg=');
console.log('3. NODE_ENV: Set to "production"');
console.log('4. SEED_DATABASE: Set to "true" to create test accounts');

if (process.env.VERCEL) {
  console.log('\n🚀 Running on Vercel - Environment check complete');
} else {
  console.log('\n💻 Running locally - This check simulates Vercel environment');
}