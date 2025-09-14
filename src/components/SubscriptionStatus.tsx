'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionData {
  plan: 'FREE' | 'PRO';
  noteCount: number;
  noteLimit: number | null;
  canCreateNotes: boolean;
  canUpgrade: boolean;
}

interface SubscriptionStatusProps {
  onUpgradeSuccess?: () => void;
  showUpgradeButton?: boolean;
  className?: string;
}

export function SubscriptionStatus({ 
  onUpgradeSuccess, 
  showUpgradeButton = true,
  className = '' 
}: SubscriptionStatusProps) {
  const { token, user } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptionStatus = async () => {
    if (!token) return;
    
    try {
      setError(null);
      const response = await fetch('/api/subscription/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch subscription status');
      }

      if (data.success) {
        setSubscriptionData(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch subscription status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!token || !user || !subscriptionData?.canUpgrade) return;
    
    setUpgrading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/tenants/${user.tenantSlug}/upgrade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to upgrade subscription');
      }

      if (data.success) {
        // Refresh subscription status
        await fetchSubscriptionStatus();
        onUpgradeSuccess?.();
      } else {
        throw new Error(data.error?.message || 'Failed to upgrade subscription');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade subscription');
    } finally {
      setUpgrading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [token]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-24"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-red-600 text-sm ${className}`}>
        Error loading subscription status: {error}
      </div>
    );
  }

  if (!subscriptionData) {
    return null;
  }

  const { plan, noteCount, noteLimit, canCreateNotes, canUpgrade } = subscriptionData;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Plan Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Plan:</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            plan === 'PRO' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {plan}
          </span>
        </div>
      </div>

      {/* Note Count and Limit */}
      <div className="text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <span>Notes used:</span>
          <span className="font-medium">
            {noteCount}{noteLimit ? ` / ${noteLimit}` : ' (unlimited)'}
          </span>
        </div>
        
        {/* Progress bar for FREE plan */}
        {plan === 'FREE' && noteLimit && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  noteCount >= noteLimit 
                    ? 'bg-red-500' 
                    : noteCount / noteLimit > 0.8 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((noteCount / noteLimit) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {!canCreateNotes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                You've reached your note limit. Upgrade to Pro for unlimited notes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Button */}
      {showUpgradeButton && canUpgrade && plan === 'FREE' && (
        <div className="pt-2">
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {upgrading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Upgrading...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>Upgrade to Pro</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Success Message */}
      {plan === 'PRO' && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-800">
                You're on the Pro plan with unlimited notes!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Only Message */}
      {plan === 'FREE' && user?.role !== 'ADMIN' && (
        <div className="text-xs text-gray-500">
          Only administrators can upgrade the subscription.
        </div>
      )}
    </div>
  );
}