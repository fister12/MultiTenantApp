import { NextRequest, NextResponse } from 'next/server';
import { withUpgradeRateLimit, AuthenticatedRequest } from '@/lib/middleware';
import { upgradeTenantSubscription } from '@/lib/subscription';
import { ApiResponse } from '@/types';

interface UpgradeResponse {
  message: string;
  tenant: {
    slug: string;
    plan: 'PRO';
  };
}

async function upgradeHandler(request: AuthenticatedRequest): Promise<NextResponse<ApiResponse<UpgradeResponse>>> {
  try {
    const { user, tenantContext } = request;
    
    if (!user || !tenantContext) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Extract tenant slug from URL
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const slugIndex = pathSegments.indexOf('tenants') + 1;
    const requestedSlug = pathSegments[slugIndex];

    if (!requestedSlug) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Tenant slug is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate that the requested tenant matches the user's tenant
    if (requestedSlug !== tenantContext.tenantSlug) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied: tenant isolation violation',
          },
        },
        { status: 403 }
      );
    }

    // Perform the upgrade
    await upgradeTenantSubscription(tenantContext);

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'Tenant subscription upgraded successfully',
          tenant: {
            slug: tenantContext.tenantSlug,
            plan: 'PRO',
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Tenant upgrade error:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('already on PRO plan')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Tenant is already on PRO plan',
            },
          },
          { status: 400 }
        );
      }
      
      if (error.message.includes('Only administrators')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Admin role required for subscription upgrade',
            },
          },
          { status: 403 }
        );
      }
      
      if (error.message.includes('Tenant not found')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'RESOURCE_NOT_FOUND',
              message: 'Tenant not found',
            },
          },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred during upgrade',
        },
      },
      { status: 500 }
    );
  }
}

// Export the POST handler with secure admin role middleware and rate limiting
export const POST = withUpgradeRateLimit(upgradeHandler);