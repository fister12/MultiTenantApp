#!/usr/bin/env node

/**
 * Deployment Verification Script
 * 
 * This script verifies that the deployment configuration is correct
 * and all required environment variables are set.
 */

const fs = require('fs');
const path = require('path');

function log(message) {
  console.log(`🔍 ${message}`);
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

function verifyDeploymentConfig() {
  log('Verifying deployment configuration...');

  const errors = [];
  const warnings = [];

  // Check required files
  const requiredFiles = [
    'vercel.json',
    'package.json',
    'next.config.ts',
    'prisma/schema.prisma',
    '.env.example',
    'DEPLOYMENT.md'
  ];

  requiredFiles.forEach(file => {
    if (!fs.existsSync(path.join(process.cwd(), file))) {
      errors.push(`Missing required file: ${file}`);
    } else {
      success(`Found required file: ${file}`);
    }
  });

  // Check environment variables
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
  const optionalEnvVars = ['NODE_ENV', 'VERCEL_URL'];

  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    } else {
      success(`Found required environment variable: ${envVar}`);
    }
  });

  optionalEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      warnings.push(`Optional environment variable not set: ${envVar}`);
    } else {
      success(`Found optional environment variable: ${envVar}`);
    }
  });

  // Check JWT secret strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters long for security');
  }

  // Check database URL format
  if (process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL.includes('postgresql')) {
      errors.push('Production DATABASE_URL should use PostgreSQL');
    }
  }

  // Check package.json scripts
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredScripts = ['build', 'start', 'vercel-build', 'db:generate', 'db:migrate'];
    
    requiredScripts.forEach(script => {
      if (!packageJson.scripts[script]) {
        errors.push(`Missing required script in package.json: ${script}`);
      } else {
        success(`Found required script: ${script}`);
      }
    });
  } catch (err) {
    errors.push('Could not read or parse package.json');
  }

  // Check Vercel configuration
  try {
    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    
    if (!vercelConfig.buildCommand) {
      warnings.push('No buildCommand specified in vercel.json');
    }
    
    if (!vercelConfig.functions) {
      warnings.push('No function configuration in vercel.json');
    }
    
    success('Vercel configuration file is valid JSON');
  } catch (err) {
    errors.push('Could not read or parse vercel.json');
  }

  // Report results
  console.log('\n📊 Verification Results:');
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   ${warning}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(error => console.log(`   ${error}`));
    console.log('\n🚫 Deployment verification failed. Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed! Deployment configuration is ready.');
    
    if (warnings.length > 0) {
      console.log('\n💡 Consider addressing the warnings above for optimal deployment.');
    }
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  verifyDeploymentConfig();
}

module.exports = { verifyDeploymentConfig };