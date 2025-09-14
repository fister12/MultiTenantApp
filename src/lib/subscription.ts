import { Plan } from '../generated/prisma';
import { TenantContext } from './tenant-context';
import { createTenantAwareDb } from './db-helpers';

// Subscription plan limits
export const SUBSCRIPTION_LIMITS = {
  FREE: {
    maxNotes: 3,
    features: ['basic_notes'],
  },
  PRO: {
    maxNotes: null, // unlimited
    features: ['basic_notes', 'advanced_features'],
  },
} as const;

export interface SubscriptionStatus {
  plan: Plan;
  noteCount: number;
  noteLimit: number | null;
  canCreateNotes: boolean;
  canUpgrade: boolean;
}

export interface SubscriptionValidationResult {
  isValid: boolean;
  reason?: string;
  currentCount: number;
  limit: number | null;
}

/**
 * Subscription management utilities
 */
export class SubscriptionManager {
  private tenantContext: TenantContext;

  constructor(tenantContext: TenantContext) {
    this.tenantContext = tenantContext;
  }

  /**
   * Get current subscription status for the tenant
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const tenantDb = createTenantAwareDb(this.tenantContext);
    const tenant = await tenantDb.getCurrentTenant();
    
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const noteCount = await tenantDb.db.note.count();
    const limits = SUBSCRIPTION_LIMITS[tenant.plan];
    
    return {
      plan: tenant.plan,
      noteCount,
      noteLimit: limits.maxNotes,
      canCreateNotes: limits.maxNotes === null || noteCount < limits.maxNotes,
      canUpgrade: tenant.plan === 'FREE' && this.tenantContext.userRole === 'ADMIN',
    };
  }

  /**
   * Validate if a new note can be created based on subscription limits
   */
  async validateNoteCreation(): Promise<SubscriptionValidationResult> {
    const status = await this.getSubscriptionStatus();
    
    if (status.noteLimit === null) {
      // PRO plan - unlimited notes
      return {
        isValid: true,
        currentCount: status.noteCount,
        limit: null,
      };
    }

    // FREE plan - check limit
    if (status.noteCount >= status.noteLimit) {
      return {
        isValid: false,
        reason: `Free plan is limited to ${status.noteLimit} notes. Upgrade to Pro for unlimited notes.`,
        currentCount: status.noteCount,
        limit: status.noteLimit,
      };
    }

    return {
      isValid: true,
      currentCount: status.noteCount,
      limit: status.noteLimit,
    };
  }

  /**
   * Check if the current user can upgrade the tenant subscription
   */
  canUpgradeSubscription(): boolean {
    return this.tenantContext.userRole === 'ADMIN';
  }

  /**
   * Upgrade tenant subscription to PRO plan
   */
  async upgradeSubscription(): Promise<void> {
    if (!this.canUpgradeSubscription()) {
      throw new Error('Only administrators can upgrade tenant subscription');
    }

    const tenantDb = createTenantAwareDb(this.tenantContext);
    const tenant = await tenantDb.getCurrentTenant();
    
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    if (tenant.plan === 'PRO') {
      throw new Error('Tenant is already on PRO plan');
    }

    await tenantDb.db.tenant.update({
      data: { plan: 'PRO' },
    });
  }

  /**
   * Get subscription plan limits
   */
  static getPlanLimits(plan: Plan) {
    return SUBSCRIPTION_LIMITS[plan];
  }

  /**
   * Check if a plan has a specific feature
   */
  static planHasFeature(plan: Plan, feature: string): boolean {
    return SUBSCRIPTION_LIMITS[plan].features.includes(feature as any);
  }
}

/**
 * Helper function to create subscription manager instance
 */
export function createSubscriptionManager(tenantContext: TenantContext): SubscriptionManager {
  return new SubscriptionManager(tenantContext);
}

/**
 * Validate subscription limits for note creation
 */
export async function validateNoteCreationLimit(tenantContext: TenantContext): Promise<SubscriptionValidationResult> {
  const manager = createSubscriptionManager(tenantContext);
  return manager.validateNoteCreation();
}

/**
 * Check if tenant can be upgraded by current user
 */
export function canUpgradeTenant(tenantContext: TenantContext): boolean {
  const manager = createSubscriptionManager(tenantContext);
  return manager.canUpgradeSubscription();
}

/**
 * Upgrade tenant subscription (admin only)
 */
export async function upgradeTenantSubscription(tenantContext: TenantContext): Promise<void> {
  const manager = createSubscriptionManager(tenantContext);
  await manager.upgradeSubscription();
}