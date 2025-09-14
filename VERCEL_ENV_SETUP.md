# Vercel Environment Variables Setup

## ✅ Quick Checklist

### 1. Database Setup
- [x] ✅ Vercel Postgres database created

### 2. Environment Variables Setup
Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

Add these variables:

#### Required Variables:
- [ ] `DATABASE_URL` = `[Your Postgres connection string from Vercel]`
- [ ] `JWT_SECRET` = `vWC5WhqS+f3tTl1NBPf8C5pjhB6MTOOO63GJuQ2zTHg=`
- [ ] `NODE_ENV` = `production`

#### Optional but Recommended:
- [ ] `POSTGRES_URL` = `[Your Postgres URL]`
- [ ] `POSTGRES_PRISMA_URL` = `[Your Postgres Prisma URL]`
- [ ] `POSTGRES_URL_NON_POOLING` = `[Your non-pooling URL]`
- [ ] `SEED_DATABASE` = `true`
- [ ] `JWT_EXPIRES_IN` = `24h`

### 3. Deploy
- [ ] Push changes to repository (schema update)
- [ ] Vercel will automatically redeploy
- [ ] Check deployment logs for success

### 4. Verify Deployment
After deployment, test these endpoints:

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Should return: {"success":true,"data":{"status":"ok"}}
```

## 🔍 Where to Find Database Connection Strings

1. **Vercel Dashboard** → **Storage** → **Your Postgres Database**
2. **Settings** tab
3. Copy the connection strings:
   - `DATABASE_URL` (use this for the main DATABASE_URL)
   - `POSTGRES_URL` 
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`

## 🚨 Important Notes

- Set **Environment** to "Production" for each variable
- Never commit actual database URLs to git
- The JWT_SECRET provided is secure and ready to use
- SEED_DATABASE=true will create test accounts automatically

## 🧪 Test Accounts (Created Automatically)

When SEED_DATABASE=true, these accounts will be created:

| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| admin@acme.test | password | ADMIN | acme |
| user@acme.test | password | MEMBER | acme |
| admin@globex.test | password | ADMIN | globex |
| user@globex.test | password | MEMBER | globex |

## 🔧 Troubleshooting

**Build still fails?**
1. Check all environment variables are set correctly
2. Verify DATABASE_URL is accessible from Vercel
3. Check build logs in Vercel dashboard

**Database connection issues?**
1. Ensure Postgres database is running
2. Verify connection string format
3. Check database credentials in Vercel Storage settings