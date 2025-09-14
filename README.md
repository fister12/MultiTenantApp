# Multi-Tenant SaaS Notes Application

A secure, multi-tenant SaaS notes application built with Next.js, featuring JWT authentication, role-based access control, and subscription-based feature gating. This application demonstrates enterprise-grade multi-tenancy patterns with strict data isolation and comprehensive security measures.

## Features

- **Multi-Tenancy**: Secure data isolation between tenants using shared schema with tenant ID approach
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Authorization**: Role-based access control (Admin/Member roles)
- **Subscription Management**: Free and Pro plans with feature gating
- **CRUD Operations**: Full notes management with tenant isolation
- **Security**: Comprehensive security headers, input validation, and rate limiting
- **Testing**: Complete test suite with unit and integration tests
- **API-First**: RESTful API with comprehensive error handling and validation

## Multi-Tenancy Architecture

### Chosen Approach: Shared Schema with Tenant ID Column

This application implements a **shared schema with tenant ID column** approach for multi-tenancy, which provides the optimal balance between simplicity, cost-effectiveness, and security for this use case.

#### Rationale for This Approach

**Advantages:**
- **Simplicity**: Single database schema, easier to maintain and backup
- **Cost-Effective**: Optimal resource utilization, no database proliferation
- **Performance**: Efficient queries with proper indexing on tenant_id
- **Scalability**: Handles multiple tenants without infrastructure complexity
- **Development Velocity**: Simpler migrations and schema changes

**Implementation Details:**
- All database tables include a `tenantId` column as a foreign key
- Middleware automatically extracts tenant context from JWT tokens
- All database queries are automatically filtered by tenant ID
- Database indexes on `tenantId` ensure efficient query performance
- Prisma ORM provides type-safe tenant-aware database operations

**Security Measures:**
- Tenant context validation on every API request
- Automatic tenant filtering prevents cross-tenant data access
- JWT tokens include tenant information for stateless validation
- Database foreign key constraints ensure data integrity

## Data Models

### Database Schema

The application uses PostgreSQL with Prisma ORM. Here are the core data models:

#### Tenant Model
```typescript
{
  id: string;          // Unique identifier (CUID)
  slug: string;        // URL-friendly identifier (e.g., "acme", "globex")
  name: string;        // Display name (e.g., "Acme Corp")
  plan: "FREE" | "PRO"; // Subscription plan
  createdAt: Date;
  updatedAt: Date;
}
```

#### User Model
```typescript
{
  id: string;              // Unique identifier (CUID)
  email: string;           // Login email (unique across all tenants)
  password: string;        // Bcrypt hashed password
  role: "ADMIN" | "MEMBER"; // User role within tenant
  tenantId: string;        // Foreign key to tenant
  createdAt: Date;
  updatedAt: Date;
}
```

#### Note Model
```typescript
{
  id: string;        // Unique identifier (CUID)
  title: string;     // Note title (max 200 characters)
  content: string;   // Note content (max 10,000 characters)
  userId: string;    // Foreign key to user (note owner)
  tenantId: string;  // Foreign key to tenant (for direct filtering)
  createdAt: Date;
  updatedAt: Date;
}
```

### Relationships

- **Tenant** → **Users** (One-to-Many): A tenant can have multiple users
- **Tenant** → **Notes** (One-to-Many): A tenant can have multiple notes
- **User** → **Notes** (One-to-Many): A user can create multiple notes
- **User** → **Tenant** (Many-to-One): A user belongs to exactly one tenant

### Database Indexes

For optimal performance, the following indexes are configured:

- `users.tenantId` - Fast user lookups by tenant
- `notes.tenantId` - Fast note filtering by tenant
- `notes.tenantId, createdAt` - Efficient pagination and sorting

## Getting Started

### Prerequisites

- **Node.js 18+** - JavaScript runtime
- **PostgreSQL** - Database (for production) or SQLite (for development)
- **npm or yarn** - Package manager
- **Git** - Version control

### Local Development Setup

1. **Clone the repository:**
```bash
git clone <repository-url>
cd multi-tenant-notes-app
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/notes_app"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters"

# Environment
NODE_ENV="development"
```

4. **Set up the database:**
```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npx prisma migrate dev --name init

# Seed with test data
npm run db:seed
```

5. **Start the development server:**
```bash
npm run dev
```

6. **Access the application:**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - API Health Check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

### Test Accounts

The application includes pre-configured test accounts for development and testing:

| Email | Password | Role | Tenant | Plan |
|-------|----------|------|--------|------|
| admin@acme.test | password | Admin | Acme Corp | Free |
| user@acme.test | password | Member | Acme Corp | Free |
| admin@globex.test | password | Admin | Globex Inc | Free |
| user@globex.test | password | Member | Globex Inc | Free |

### Development Workflow

1. **Make changes** to the codebase
2. **Run tests** to ensure functionality:
   ```bash
   npm test
   ```
3. **Test API endpoints** using the provided test accounts
4. **Check database changes** using Prisma Studio:
   ```bash
   npx prisma studio
   ```

## API Documentation

### Base URL
- **Development**: `http://localhost:3000`
- **Production**: `https://your-app.vercel.app`

### Authentication

All API endpoints (except `/api/health` and `/api/auth/login`) require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

#### POST /api/auth/login

Authenticate a user and receive a JWT token.

**Request:**
```json
{
  "email": "admin@acme.test",
  "password": "password"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clx1234567890",
      "email": "admin@acme.test",
      "role": "ADMIN",
      "tenantId": "clx0987654321",
      "tenantSlug": "acme"
    }
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password"
  }
}
```

### Health Check

#### GET /api/health

Check system health and database connectivity.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "database": "connected"
  }
}
```

### Notes Management

#### GET /api/notes

List all notes for the authenticated user's tenant with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `sortBy` (optional): Sort field - `createdAt`, `updatedAt`, `title` (default: `createdAt`)
- `sortOrder` (optional): Sort order - `asc`, `desc` (default: `desc`)

**Example Request:**
```bash
GET /api/notes?page=1&limit=10&sortBy=createdAt&sortOrder=desc
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "notes": [
      {
        "id": "clx1234567890",
        "title": "Meeting Notes",
        "content": "Discussed project timeline...",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "userId": "clx0987654321",
        "user": {
          "email": "admin@acme.test"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalCount": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "sorting": {
      "sortBy": "createdAt",
      "sortOrder": "desc"
    }
  }
}
```

#### POST /api/notes

Create a new note (subject to subscription limits for Free plan tenants).

**Request:**
```json
{
  "title": "New Meeting Notes",
  "content": "Today we discussed the new feature requirements..."
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "clx1234567890",
    "title": "New Meeting Notes",
    "content": "Today we discussed the new feature requirements...",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "userId": "clx0987654321"
  }
}
```

**Error Response (403) - Subscription Limit:**
```json
{
  "success": false,
  "error": {
    "code": "SUBSCRIPTION_LIMIT_EXCEEDED",
    "message": "Free plan allows maximum 3 notes. Upgrade to Pro for unlimited notes.",
    "details": {
      "currentCount": 3,
      "limit": 3
    }
  }
}
```

#### GET /api/notes/[id]

Retrieve a specific note by ID (must belong to user's tenant).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx1234567890",
    "title": "Meeting Notes",
    "content": "Discussed project timeline...",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "userId": "clx0987654321",
    "user": {
      "email": "admin@acme.test"
    }
  }
}
```

#### PUT /api/notes/[id]

Update a specific note (must belong to user's tenant).

**Request:**
```json
{
  "title": "Updated Meeting Notes",
  "content": "Updated content with new information..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx1234567890",
    "title": "Updated Meeting Notes",
    "content": "Updated content with new information...",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:45:00.000Z",
    "userId": "clx0987654321"
  }
}
```

#### DELETE /api/notes/[id]

Delete a specific note (must belong to user's tenant).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Note deleted successfully"
  }
}
```

### Subscription Management

#### POST /api/tenants/[slug]/upgrade

Upgrade tenant subscription from Free to Pro plan (Admin role required).

**Example Request:**
```bash
POST /api/tenants/acme/upgrade
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "clx0987654321",
      "slug": "acme",
      "name": "Acme Corp",
      "plan": "PRO",
      "updatedAt": "2024-01-15T11:45:00.000Z"
    },
    "message": "Tenant successfully upgraded to Pro plan"
  }
}
```

#### GET /api/subscription/status

Get current subscription status and usage information.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "slug": "acme",
      "name": "Acme Corp",
      "plan": "FREE"
    },
    "usage": {
      "noteCount": 2,
      "noteLimit": 3,
      "canCreateNotes": true
    },
    "features": {
      "unlimitedNotes": false,
      "canUpgrade": true
    }
  }
}
```

### Error Responses

All API endpoints return consistent error responses:

**Validation Error (400):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "message": "Invalid email format"
    }
  }
}
```

**Unauthorized (401):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing authentication token"
  }
}
```

**Forbidden (403):**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this operation"
  }
}
```

**Not Found (404):**
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found"
  }
}
```

**Rate Limited (429):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  }
}
```

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test

# Run tests once
npm run test:run
```

## Deployment

This application is optimized for deployment on Vercel with automatic database migrations and comprehensive production configuration.

### Quick Deploy to Vercel

1. **Prepare your repository:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Create Vercel project:**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "New Project" and import your repository
   - Choose "Next.js" as the framework preset

3. **Configure environment variables:**
   
   In Vercel Dashboard → Project → Settings → Environment Variables, add:

   **Required Variables:**
   ```
   DATABASE_URL=postgresql://username:password@host:port/database_name
   JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
   NODE_ENV=production
   ```

   **Optional Variables (for Vercel Postgres):**
   ```
   POSTGRES_URL=postgresql://username:password@host:port/database_name
   POSTGRES_PRISMA_URL=postgresql://username:password@host:port/database_name?pgbouncer=true&connect_timeout=15
   POSTGRES_URL_NON_POOLING=postgresql://username:password@host:port/database_name
   SEED_DATABASE=true
   ```

4. **Deploy:**
   - Click "Deploy" in Vercel dashboard
   - Vercel will automatically build and deploy your application

### Database Setup Options

#### Option A: Vercel Postgres (Recommended)
1. In Vercel Dashboard → Storage → Create Database → Postgres
2. Copy the provided connection strings to your environment variables
3. Database will be automatically configured and accessible

#### Option B: External PostgreSQL
1. Set up PostgreSQL with any provider (AWS RDS, Google Cloud SQL, etc.)
2. Ensure the database is accessible from Vercel's servers
3. Add the connection string to `DATABASE_URL` environment variable

### Automatic Build Process

The deployment uses this optimized build sequence:

1. **Install Dependencies:** `npm install`
2. **Generate Prisma Client:** `prisma generate`
3. **Setup Production Database:** Custom script handles migrations and seeding
4. **Build Application:** `next build`
5. **Deploy:** Vercel handles the deployment and CDN distribution

### Post-Deployment Verification

After deployment, verify your application:

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Test authentication
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.test","password":"password"}'

# Test CORS (from external domain)
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     https://your-app.vercel.app/api/notes
```

### Production Configuration

The application includes production-ready configurations:

- **Security Headers:** XSS protection, content type validation, frame options
- **CORS:** Configured for external API access
- **Rate Limiting:** Prevents abuse and ensures fair usage
- **Error Handling:** Comprehensive error responses with proper HTTP status codes
- **Database Connection Pooling:** Optimized for serverless environments
- **Logging:** Structured logging for monitoring and debugging

### Environment-Specific Settings

| Setting | Development | Production |
|---------|-------------|------------|
| Database | SQLite/PostgreSQL | PostgreSQL |
| JWT Expiration | 24 hours | 24 hours |
| Rate Limiting | Disabled | Enabled |
| CORS | Permissive | Configured |
| Logging | Console | Structured |
| Error Details | Full stack traces | Sanitized messages |

### Scaling Considerations

- **Serverless Functions:** Automatic scaling via Vercel
- **Database Connections:** Connection pooling configured via Prisma
- **CDN:** Static assets served via Vercel's global CDN
- **Monitoring:** Built-in Vercel Analytics and logging

For detailed deployment instructions and troubleshooting, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Security Features

- JWT token authentication with secure headers
- Password hashing with bcrypt
- Tenant isolation enforcement
- Role-based access control
- Input validation and sanitization
- CORS configuration for API access
- Security headers (XSS, CSRF, etc.)

## Available Scripts

The following npm scripts are available for development and deployment:

### Development
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production application
- `npm start` - Start production server locally
- `npm run lint` - Run ESLint code analysis

### Testing
- `npm test` - Run tests in watch mode
- `npm run test:run` - Run tests once and exit

### Database Management
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Deploy database migrations
- `npm run db:seed` - Seed database with test data
- `npm run db:setup-prod` - Setup production database

### Deployment
- `npm run verify-deployment` - Verify deployment configuration
- `npm run test-deployment` - Test deployed application
- `npm run configure-deployment` - Configure Vercel deployment
- `npm run validate-deployment` - Validate Vercel configuration

## Architecture Overview

### Application Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── notes/         # Notes CRUD endpoints
│   │   ├── tenants/       # Tenant management
│   │   └── health/        # Health check
│   ├── dashboard/         # Dashboard pages
│   ├── login/            # Authentication pages
│   └── notes/            # Notes management pages
├── components/            # React components
├── contexts/             # React contexts (Auth)
├── hooks/                # Custom React hooks
├── lib/                  # Core utilities
│   ├── auth.ts           # Authentication utilities
│   ├── middleware.ts     # API middleware
│   ├── db-helpers.ts     # Database utilities
│   └── security.ts       # Security configurations
├── types/                # TypeScript type definitions
└── generated/            # Generated Prisma client
```

### Security Architecture

1. **Authentication Layer:**
   - JWT tokens with secure payload
   - Bcrypt password hashing (12 rounds)
   - Token expiration and validation

2. **Authorization Layer:**
   - Role-based access control (RBAC)
   - Tenant context validation
   - Resource ownership verification

3. **Data Isolation Layer:**
   - Automatic tenant filtering on all queries
   - Middleware-enforced tenant context
   - Database foreign key constraints

4. **API Security Layer:**
   - Rate limiting per endpoint
   - Input validation and sanitization
   - CORS configuration
   - Security headers

### Performance Optimizations

- **Database Indexing:** Strategic indexes on tenant_id and frequently queried fields
- **Connection Pooling:** Prisma connection pooling for serverless environments
- **Caching:** Static asset caching via Vercel CDN
- **Pagination:** Efficient pagination with limit/offset and total count
- **Query Optimization:** Selective field queries to minimize data transfer

## Technology Stack

### Core Technologies
- **Frontend Framework:** Next.js 15 with App Router
- **React Version:** React 19 with latest features
- **Styling:** Tailwind CSS 4 for utility-first styling
- **Backend:** Next.js API Routes (serverless functions)
- **Database:** PostgreSQL (production), SQLite (development)
- **ORM:** Prisma with type-safe database operations

### Authentication & Security
- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** bcrypt with salt rounds
- **Input Validation:** Zod schema validation
- **Security Headers:** Comprehensive security header configuration
- **Rate Limiting:** Built-in rate limiting for API protection

### Development & Testing
- **Language:** TypeScript for type safety
- **Testing Framework:** Vitest with Testing Library
- **Code Quality:** ESLint with Next.js configuration
- **Development Server:** Turbopack for fast development builds

### Deployment & Infrastructure
- **Hosting:** Vercel (serverless deployment)
- **Database Hosting:** Vercel Postgres or external PostgreSQL
- **CDN:** Vercel's global CDN for static assets
- **Monitoring:** Vercel Analytics and logging

### Dependencies Overview

**Production Dependencies:**
- `@prisma/client` - Database ORM client
- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT token handling
- `cors` - Cross-origin resource sharing
- `zod` - Runtime type validation
- `next`, `react`, `react-dom` - Core framework

**Development Dependencies:**
- `@testing-library/react` - Component testing utilities
- `@vitest/ui` - Testing framework with UI
- `typescript` - Type checking and compilation
- `eslint` - Code linting and quality
- `tailwindcss` - CSS framework

## Contributing

### Development Guidelines

1. **Code Style:** Follow the established ESLint configuration
2. **Testing:** Write tests for new features and bug fixes
3. **Security:** Always validate input and maintain tenant isolation
4. **Documentation:** Update README and API documentation for changes
5. **Database Changes:** Use Prisma migrations for schema changes

### Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes with appropriate tests
3. Ensure all tests pass: `npm run test:run`
4. Update documentation if needed
5. Submit a pull request with a clear description

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For questions, issues, or contributions:

1. **Issues:** Use GitHub Issues for bug reports and feature requests
2. **Documentation:** Check this README and [DEPLOYMENT.md](./DEPLOYMENT.md)
3. **API Testing:** Use the provided test accounts and API examples
4. **Security:** Report security issues privately via email

---

**Built with ❤️ using Next.js, Prisma, and modern web technologies.**
