#!/usr/bin/env node

/**
 * Vercel Deployment Configuration Script
 * 
 * This script helps configure the Vercel deployment by:
 * 1. Validating the deployment configuration
 * 2. Providing setup instructions
 * 3. Generating secure JWT secrets
 * 4. Verifying all required files and scripts
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function log(message) {
  console.log(`🔧 ${message}`);
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

function info(message) {
  console.log(`ℹ️  ${message}`);
}

function generateJWTSecret() {
  return crypto.randomBytes(32).toString('base64');
}

function validateDeploymentConfig() {
  log('Validating Vercel deployment configuration...');
  
  const requiredFiles = [
    'vercel.json',
    'package.json',
    'next.config.ts',
    'prisma/schema.prisma',
    '.env.example',
    'DEPLOYMENT.md',
    'VERCEL_SETUP.md',
    'VERCEL_DEPLOYMENT_CHECKLIST.md'
  ];

  const requiredScripts = [
    'scripts/setup-production-db.js',
    'scripts/verify-deployment.js',
    'scripts/post-deployment-test.js'
  ];

  let allValid = true;

  // Check required files
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      success(`Found: ${file}`);
    } else {
      error(`Missing: ${file}`);
      allValid = false;
    }
  });

  // Check required scripts
  requiredScripts.forEach(script => {
    if (fs.existsSync(script)) {
      success(`Found: ${script}`);
    } else {
      error(`Missing: ${script}`);
      allValid = false;
    }
  });

  return allValid;
}

function displaySetupInstructions() {
  console.log('\n🚀 Vercel Deployment Setup Instructions\n');
  
  console.log('1️⃣  VERCEL PROJECT SETUP');
  console.log('   • Create account at https://vercel.com');
  console.log('   • Install CLI: npm i -g vercel');
  console.log('   • Login: vercel login');
  console.log('   • Import project: vercel --prod\n');
  
  console.log('2️⃣  DATABASE SETUP');
  console.log('   Option A - Vercel Postgres (Recommended):');
  console.log('   • Go to Vercel Dashboard → Storage → Create Database');
  console.log('   • Select PostgreSQL');
  console.log('   • Copy the connection strings provided\n');
  
  console.log('   Option B - External PostgreSQL:');
  console.log('   • Set up PostgreSQL with your preferred provider');
  console.log('   • Ensure database is accessible from Vercel');
  console.log('   • Get connection string format: postgresql://user:pass@host:port/db\n');
  
  console.log('3️⃣  ENVIRONMENT VARIABLES');
  console.log('   Go to Vercel Dashboard → Project → Settings → Environment Variables');
  console.log('   Add these REQUIRED variables:\n');
  
  const jwtSecret = generateJWTSecret();
  console.log('   DATABASE_URL=postgresql://username:password@host:port/database_name');
  console.log(`   JWT_SECRET=${jwtSecret}`);
  console.log('   NODE_ENV=production\n');
  
  console.log('   Optional variables (for Vercel Postgres):');
  console.log('   POSTGRES_URL=postgresql://username:password@host:port/database_name');
  console.log('   POSTGRES_PRISMA_URL=postgresql://username:password@host:port/database_name?pgbouncer=true&connect_timeout=15');
  console.log('   POSTGRES_URL_NON_POOLING=postgresql://username:password@host:port/database_name');
  console.log('   SEED_DATABASE=true\n');
  
  console.log('4️⃣  DEPLOY');
  console.log('   Method 1 - Git Integration (Recommended):');
  console.log('   • Push code to GitHub/GitLab/Bitbucket');
  console.log('   • Vercel auto-deploys on push to main branch\n');
  
  console.log('   Method 2 - CLI:');
  console.log('   • Run: vercel --prod\n');
  
  console.log('5️⃣  VERIFY DEPLOYMENT');
  console.log('   After deployment, test your app:');
  console.log('   • Health check: curl https://your-app.vercel.app/api/health');
  console.log('   • Login test: Use test accounts (see DEPLOYMENT.md)');
  console.log('   • Run: node scripts/post-deployment-test.js https://your-app.vercel.app\n');
}

function displayTestAccounts() {
  console.log('👥 TEST ACCOUNTS (Password: "password")');
  console.log('   • admin@acme.test (Admin, Acme tenant)');
  console.log('   • user@acme.test (Member, Acme tenant)');
  console.log('   • admin@globex.test (Admin, Globex tenant)');
  console.log('   • user@globex.test (Member, Globex tenant)\n');
}

function displayBuildProcess() {
  console.log('🔨 BUILD PROCESS');
  console.log('   The deployment uses this sequence:');
  console.log('   1. npm install - Install dependencies');
  console.log('   2. node scripts/setup-production-db.js - Setup database');
  console.log('   3. prisma generate - Generate Prisma client');
  console.log('   4. prisma migrate deploy - Run migrations');
  console.log('   5. prisma db seed - Seed database (if SEED_DATABASE=true)');
  console.log('   6. next build - Build Next.js application\n');
}

function displayTroubleshooting() {
  console.log('🔧 TROUBLESHOOTING');
  console.log('   Build Failures:');
  console.log('   • Check Vercel build logs');
  console.log('   • Verify environment variables are set');
  console.log('   • Ensure DATABASE_URL is accessible\n');
  
  console.log('   Database Issues:');
  console.log('   • Verify connection string format');
  console.log('   • Check database credentials');
  console.log('   • Ensure database allows Vercel connections\n');
  
  console.log('   Authentication Issues:');
  console.log('   • Ensure JWT_SECRET is 32+ characters');
  console.log('   • Verify JWT_SECRET is set in production\n');
}

function main() {
  console.log('🚀 Vercel Deployment Configuration Tool\n');
  
  // Validate configuration
  const isValid = validateDeploymentConfig();
  
  if (!isValid) {
    error('\nDeployment configuration is incomplete!');
    console.log('Please ensure all required files are present before deploying.\n');
    return;
  }
  
  success('\n✅ All deployment files are present and configured!\n');
  
  // Display setup instructions
  displaySetupInstructions();
  displayTestAccounts();
  displayBuildProcess();
  displayTroubleshooting();
  
  console.log('📚 DOCUMENTATION');
  console.log('   • Complete guide: DEPLOYMENT.md');
  console.log('   • Quick setup: VERCEL_SETUP.md');
  console.log('   • Checklist: VERCEL_DEPLOYMENT_CHECKLIST.md\n');
  
  console.log('🎯 NEXT STEPS');
  console.log('   1. Follow the setup instructions above');
  console.log('   2. Configure environment variables in Vercel');
  console.log('   3. Deploy your application');
  console.log('   4. Run post-deployment tests');
  console.log('   5. Verify all functionality works\n');
  
  success('🎉 Your application is ready for Vercel deployment!');
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  validateDeploymentConfig,
  generateJWTSecret,
  displaySetupInstructions
};