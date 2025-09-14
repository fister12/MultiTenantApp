#!/usr/bin/env node

/**
 * Production Database Setup Script
 * 
 * This script sets up the database for production deployment on Vercel.
 * It handles Prisma client generation, migrations, and optional seeding.
 */

const { execSync } = require('child_process');

function log(message) {
  console.log(`🔧 ${message}`);
}

function error(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function success(message) {
  console.log(`✅ ${message}`);
}

function warning(message) {
  console.warn(`⚠️  ${message}`);
}

async function setupProductionDatabase() {
  log('Setting up production database for Vercel deployment...');

  // Validate environment
  const databaseUrl = process.env.DATABASE_URL;
  const nodeEnv = process.env.NODE_ENV;
  
  log(`Environment: ${nodeEnv || 'not set'}`);
  log(`Database URL configured: ${databaseUrl ? 'Yes' : 'No'}`);

  // Check for PostgreSQL connection string
  if (!databaseUrl) {
    error('DATABASE_URL environment variable is required for production deployment');
  }

  if (!databaseUrl.includes('postgresql://') && !databaseUrl.includes('postgres://')) {
    error('DATABASE_URL must be a PostgreSQL connection string for production');
  }

  try {
    // Generate Prisma client with production configuration
    log('Generating Prisma client for production...');
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    success('Prisma client generated successfully');

    // Deploy database migrations
    log('Deploying database migrations...');
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    success('Database migrations deployed successfully');

    // Check if database seeding is requested
    const shouldSeed = process.env.SEED_DATABASE === 'true';
    
    if (shouldSeed) {
      log('Seeding database with test accounts...');
      try {
        execSync('npx tsx prisma/seed.ts', { 
          stdio: 'inherit',
          env: { ...process.env, NODE_ENV: 'production' }
        });
        success('Database seeded with test accounts');
        log('Test accounts created:');
        log('  - admin@acme.test (Admin, Acme tenant)');
        log('  - user@acme.test (Member, Acme tenant)');
        log('  - admin@globex.test (Admin, Globex tenant)');
        log('  - user@globex.test (Member, Globex tenant)');
        log('  Password for all accounts: "password"');
      } catch (seedError) {
        warning('Database seeding failed - this may be expected if data already exists');
        log('Continuing with deployment...');
      }
    } else {
      log('Database seeding skipped (SEED_DATABASE not set to "true")');
    }

    // Verify database connection
    log('Verifying database connection...');
    try {
      execSync('npx prisma db pull --print', { 
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'production' }
      });
      success('Database connection verified');
    } catch (verifyError) {
      warning('Could not verify database connection, but continuing...');
    }

    success('🚀 Production database setup completed successfully!');
    log('Your application is ready for deployment on Vercel.');

  } catch (err) {
    error(`Database setup failed: ${err.message}`);
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupProductionDatabase().catch(err => {
    error(`Setup failed: ${err.message}`);
  });
}

module.exports = { setupProductionDatabase };