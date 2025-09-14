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
  console.error('🔧 IMMEDIATE FIX STEPS:');
  console.error('1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
  console.error('2. Add these variables:');
  console.error('   • DATABASE_URL = [Your Postgres connection string from Vercel Storage]');
  console.error('   • JWT_SECRET = vWC5WhqS+f3tTl1NBPf8C5pjhB6MTOOO63GJuQ2zTHg=');
  console.error('   • NODE_ENV = production');
  console.error('3. Set Environment to "Production" for each variable');
  console.error('4. Redeploy your project');
  console.error('');
  console.error('📍 Where to find DATABASE_URL:');
  console.error('   Vercel Dashboard → Storage → Your Postgres DB → Settings tab');
  process.exit(1);
}

// Validate DATABASE_URL format
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl && !databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
  console.error('❌ DATABASE_URL format is incorrect');
  console.error(`   Current value starts with: ${databaseUrl.substring(0, 10)}...`);
  console.error('   Expected format: postgresql://username:password@host:port/database');
  console.error('');
  console.error('🔧 Fix: Get the correct PostgreSQL connection string from:');
  console.error('   Vercel Dashboard → Storage → Your Postgres DB → Settings');
  process.exit(1);
}

console.log('✅ Environment variables validated');

try {
  console.log('📦 Generating Prisma client...');
  execSync('prisma generate', { stdio: 'inherit' });

  console.log('🗄️ Setting up database schema...');
  try {
    // Deploy migrations for PostgreSQL
    execSync('prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ Database migrations deployed successfully');
  } catch (error) {
    console.log('⚠️ Migration deploy failed, trying db push...');
    try {
      // Fallback to db push if migrations fail
      execSync('prisma db push', { stdio: 'inherit' });
      console.log('✅ Database schema pushed successfully');
    } catch (pushError) {
      console.error('❌ Both migrate deploy and db push failed');
      throw pushError;
    }
  }

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