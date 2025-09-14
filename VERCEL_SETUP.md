# Vercel Deployment Setup

## Quick Setup Checklist

### 1. Vercel Project Setup
- [ ] Create Vercel account at [vercel.com](https://vercel.com)
- [ ] Import your GitHub/GitLab repository
- [ ] Configure project settings

### 2. Database Setup
- [ ] Create Vercel Postgres database OR set up external PostgreSQL
- [ ] Copy database connection strings

### 3. Environment Variables
Set these in Vercel Dashboard → Project → Settings → Environment Variables:

**Required:**
```
DATABASE_URL=postgresql://username:password@host:port/database_name
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
NODE_ENV=production
```

**Optional (for Vercel Postgres):**
```
POSTGRES_URL=postgresql://username:password@host:port/database_name
POSTGRES_PRISMA_URL=postgresql://username:password@host:port/database_name?pgbouncer=true&connect_timeout=15
POSTGRES_URL_NON_POOLING=postgresql://username:password@host:port/database_name
SEED_DATABASE=true
```

### 4. Deploy
- [ ] Push code to repository
- [ ] Vercel will automatically build and deploy
- [ ] Verify deployment at your Vercel URL

### 5. Verify Deployment
Test these endpoints after deployment:

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Login test
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.test","password":"password"}'
```

## Build Process

The deployment uses this build sequence:
1. `npm install` - Install dependencies
2. `prisma generate` - Generate Prisma client
3. `prisma migrate deploy` - Run database migrations
4. `npm run db:seed` - Seed database (if SEED_DATABASE=true)
5. `next build` - Build Next.js application

## Troubleshooting

**Build Fails:**
- Check environment variables are set correctly
- Verify DATABASE_URL is accessible from Vercel
- Check build logs in Vercel dashboard

**Database Connection Issues:**
- Ensure PostgreSQL database is accessible
- Verify connection string format
- Check database credentials

**API Errors:**
- Verify JWT_SECRET is set and secure (32+ characters)
- Check CORS configuration in vercel.json
- Review API logs in Vercel dashboard

## Security Notes

- Never commit actual environment variables to git
- Use strong JWT_SECRET (32+ characters)
- Database credentials should be secure
- Enable Vercel's security features

## Performance Optimization

- Vercel automatically handles CDN and caching
- Database connection pooling is configured via Prisma
- API routes are serverless functions (auto-scaling)

## Monitoring

- Use Vercel Analytics for performance monitoring
- Check Vercel Function logs for debugging
- Monitor database performance via your database provider