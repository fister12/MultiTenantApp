import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

const mockPush = vi.fn();
(useRouter as any).mockReturnValue({
  push: mockPush,
});

// Simple test component that uses auth
function TestComponent() {
  const { isAuthenticated } = useAuth();
  
  return (
    <div data-testid="auth-status">
      {isAuthenticated ? 'authenticated' : 'not-authenticated'}
    </div>
  );
}

describe('Authentication Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('AuthProvider', () => {
    it('should provide authentication context with initial state', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });

    it('should restore authentication from localStorage', async () => {
      // Mock a valid token in localStorage
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6IkFETUlOIiwidGVuYW50SWQiOiIxIiwidGVuYW50U2x1ZyI6ImFjbWUiLCJpYXQiOjE2MzQ1Njc4OTAsImV4cCI6OTk5OTk5OTk5OX0.mock-signature';
      
      // Mock localStorage.getItem to return the token
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(mockToken);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Should eventually show authenticated state
      await vi.waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });
    });


  });
});