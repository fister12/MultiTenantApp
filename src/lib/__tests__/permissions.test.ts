import { describe, it, expect } from 'vitest';
import {
  isAdmin,
  isMember,
  hasRole,
  canManageTenant,
  canUpgradeSubscription,
  canInviteUsers,
  canAccessNotes,
  canCreateNotes,
  canEditNote,
  canDeleteNote,
  canViewNote,
  getUserPermissions,
  validatePermission,
  getPermissionError,
  PERMISSION_ERRORS,
  type PermissionContext,
} from '../permissions';
import { JWTPayload } from '../auth';
import { Role } from '@/types';

describe('Permission Utilities', () => {
  const adminUser: JWTPayload = {
    userId: 'admin123',
    email: 'admin@acme.test',
    role: 'ADMIN',
    tenantId: 'tenant123',
    tenantSlug: 'acme',
  };

  const memberUser: JWTPayload = {
    userId: 'member456',
    email: 'member@acme.test',
    role: 'MEMBER',
    tenantId: 'tenant123',
    tenantSlug: 'acme',
  };

  const otherTenantUser: JWTPayload = {
    userId: 'user789',
    email: 'user@globex.test',
    role: 'MEMBER',
    tenantId: 'tenant456',
    tenantSlug: 'globex',
  };

  describe('Role checking functions', () => {
    describe('isAdmin', () => {
      it('should return true for admin users', () => {
        expect(isAdmin(adminUser)).toBe(true);
      });

      it('should return false for member users', () => {
        expect(isAdmin(memberUser)).toBe(false);
      });
    });

    describe('isMember', () => {
      it('should return true for member users', () => {
        expect(isMember(memberUser)).toBe(true);
      });

      it('should return false for admin users', () => {
        expect(isMember(adminUser)).toBe(false);
      });
    });

    describe('hasRole', () => {
      it('should return true when user has one of the specified roles', () => {
        expect(hasRole(adminUser, [Role.ADMIN])).toBe(true);
        expect(hasRole(memberUser, [Role.MEMBER])).toBe(true);
        expect(hasRole(adminUser, [Role.ADMIN, Role.MEMBER])).toBe(true);
        expect(hasRole(memberUser, [Role.ADMIN, Role.MEMBER])).toBe(true);
      });

      it('should return false when user does not have any of the specified roles', () => {
        expect(hasRole(adminUser, [Role.MEMBER])).toBe(false);
        expect(hasRole(memberUser, [Role.ADMIN])).toBe(false);
      });
    });
  });

  describe('Permission checking functions', () => {
    describe('canManageTenant', () => {
      it('should allow admin users to manage tenants', () => {
        expect(canManageTenant(adminUser)).toBe(true);
      });

      it('should not allow member users to manage tenants', () => {
        expect(canManageTenant(memberUser)).toBe(false);
      });
    });

    describe('canUpgradeSubscription', () => {
      it('should allow admin users to upgrade subscriptions', () => {
        expect(canUpgradeSubscription(adminUser)).toBe(true);
      });

      it('should not allow member users to upgrade subscriptions', () => {
        expect(canUpgradeSubscription(memberUser)).toBe(false);
      });
    });

    describe('canInviteUsers', () => {
      it('should allow admin users to invite users', () => {
        expect(canInviteUsers(adminUser)).toBe(true);
      });

      it('should not allow member users to invite users', () => {
        expect(canInviteUsers(memberUser)).toBe(false);
      });
    });

    describe('canAccessNotes', () => {
      it('should allow both admin and member users to access notes', () => {
        expect(canAccessNotes(adminUser)).toBe(true);
        expect(canAccessNotes(memberUser)).toBe(true);
      });
    });

    describe('canCreateNotes', () => {
      it('should allow both admin and member users to create notes', () => {
        expect(canCreateNotes(adminUser)).toBe(true);
        expect(canCreateNotes(memberUser)).toBe(true);
      });
    });
  });

  describe('Resource-specific permissions', () => {
    describe('canEditNote', () => {
      it('should allow admin users to edit any note in their tenant', () => {
        const context: PermissionContext = {
          user: adminUser,
          resourceTenantId: 'tenant123',
          resourceUserId: 'other-user',
        };
        expect(canEditNote(context)).toBe(true);
      });

      it('should allow member users to edit their own notes', () => {
        const context: PermissionContext = {
          user: memberUser,
          resourceTenantId: 'tenant123',
          resourceUserId: 'member456',
        };
        expect(canEditNote(context)).toBe(true);
      });

      it('should not allow member users to edit other users notes', () => {
        const context: PermissionContext = {
          user: memberUser,
          resourceTenantId: 'tenant123',
          resourceUserId: 'other-user',
        };
        expect(canEditNote(context)).toBe(false);
      });

      it('should not allow users to edit notes from other tenants', () => {
        const context: PermissionContext = {
          user: adminUser,
          resourceTenantId: 'tenant456', // Different tenant
          resourceUserId: 'any-user',
        };
        expect(canEditNote(context)).toBe(false);
      });

      it('should handle missing resource information', () => {
        const context: PermissionContext = {
          user: memberUser,
        };
        expect(canEditNote(context)).toBe(false);
      });
    });

    describe('canDeleteNote', () => {
      it('should have same rules as canEditNote', () => {
        const adminContext: PermissionContext = {
          user: adminUser,
          resourceTenantId: 'tenant123',
          resourceUserId: 'other-user',
        };
        expect(canDeleteNote(adminContext)).toBe(true);

        const memberOwnContext: PermissionContext = {
          user: memberUser,
          resourceTenantId: 'tenant123',
          resourceUserId: 'member456',
        };
        expect(canDeleteNote(memberOwnContext)).toBe(true);

        const memberOtherContext: PermissionContext = {
          user: memberUser,
          resourceTenantId: 'tenant123',
          resourceUserId: 'other-user',
        };
        expect(canDeleteNote(memberOtherContext)).toBe(false);
      });
    });

    describe('canViewNote', () => {
      it('should have same rules as canEditNote', () => {
        const adminContext: PermissionContext = {
          user: adminUser,
          resourceTenantId: 'tenant123',
          resourceUserId: 'other-user',
        };
        expect(canViewNote(adminContext)).toBe(true);

        const memberOwnContext: PermissionContext = {
          user: memberUser,
          resourceTenantId: 'tenant123',
          resourceUserId: 'member456',
        };
        expect(canViewNote(memberOwnContext)).toBe(true);

        const memberOtherContext: PermissionContext = {
          user: memberUser,
          resourceTenantId: 'tenant123',
          resourceUserId: 'other-user',
        };
        expect(canViewNote(memberOtherContext)).toBe(false);
      });
    });
  });

  describe('getUserPermissions', () => {
    it('should return correct permissions for admin users', () => {
      const permissions = getUserPermissions(adminUser);
      expect(permissions).toContain('notes:read');
      expect(permissions).toContain('notes:create');
      expect(permissions).toContain('notes:edit:all');
      expect(permissions).toContain('notes:delete:all');
      expect(permissions).toContain('tenant:manage');
      expect(permissions).toContain('subscription:upgrade');
      expect(permissions).toContain('users:invite');
      expect(permissions).not.toContain('notes:edit:own');
      expect(permissions).not.toContain('notes:delete:own');
    });

    it('should return correct permissions for member users', () => {
      const permissions = getUserPermissions(memberUser);
      expect(permissions).toContain('notes:read');
      expect(permissions).toContain('notes:create');
      expect(permissions).toContain('notes:edit:own');
      expect(permissions).toContain('notes:delete:own');
      expect(permissions).not.toContain('notes:edit:all');
      expect(permissions).not.toContain('notes:delete:all');
      expect(permissions).not.toContain('tenant:manage');
      expect(permissions).not.toContain('subscription:upgrade');
      expect(permissions).not.toContain('users:invite');
    });
  });

  describe('validatePermission', () => {
    it('should validate admin-only actions correctly', () => {
      expect(validatePermission(adminUser, 'tenant:manage')).toBe(true);
      expect(validatePermission(adminUser, 'subscription:upgrade')).toBe(true);
      expect(validatePermission(adminUser, 'users:invite')).toBe(true);

      expect(validatePermission(memberUser, 'tenant:manage')).toBe(false);
      expect(validatePermission(memberUser, 'subscription:upgrade')).toBe(false);
      expect(validatePermission(memberUser, 'users:invite')).toBe(false);
    });

    it('should validate note access actions correctly', () => {
      expect(validatePermission(adminUser, 'notes:read')).toBe(true);
      expect(validatePermission(adminUser, 'notes:create')).toBe(true);
      expect(validatePermission(memberUser, 'notes:read')).toBe(true);
      expect(validatePermission(memberUser, 'notes:create')).toBe(true);
    });

    it('should validate resource-specific actions with context', () => {
      const ownResourceContext = {
        resourceTenantId: 'tenant123',
        resourceUserId: 'member456',
      };

      const otherResourceContext = {
        resourceTenantId: 'tenant123',
        resourceUserId: 'other-user',
      };

      expect(validatePermission(memberUser, 'notes:edit', ownResourceContext)).toBe(true);
      expect(validatePermission(memberUser, 'notes:edit', otherResourceContext)).toBe(false);
      expect(validatePermission(adminUser, 'notes:edit', otherResourceContext)).toBe(true);
    });

    it('should return false for unknown actions', () => {
      expect(validatePermission(adminUser, 'unknown:action')).toBe(false);
      expect(validatePermission(memberUser, 'unknown:action')).toBe(false);
    });
  });

  describe('getPermissionError', () => {
    it('should return admin required error for admin-only actions', () => {
      expect(getPermissionError(memberUser, 'tenant:manage')).toBe(PERMISSION_ERRORS.ADMIN_REQUIRED);
      expect(getPermissionError(memberUser, 'subscription:upgrade')).toBe(PERMISSION_ERRORS.ADMIN_REQUIRED);
      expect(getPermissionError(memberUser, 'users:invite')).toBe(PERMISSION_ERRORS.ADMIN_REQUIRED);
    });

    it('should return tenant mismatch error for cross-tenant access', () => {
      const crossTenantContext = {
        resourceTenantId: 'other-tenant',
      };
      expect(getPermissionError(memberUser, 'notes:edit', crossTenantContext)).toBe(PERMISSION_ERRORS.TENANT_MISMATCH);
    });

    it('should return ownership required error for member accessing other user resources', () => {
      const otherUserContext = {
        resourceTenantId: 'tenant123',
        resourceUserId: 'other-user',
      };
      expect(getPermissionError(memberUser, 'notes:edit', otherUserContext)).toBe(PERMISSION_ERRORS.OWNERSHIP_REQUIRED);
    });

    it('should return generic access denied for other cases', () => {
      expect(getPermissionError(memberUser, 'unknown:action')).toBe(PERMISSION_ERRORS.RESOURCE_ACCESS_DENIED);
    });
  });

  describe('Cross-tenant access prevention', () => {
    it('should prevent all cross-tenant operations', () => {
      const crossTenantContext: PermissionContext = {
        user: memberUser, // tenant123
        resourceTenantId: 'tenant456', // Different tenant
        resourceUserId: 'any-user',
      };

      expect(canEditNote(crossTenantContext)).toBe(false);
      expect(canDeleteNote(crossTenantContext)).toBe(false);
      expect(canViewNote(crossTenantContext)).toBe(false);
      expect(validatePermission(memberUser, 'notes:edit', { resourceTenantId: 'tenant456' })).toBe(false);
    });

    it('should prevent admin users from accessing other tenants', () => {
      const crossTenantContext: PermissionContext = {
        user: adminUser, // tenant123
        resourceTenantId: 'tenant456', // Different tenant
        resourceUserId: 'any-user',
      };

      expect(canEditNote(crossTenantContext)).toBe(false);
      expect(canDeleteNote(crossTenantContext)).toBe(false);
      expect(canViewNote(crossTenantContext)).toBe(false);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle missing context gracefully', () => {
      const emptyContext: PermissionContext = {
        user: memberUser,
      };

      expect(canEditNote(emptyContext)).toBe(false);
      expect(canDeleteNote(emptyContext)).toBe(false);
      expect(canViewNote(emptyContext)).toBe(false);
    });

    it('should handle invalid role values', () => {
      const invalidRoleUser = {
        ...memberUser,
        role: 'INVALID_ROLE' as any,
      };

      expect(isAdmin(invalidRoleUser)).toBe(false);
      expect(isMember(invalidRoleUser)).toBe(false);
      expect(canManageTenant(invalidRoleUser)).toBe(false);
      expect(canAccessNotes(invalidRoleUser)).toBe(false);
    });

    it('should validate permissions with partial context', () => {
      // Test with only tenant ID
      const tenantOnlyContext = {
        resourceTenantId: 'tenant123',
      };
      expect(validatePermission(memberUser, 'notes:edit', tenantOnlyContext)).toBe(false);

      // Test with only user ID
      const userOnlyContext = {
        resourceUserId: 'member456',
      };
      expect(validatePermission(memberUser, 'notes:edit', userOnlyContext)).toBe(true);
    });

    it('should handle null/undefined resource IDs', () => {
      const nullContext: PermissionContext = {
        user: memberUser,
        resourceTenantId: null as any,
        resourceUserId: null as any,
      };

      expect(canEditNote(nullContext)).toBe(false);
      expect(canDeleteNote(nullContext)).toBe(false);
    });
  });

  describe('Permission Inheritance and Hierarchy', () => {
    it('should respect admin privilege hierarchy', () => {
      // Admin should have all member permissions plus admin-only permissions
      const adminPermissions = getUserPermissions(adminUser);
      const memberPermissions = getUserPermissions(memberUser);

      // Admin should have basic note permissions
      expect(adminPermissions).toContain('notes:read');
      expect(adminPermissions).toContain('notes:create');

      // Admin should have elevated permissions
      expect(adminPermissions).toContain('notes:edit:all');
      expect(adminPermissions).toContain('notes:delete:all');
      expect(adminPermissions).toContain('tenant:manage');

      // Member should not have admin permissions
      expect(memberPermissions).not.toContain('notes:edit:all');
      expect(memberPermissions).not.toContain('tenant:manage');
    });

    it('should validate role-based action permissions comprehensively', () => {
      const adminActions = [
        'tenant:manage',
        'subscription:upgrade',
        'users:invite',
        'notes:read',
        'notes:create',
        'notes:edit',
        'notes:delete',
      ];

      const memberActions = [
        'notes:read',
        'notes:create',
        'notes:edit', // with proper context
        'notes:delete', // with proper context
      ];

      const memberRestrictedActions = [
        'tenant:manage',
        'subscription:upgrade',
        'users:invite',
      ];

      // Test admin permissions
      adminActions.forEach(action => {
        expect(validatePermission(adminUser, action, {
          resourceTenantId: 'tenant123',
          resourceUserId: 'any-user',
        })).toBe(true);
      });

      // Test member permissions with proper context
      memberActions.forEach(action => {
        expect(validatePermission(memberUser, action, {
          resourceTenantId: 'tenant123',
          resourceUserId: 'member456',
        })).toBe(true);
      });

      // Test member restrictions
      memberRestrictedActions.forEach(action => {
        expect(validatePermission(memberUser, action)).toBe(false);
      });
    });
  });

  describe('Security Boundary Validation', () => {
    it('should prevent privilege escalation attempts', () => {
      // Member trying to access admin functions
      expect(canManageTenant(memberUser)).toBe(false);
      expect(canUpgradeSubscription(memberUser)).toBe(false);
      expect(canInviteUsers(memberUser)).toBe(false);

      // Cross-tenant access attempts
      const crossTenantContext: PermissionContext = {
        user: adminUser, // Admin in tenant123
        resourceTenantId: 'tenant456', // Different tenant
        resourceUserId: 'any-user',
      };

      expect(canEditNote(crossTenantContext)).toBe(false);
      expect(validatePermission(adminUser, 'notes:edit', { resourceTenantId: 'tenant456' })).toBe(false);
    });

    it('should provide appropriate error messages for security violations', () => {
      // Test admin-required errors
      expect(getPermissionError(memberUser, 'tenant:manage')).toBe(PERMISSION_ERRORS.ADMIN_REQUIRED);

      // Test tenant mismatch errors
      expect(getPermissionError(memberUser, 'notes:edit', { resourceTenantId: 'other-tenant' }))
        .toBe(PERMISSION_ERRORS.TENANT_MISMATCH);

      // Test ownership errors
      expect(getPermissionError(memberUser, 'notes:edit', { 
        resourceTenantId: 'tenant123', 
        resourceUserId: 'other-user' 
      })).toBe(PERMISSION_ERRORS.OWNERSHIP_REQUIRED);
    });

    it('should validate all permission error constants', () => {
      expect(PERMISSION_ERRORS.INSUFFICIENT_ROLE).toBeDefined();
      expect(PERMISSION_ERRORS.ADMIN_REQUIRED).toBeDefined();
      expect(PERMISSION_ERRORS.MEMBER_REQUIRED).toBeDefined();
      expect(PERMISSION_ERRORS.RESOURCE_ACCESS_DENIED).toBeDefined();
      expect(PERMISSION_ERRORS.TENANT_MISMATCH).toBeDefined();
      expect(PERMISSION_ERRORS.OWNERSHIP_REQUIRED).toBeDefined();

      // Ensure all error messages are strings
      Object.values(PERMISSION_ERRORS).forEach(error => {
        expect(typeof error).toBe('string');
        expect(error.length).toBeGreaterThan(0);
      });
    });
  });
});