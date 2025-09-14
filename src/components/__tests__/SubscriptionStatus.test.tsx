import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubscriptionStatus } from '../SubscriptionStatus';
import { useAuth } from '@/contexts/AuthContext';

// Mock the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('SubscriptionStatus', () => {
  const mockUser = {
    userId: 'user1',
    email: 'admin@acme.test',
    role: 'ADMIN' as const,
    tenantId: 'tenant1',
    tenantSlug: 'acme',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      token: 'mock-token',
      user: mockUser,
    });
  });

  it('should display FREE plan status with upgrade button for admin', async () => {
    const mockSubscriptionData = {
      plan: 'FREE',
      noteCount: 2,
      noteLimit: 3,
      canCreateNotes: true,
      canUpgrade: true,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSubscriptionData,
      }),
    });

    render(<SubscriptionStatus />);

    await waitFor(() => {
      expect(screen.getByText('FREE')).toBeInTheDocument();
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
    });

    // Check progress bar is displayed
    const progressBar = document.querySelector('.bg-green-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should display PRO plan status without upgrade button', async () => {
    const mockSubscriptionData = {
      plan: 'PRO',
      noteCount: 10,
      noteLimit: null,
      canCreateNotes: true,
      canUpgrade: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSubscriptionData,
      }),
    });

    render(<SubscriptionStatus />);

    await waitFor(() => {
      expect(screen.getByText('PRO')).toBeInTheDocument();
      expect(screen.getByText('10 (unlimited)')).toBeInTheDocument();
      expect(screen.getByText("You're on the Pro plan with unlimited notes!")).toBeInTheDocument();
    });

    expect(screen.queryByText('Upgrade to Pro')).not.toBeInTheDocument();
  });

  it('should show warning when note limit is reached', async () => {
    const mockSubscriptionData = {
      plan: 'FREE',
      noteCount: 3,
      noteLimit: 3,
      canCreateNotes: false,
      canUpgrade: true,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSubscriptionData,
      }),
    });

    render(<SubscriptionStatus />);

    await waitFor(() => {
      expect(screen.getByText("You've reached your note limit. Upgrade to Pro for unlimited notes.")).toBeInTheDocument();
    });

    // Check progress bar is red when at limit
    const progressBar = document.querySelector('.bg-red-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should handle upgrade button click', async () => {
    const mockSubscriptionData = {
      plan: 'FREE',
      noteCount: 2,
      noteLimit: 3,
      canCreateNotes: true,
      canUpgrade: true,
    };

    const mockUpgradeResponse = {
      success: true,
      data: {
        message: 'Tenant subscription upgraded successfully',
        tenant: {
          slug: 'acme',
          plan: 'PRO',
        },
      },
    };

    const mockUpdatedSubscriptionData = {
      plan: 'PRO',
      noteCount: 2,
      noteLimit: null,
      canCreateNotes: true,
      canUpgrade: false,
    };

    // Mock initial subscription status fetch
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockSubscriptionData,
        }),
      })
      // Mock upgrade request
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpgradeResponse,
      })
      // Mock updated subscription status fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockUpdatedSubscriptionData,
        }),
      });

    const onUpgradeSuccess = vi.fn();
    render(<SubscriptionStatus onUpgradeSuccess={onUpgradeSuccess} />);

    await waitFor(() => {
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
    });

    const upgradeButton = screen.getByText('Upgrade to Pro');
    fireEvent.click(upgradeButton);

    // Should show upgrading state
    await waitFor(() => {
      expect(screen.getByText('Upgrading...')).toBeInTheDocument();
    });

    // Should call upgrade API
    expect(global.fetch).toHaveBeenCalledWith('/api/tenants/acme/upgrade', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'application/json',
      },
    });

    // Should call onUpgradeSuccess callback
    await waitFor(() => {
      expect(onUpgradeSuccess).toHaveBeenCalled();
    });
  });

  it('should not show upgrade button for non-admin users', async () => {
    (useAuth as any).mockReturnValue({
      token: 'mock-token',
      user: { ...mockUser, role: 'MEMBER' },
    });

    const mockSubscriptionData = {
      plan: 'FREE',
      noteCount: 2,
      noteLimit: 3,
      canCreateNotes: true,
      canUpgrade: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSubscriptionData,
      }),
    });

    render(<SubscriptionStatus />);

    await waitFor(() => {
      expect(screen.getByText('FREE')).toBeInTheDocument();
      expect(screen.getByText('Only administrators can upgrade the subscription.')).toBeInTheDocument();
    });

    expect(screen.queryByText('Upgrade to Pro')).not.toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database connection failed',
        },
      }),
    });

    render(<SubscriptionStatus />);

    await waitFor(() => {
      expect(screen.getByText('Error loading subscription status: Database connection failed')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<SubscriptionStatus />);

    // Should show loading skeleton
    const loadingElements = document.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });
});