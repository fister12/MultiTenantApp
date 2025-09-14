import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db-helpers';
import { createUserSession } from '@/lib/auth-helpers';
import { withAuthRateLimit } from '@/lib/middleware';
import { ApiResponse } from '@/types';
import { 
  withErrorHandling, 
  createSuccessResponse, 
  createError,
  validateRequired,
  validateEmail,
  sanitizeString 
} from '@/lib/error-handler';
import { loginSchema, validateRequestBody } from '@/lib/validation';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: 'ADMIN' | 'MEMBER';
    tenantId: string;
    tenantSlug: string;
  };
}

async function loginHandler(request: NextRequest): Promise<NextResponse<ApiResponse<LoginResponse>>> {
  // Parse and validate request body
  const body = await request.json();
  const validatedData = validateRequestBody(loginSchema, body);

  // Additional sanitization
  const email = validateEmail(sanitizeString(validatedData.email));
  const password = sanitizeString(validatedData.password, 100);

  const prisma = getPrismaClient();

  // Find user with tenant information
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      tenant: true,
    },
  });

  if (!user) {
    throw createError.unauthorized('Invalid email or password');
  }

  // Create user session (validates password and generates token)
  const session = await createUserSession(
    {
      id: user.id,
      email: user.email,
      password: user.password,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
    },
    password
  );

  if (!session) {
    throw createError.unauthorized('Invalid email or password');
  }

  // Return successful login response
  return createSuccessResponse({
    token: session.token,
    user: {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      tenantId: session.user.tenantId,
      tenantSlug: session.user.tenantSlug,
    },
  });
}

// Apply security middleware and error handling to the POST handler
export const POST = withAuthRateLimit(withErrorHandling(loginHandler));