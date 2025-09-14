import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createSubscriptionManager } from '@/lib/subscription';
import { ApiResponse } from '@/types';

interface SubscriptionStatusResponse {
  plan: 'FREE' | 'PRO';
  noteCount: number;
  noteLimit: number | null;
  canCreateNotes: boolean;
  canUpgrade: boolean;
}

async function getSubscriptionStatusHandler(request: AuthenticatedRequest): Promise<NextResponse<ApiResponse<SubscriptionStatusResponse>>> {
  try {
    const { tenantContext } = request;
    
    if (!tenantContext) {
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

    const subscriptionManager = createSubscriptionManager(tenantContext);
    const status = await subscriptionManager.getSubscriptionStatus();

    return NextResponse.json(
      {
        success: true,
        data: {
          plan: status.plan,
          noteCount: status.noteCount,
          noteLimit: status.noteLimit,
          canCreateNotes: status.canCreateNotes,
          canUpgrade: status.canUpgrade,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Subscription status error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve subscription status',
        },
      },
      { status: 500 }
    );
  }
}

// Export the GET handler with authentication middleware
export const GET = withAuth(getSubscriptionStatusHandler);