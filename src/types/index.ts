// Core types for the multi-tenant notes application
export type { Tenant, User, Note, $Enums } from '../generated/prisma';
export { Role, Plan } from '../generated/prisma';

// Re-export enums for convenience
export type { Role as RoleType, Plan as PlanType } from '../generated/prisma';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  tenantId: string;
  tenantSlug: string;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}