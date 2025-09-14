# Vercel Deployment Checklist

## Pre-Deployment Setup

### 1. Vercel Account & Project Setup
- [ ] Create Vercel account at [vercel.com](https://vercel.com)
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Login to Vercel CLI: `vercel login`
- [ ] Import project: `vercel --prod` or via Vercel dashboard

### 2. Database Setup
Choose one of the following options:

**Option A: Vercel Postgres (Recommended)**
- [ ] Go to Vercel Dashboard → Storage → Create Database → Postgres
- [ ] Copy the provided connection strings
- [ ] Note down: `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`

**Option B: External PostgreSQL**
- [ ] Set up PostgreSQL database with your preferred provider (Supabase, Railway, etc.)
- [ ] Ensure database is publicly accessible or configure Vercel IP allowlist
- [ ] Get connection string in format: `postgresql://username:password@host:port/database_name`

### 3. Environment Variables Configuration
Go to Vercel Dashboard → Your Project → Settings → Environment Variables

**Required Variables:**
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `JWT_SECRET` - Secure random string (32+ characters)
- [ ] `NODE_ENV` - Set to "production"

**Optional Variables:**
- [ ] `POSTGRES_URL` - (If using Vercel Postgres)
- [ ] `POSTGRES_PRISMA_URL` - (If using Vercel Postgres)
- [ ] `POSTGRES_URL_NON_POOLING` - (If using Vercel Postgres)
- [ ] `SEED_DATABASE` - Set to "true" to auto-seed test accounts
- [ ] `JWT_EXPIRES_IN` - Token expiration (default: "24h")

**Generate JWT Secret:**
```bash
# Generate a secure JWT secret
openssl rand -base64 32
```

### 4. Build Configuration Verification
- [ ] Verify `vercel.json` exists and is properly configured
- [ ] Check `package.json` has required scripts:
  - [ ] `vercel-build`
  - [ ] `build`
  - [ ] `start`
  - [ ] `db:generate`
  - [ ] `db:migrate`

### 5. Deploy
**Method 1: Git Integration (Recommended)**
- [ ] Push code to GitHub/GitLab/Bitbucket
- [ ] Vercel will automatically deploy on push to main branch

**Method 2: Vercel CLI**
```bash
# Deploy to production
vercel --prod
```

## Post-Deployment Verification

### 1. Health Check
```bash
curl https://your-app.vercel.app/api/health
# Expected: {"status":"ok"}
```

### 2. Test Authentication
```bash
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.test","password":"password"}'
# Expected: JWT token response
```

### 3. Test API Endpoints
```bash
# Get JWT token from login response above
export JWT_TOKEN="your-jwt-token-here"

# Test notes endpoint
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://your-app.vercel.app/api/notes
# Expected: Empty array or notes list
```

### 4. Test Frontend
- [ ] Visit your Vercel app URL
- [ ] Test login with test accounts:
  - `admin@acme.test` / `password`
  - `user@acme.test` / `password`
  - `admin@globex.test` / `password`
  - `user@globex.test` / `password`
- [ ] Test creating, editing, and deleting notes
- [ ] Test subscription upgrade (Admin users only)

## Troubleshooting

### Common Issues

**Build Failures:**
- [ ] Check Vercel build logs in dashboard
- [ ] Verify all environment variables are set
- [ ] Ensure DATABASE_URL is accessible from Vercel
- [ ] Check for TypeScript errors

**Database Connection Issues:**
- [ ] Verify DATABASE_URL format is correct
- [ ] Test database connection from local environment
- [ ] Check database server allows connections from Vercel IPs
- [ ] Verify database credentials are correct

**Authentication Issues:**
- [ ] Ensure JWT_SECRET is set and at least 32 characters
- [ ] Check JWT_SECRET matches between build and runtime
- [ ] Verify password hashing is working correctly

**API CORS Issues:**
- [ ] Check vercel.json CORS configuration
- [ ] Verify API routes are accessible
- [ ] Test with different origins if needed

### Monitoring & Maintenance

**Performance Monitoring:**
- [ ] Enable Vercel Analytics
- [ ] Monitor function execution times
- [ ] Check database query performance

**Security Monitoring:**
- [ ] Review Vercel security headers
- [ ] Monitor for unusual API access patterns
- [ ] Keep dependencies updated

**Backup & Recovery:**
- [ ] Set up database backups
- [ ] Document recovery procedures
- [ ] Test backup restoration process

## Production Optimization

### Performance
- [ ] Enable Vercel Edge Functions if needed
- [ ] Configure appropriate function regions
- [ ] Optimize database queries and indexes
- [ ] Enable compression and caching

### Security
- [ ] Review and update security headers
- [ ] Implement rate limiting if needed
- [ ] Monitor for security vulnerabilities
- [ ] Keep JWT secrets secure and rotate regularly

### Scaling
- [ ] Monitor function execution limits
- [ ] Plan for database scaling
- [ ] Consider CDN for static assets
- [ ] Monitor and optimize cold start times

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)