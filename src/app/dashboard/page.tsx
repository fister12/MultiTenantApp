'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SubscriptionStatus } from '@/components/SubscriptionStatus';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">
                  Notes Dashboard
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {user?.email} ({user?.role}) - {user?.tenantSlug}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Welcome to your Notes Dashboard
                </h2>
                <p className="text-gray-600 mb-6">
                  You are logged in as <strong>{user?.email}</strong> with{' '}
                  <strong>{user?.role}</strong> role in the{' '}
                  <strong>{user?.tenantSlug}</strong> tenant.
                </p>
                <div className="space-y-6">
                  {/* Subscription Status */}
                  <div className="bg-white shadow rounded-lg p-6 max-w-md mx-auto">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Subscription Status</h3>
                    <SubscriptionStatus />
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white shadow rounded-lg p-6 max-w-md mx-auto">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                      <a
                        href="/notes"
                        className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center px-4 py-2 rounded-md text-sm font-medium"
                      >
                        View My Notes
                      </a>
                      <a
                        href="/notes/new"
                        className="block w-full bg-green-600 hover:bg-green-700 text-white text-center px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Create New Note
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}