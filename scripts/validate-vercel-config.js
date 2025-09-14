#!/usr/bin/env node

/**
 * Vercel Configuration Validation Script
 * 
 * This script validates that all Vercel deployment configuration is correct
 * and provides specific guidance for any issues found.
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

function info(message) {
  console.log(`ℹ️  ${message}`);
}

class DeploymentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  validateFile(filePath, description) {
    if (fs.existsSync(filePath)) {
      this.passed.push(`${description}: ${filePath}`);
      return true;
    } else {
      this.errors.push(`Missing ${description}: ${filePath}`);
      return false;
    }
  }

  validateJSON(filePath, description) {
    if (!this.validateFile(filePath, description)) {
      return false;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      JSON.parse(content);
      this.passed.push(`Valid JSON: ${filePath}`);
      return true;
    } catch (err) {
      this.errors.push(`Invalid JSON in ${filePath}: ${err.message}`);
      return false;
    }
  }

  validatePackageJson() {
    log('Validating package.json configuration...');
    
    if (!this.validateJSON('package.json', 'package.json')) {
      return false;
    }

    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredScripts = [
      'build',
      'start',
      'vercel-build',
      'db:generate',
      'db:migrate',
      'db:setup-prod',
      'verify-deployment',
      'test-deployment',
      'configure-deployment'
    ];

    requiredScripts.forEach(script => {
      if (packageJson.scripts && packageJson.scripts[script]) {
        this.passed.push(`Script configured: ${script}`);
      } else {
        this.errors.push(`Missing required script: ${script}`);
      }
    });

    // Check dependencies
    const requiredDeps = ['@prisma/client', 'prisma', 'next', 'bcrypt', 'jsonwebtoken'];
    requiredDeps.forEach(dep => {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        this.passed.push(`Dependency found: ${dep}`);
      } else {
        this.errors.push(`Missing required dependency: ${dep}`);
      }
    });

    return this.errors.length === 0;
  }

  validateVercelJson() {
    log('Validating vercel.json configuration...');
    
    if (!this.validateJSON('vercel.json', 'Vercel configuration')) {
      return false;
    }

    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    
    // Check build command
    if (vercelConfig.buildCommand) {
      this.passed.push(`Build command configured: ${vercelConfig.buildCommand}`);
    } else {
      this.warnings.push('No buildCommand specified in vercel.json');
    }

    // Check functions configuration
    if (vercelConfig.functions) {
      this.passed.push('Function configuration found');
    } else {
      this.warnings.push('No function configuration in vercel.json');
    }

    // Check headers for CORS
    if (vercelConfig.headers && vercelConfig.headers.length > 0) {
      this.passed.push('Headers configuration found');
      
      const apiHeaders = vercelConfig.headers.find(h => h.source.includes('/api/'));
      if (apiHeaders) {
        const corsHeaders = apiHeaders.headers.filter(h => 
          h.key.toLowerCase().includes('access-control')
        );
        if (corsHeaders.length > 0) {
          this.passed.push('CORS headers configured');
        } else {
          this.warnings.push('CORS headers may not be configured');
        }
      }
    } else {
      this.warnings.push('No headers configuration found');
    }

    return true;
  }

  validateNextConfig() {
    log('Validating Next.js configuration...');
    
    if (!this.validateFile('next.config.ts', 'Next.js configuration')) {
      return false;
    }

    // Basic validation - check if file is readable
    try {
      const content = fs.readFileSync('next.config.ts', 'utf8');
      if (content.includes('headers()')) {
        this.passed.push('Headers configuration found in next.config.ts');
      } else {
        this.warnings.push('No headers configuration in next.config.ts');
      }
      
      if (content.includes('Access-Control-Allow-Origin')) {
        this.passed.push('CORS configuration found in next.config.ts');
      } else {
        this.warnings.push('CORS may not be configured in next.config.ts');
      }
    } catch (err) {
      this.errors.push(`Could not read next.config.ts: ${err.message}`);
      return false;
    }

    return true;
  }

  validatePrismaSchema() {
    log('Validating Prisma schema...');
    
    if (!this.validateFile('prisma/schema.prisma', 'Prisma schema')) {
      return false;
    }

    try {
      const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
      
      // Check for required models
      const requiredModels = ['Tenant', 'User', 'Note'];
      requiredModels.forEach(model => {
        if (schema.includes(`model ${model}`)) {
          this.passed.push(`Prisma model found: ${model}`);
        } else {
          this.errors.push(`Missing Prisma model: ${model}`);
        }
      });

      // Check for tenant isolation (tenantId fields)
      if (schema.includes('tenantId')) {
        this.passed.push('Tenant isolation fields found');
      } else {
        this.errors.push('Tenant isolation may not be configured');
      }

    } catch (err) {
      this.errors.push(`Could not read Prisma schema: ${err.message}`);
      return false;
    }

    return true;
  }

  validateDeploymentScripts() {
    log('Validating deployment scripts...');
    
    const requiredScripts = [
      'scripts/setup-production-db.js',
      'scripts/verify-deployment.js',
      'scripts/post-deployment-test.js',
      'scripts/configure-vercel-deployment.js'
    ];

    requiredScripts.forEach(script => {
      this.validateFile(script, 'deployment script');
    });

    return true;
  }

  validateDocumentation() {
    log('Validating deployment documentation...');
    
    const requiredDocs = [
      'DEPLOYMENT.md',
      'VERCEL_SETUP.md',
      'VERCEL_DEPLOYMENT_CHECKLIST.md',
      '.env.example',
      '.env.vercel.template'
    ];

    requiredDocs.forEach(doc => {
      this.validateFile(doc, 'documentation file');
    });

    return true;
  }

  validateEnvironmentTemplate() {
    log('Validating environment variable templates...');
    
    if (this.validateFile('.env.example', 'environment example')) {
      const envExample = fs.readFileSync('.env.example', 'utf8');
      if (envExample.includes('DATABASE_URL') && envExample.includes('JWT_SECRET')) {
        this.passed.push('Environment template includes required variables');
      } else {
        this.warnings.push('Environment template may be missing required variables');
      }
    }

    return true;
  }

  generateReport() {
    console.log('\n📊 Vercel Deployment Configuration Report\n');
    
    if (this.passed.length > 0) {
      success(`✅ Passed Checks (${this.passed.length}):`);
      this.passed.forEach(item => console.log(`   ${item}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      warning(`⚠️  Warnings (${this.warnings.length}):`);
      this.warnings.forEach(item => console.log(`   ${item}`));
      console.log('');
    }

    if (this.errors.length > 0) {
      error(`❌ Errors (${this.errors.length}):`);
      this.errors.forEach(item => console.log(`   ${item}`));
      console.log('');
    }

    // Overall status
    if (this.errors.length === 0) {
      success('🎉 Vercel deployment configuration is ready!');
      
      if (this.warnings.length > 0) {
        info('💡 Consider addressing the warnings above for optimal deployment.');
      }
      
      console.log('\n🚀 Next Steps:');
      console.log('   1. Set up your Vercel project and database');
      console.log('   2. Configure environment variables in Vercel dashboard');
      console.log('   3. Deploy your application');
      console.log('   4. Run post-deployment tests');
      
      return true;
    } else {
      error('🚫 Deployment configuration has errors that must be fixed.');
      console.log('\n🔧 To fix these issues:');
      console.log('   1. Review the errors listed above');
      console.log('   2. Check the deployment documentation');
      console.log('   3. Run this script again after making fixes');
      
      return false;
    }
  }

  validate() {
    log('Starting Vercel deployment configuration validation...\n');
    
    this.validatePackageJson();
    this.validateVercelJson();
    this.validateNextConfig();
    this.validatePrismaSchema();
    this.validateDeploymentScripts();
    this.validateDocumentation();
    this.validateEnvironmentTemplate();
    
    return this.generateReport();
  }
}

// Main execution
function main() {
  const validator = new DeploymentValidator();
  const isValid = validator.validate();
  
  process.exit(isValid ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { DeploymentValidator };