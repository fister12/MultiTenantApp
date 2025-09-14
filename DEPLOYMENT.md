# Complete Vercel Deployment Guide

## Overview

This multi-tenant SaaS Notes Application is fully configured for dellowing setup:

### Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Database**: Set up a PostgreSQL database (Vercel Postgres recommended)
3. **Environment Variables**: Configure production environment variables

### Deployment Steps

#### 1. Database Setup

**Option A: Vercel Postgres (Recommended)**
1. Go to your Vercel dashboard
2. Create a new Postgres database
3. Copy the connection strings provided

**Option B: External PostgreSQL**
1. Set up a PostgreSQL database with your preferred provider
2. Ensure the database is accessible from Vercel's servers

#### 2. Environment Variables Configuration

In your Vercel project settings, add the following environment variables:

**Required Variables:**
```
DATABASE_URL=postgresql://username:password@host:port/database_name
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
NODE_ENV=production
```

**Optional Variables (if using Vercel Postgres):**
```
POSTGRES_URL=postgresql://username:password@host:port/database_name
POSTGRES_PRISMA_URL=postgresql://username:password@host:port/database_name?pgbouncer=true&connect_timeout=15
POSTGRES_URL_NON_POOLING=postgresql://username:password@host:port/database_name
```

#### 3. Deploy to Vercel

**Method 1: Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Method 2: Git Integration**
1. Push your code to GitHub/GitLab/Bitbucket
2. Import the repository in Vercel dashboard
3. Configure environment variables
4. Deploy

#### 4. Database Migration

After deployment, the database will be automatically migrated during the build process via the `vercel-build` script.

If you need to run migrations manually:
```bash
# Using Vercel CLI
vercel env pull .env.local
npx prisma migrate deploy
```

#### 5. Seed Database (Optional)

To populate the database with test accounts:
```bash
# Using Vercel CLI with environment
vercel env pull .env.local
npm run db:seed
```

### Build Configuration

The application uses the following build configuration:

- **Build Command**: `prisma generate && prisma migrate deploy && next build`
- **Output Directory**: `.next`
- **Node.js Version**: 18.x (default)
- **Framework**: Next.js

### API Configuration

The application includes CORS configuration for external API access:
- All API routes support CORS
- Methods: GET, POST, PUT, DELETE, OPTIONS
- Headers: Content-Type, Authorization

### Security Headers

The following security headers are automatically applied:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()

### Health Check

After deployment, verify the application is working:
```bash
curl https://your-app.vercel.app/api/health
# Should return: {"status":"ok"}
```

### Test Accounts

The application includes the following test accounts (password: "password"):
- admin@acme.test (Admin, Acme tenant)
- user@acme.test (Member, Acme tenant)
- admin@globex.test (Admin, Globex tenant)
- user@globex.test (Member, Globex tenant)

### Troubleshooting

**Common Issues:**

1. **Database Connection Errors**
   - Verify DATABASE_URL is correct
   - Ensure database is accessible from Vercel
   - Check if migrations have been applied

2. **Build Failures**
   - Ensure all environment variables are set
   - Check that Prisma schema is valid
   - Verify all dependencies are in package.json

3. **JWT Errors**
   - Ensure JWT_SECRET is at least 32 characters
   - Verify JWT_SECRET is set in production environment

4. **CORS Issues**
   - Check vercel.json CORS configuration
   - Verify API routes are accessible

### Monitoring

Monitor your application using:
- Vercel Analytics (built-in)
- Vercel Logs for debugging
- Database monitoring tools

### Scaling Considerations

- Vercel automatically scales serverless functions
- Database connection pooling is configured via Prisma
- Consider upgrading database plan for high traffic