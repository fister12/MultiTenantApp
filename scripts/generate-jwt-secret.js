#!/usr/bin/env node

/**
 * Generate a secure JWT secret for production use
 */

const crypto = require('crypto');

console.log('🔐 Generating secure JWT secret...');
console.log('=====================================');

// Generate a 32-byte random string and encode as base64
const jwtSecret = crypto.randomBytes(32).toString('base64');

console.log('✅ Generated JWT Secret:');
console.log('');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log('');
console.log('📋 Copy this value to your Vercel environment variables');
console.log('🔒 Keep this secret secure and never commit it to version control');
console.log('');
console.log('📝 To set in Vercel:');
console.log('1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
console.log('2. Add new variable: JWT_SECRET');
console.log('3. Paste the value above');
console.log('4. Set environment to "Production"');
console.log('5. Save and redeploy');