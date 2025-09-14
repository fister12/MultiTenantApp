# 🏠 Local Development Setup Guide

## Quick Start Commands

```bash
# 1. Navigate to project directory
cd multi-tenant-notes-app

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env

# 4. Set up database
npm run db:setup

# 5. Start development server
npm run dev
```

## Detailed Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the project root:
```bash
# Database Configuration (SQLite for local development)
DATABASE_URL="file:./dev.db"

# JWT Configuration
JWT_SECRET="your-local-jwt-secret-key-for-development"
JWT_EXPIRES_IN="24h"

# Application Configuration
NODE_ENV="development"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-local-nextauth-secret"
```

### 3. Database Setup

#### Option A: Automated Setup (Recommended)
```bash
# Run the complete database setup
npm run db:setup
```

#### Option B: Manual Setup
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed the database with test data
npm run db:seed
```

### 4. Start Development Server
```bash
# Start the Next.js development server
npm run dev
```

The application will be available at: **http://localhost:3000**

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run test` | Run test suite |
| `npm run test:run` | Run tests once (no watch mode) |
| `npm run lint` | Run ESLint |
| `npm run db:seed` | Seed database with test data |
| `npm run db:migrate` | Run database migrations |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:setup` | Complete database setup |

## Test Accounts

After seeding, these accounts will be available:

| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| admin@acme.test | password | ADMIN | Acme Corp |
| user@acme.test | password | MEMBER | Acme Corp |
| admin@globex.test | password | ADMIN | Globex Inc |
| user@globex.test | password | MEMBER | Globex Inc |

## Development Workflow

### 1. Login to the Application
- Go to http://localhost:3000
- Click "Login" or go to http://localhost:3000/login
- Use any of the test accounts above

### 2. Test Multi-Tenant Features
- Login as different users from different tenants
- Create notes and verify tenant isolation
- Test subscription limits (FREE plan = 3 notes max)
- Test admin upgrade functionality

### 3. API Testing
```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.test","password":"password"}'

# Create note (replace TOKEN with JWT from login)
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"title":"Test Note","content":"This is a test note"}'
```

## Database Management

### View Database
```bash
# Open Prisma Studio (database GUI)
npx prisma studio
```

### Reset Database
```bash
# Reset and reseed database
npx prisma migrate reset
npm run db:seed
```

### Database Schema Changes
```bash
# After modifying schema.prisma
npx prisma migrate dev --name your-migration-name
```

## Testing

### Run All Tests
```bash
npm run test
```

### Run Specific Tests
```bash
# Unit tests
npm run test -- src/lib/__tests__/

# API tests
npm run test -- src/app/api/

# Integration tests
npm run test -- src/lib/__tests__/integration
```

### Manual Testing Scripts
```bash
# Test authentication endpoints
npx tsx src/test/auth-endpoint-manual.ts

# Test notes CRUD operations
npx tsx src/test/notes-crud-manual.ts

# Test tenant upgrade functionality
npx tsx src/test/tenant-upgrade-manual.ts

# Test security features
npx tsx src/test/security-manual.ts
```

## Troubleshooting

### Common Issues

**Port 3000 already in use:**
```bash
# Kill process on port 3000
npx kill-port 3000
# Or use different port
npm run dev -- -p 3001
```

**Database connection issues:**
```bash
# Regenerate Prisma client
npx prisma generate

# Reset database
npx prisma migrate reset
```

**TypeScript errors:**
```bash
# Check types
npx tsc --noEmit

# Restart TypeScript server in VS Code
Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

**Missing dependencies:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

## Development Tips

### 1. Hot Reload
The development server supports hot reload for:
- React components
- API routes
- CSS/styling changes

### 2. Database Changes
After modifying `prisma/schema.prisma`:
1. Run `npx prisma migrate dev`
2. Restart the development server

### 3. Environment Variables
Changes to `.env` require server restart:
```bash
# Stop server (Ctrl+C) then restart
npm run dev
```

### 4. Debugging
- Use browser DevTools for frontend debugging
- Check terminal for server-side logs
- Use `console.log()` in API routes for debugging

## Production Build Testing

Test the production build locally:
```bash
# Build for production
npm run build

# Start production server
npm run start
```

## Next Steps

1. **Explore the codebase** - Check out the well-organized structure
2. **Test multi-tenancy** - Login as different users/tenants
3. **Try the API** - Use the test accounts to interact with endpoints
4. **Run tests** - Verify everything works with the test suite
5. **Make changes** - Start developing new features!

## Need Help?

- Check the `README.md` for additional information
- Review test files for usage examples
- Check API route files for endpoint documentation
- Look at component files for UI implementation examples