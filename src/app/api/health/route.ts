import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db-helpers';
import { withAPISecurity, RATE_LIMIT_CONFIGS } from '@/lib/security';
import { ApiResponse } from '@/types';

interface HealthResponse {
  status: string;
  timestamp: string;
  database: string;
}

async function healthHandler(req: NextRequest): Promise<NextResponse<ApiResponse<HealthResponse>>> {
  try {
    // Basic system health validation - check database connectivity
    const prisma = getPrismaClient();
    
    // Simple database connectivity check
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json(
      {
        success: true,
        data: {
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: 'connected',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'System health check failed',
        },
      },
      { status: 503 }
    );
  }
}

// Export with basic security (CORS, security headers, rate limiting)
export const GET = withAPISecurity(RATE_LIMIT_CONFIGS.default)(healthHandler);