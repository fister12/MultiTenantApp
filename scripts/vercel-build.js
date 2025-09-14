#!/usr/bin/env node

/**
 * Vercel Build Script
 * Handles the build process with proper environment variable validation
 */

const { execSync } = require('child_process');

console.log('🚀 Starting Vercel Build Process');
console.log('================================');

// Check required environment variables
const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   • ${varName}`);
  });
  console.error('');
  console.error('🔧 To fix this:');
  console.error('1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
  console.error('2. Add the missing variables');
  console.error('3. Redeploy your project');
  console.error('');
  console.error('📋 Required values:');
  console.error('• DATABASE_URL: Your PostgreSQL connection string');
  console.error('• JWT_SECRET: A secure 32+ character string');
  console.error('• NODE_ENV: Set to "production"');
  process.exit(1);
}

console.log('✅ Environment variables validated');

try {
  console.log('📦 Generating Prisma client...');
  execSync('prisma generate', { stdio: 'inherit' });

  console.log('🗄️ Running database migrations...');
  execSync('prisma migrate deploy', { stdio: 'inherit' });

  // Only seed if SEED_DATABASE is true
  if (process.env.SEED_DATABASE === 'true') {
    console.log('🌱 Seeding database...');
    execSync('npm run db:seed', { stdio: 'inherit' });
  } else {
    console.log('⏭️ Skipping database seeding (SEED_DATABASE not set to true)');
  }

  console.log('🏗️ Building Next.js application...');
  execSync('next build', { stdio: 'inherit' });

  console.log('✅ Build completed successfully!');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}