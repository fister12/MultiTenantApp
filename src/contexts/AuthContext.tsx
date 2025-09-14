'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// User interface matching the JWT payload
export interface User {
  userId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  tenantId: string;
  tenantSlug: string;
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth-token');
    if (storedToken && typeof storedToken === 'string' && storedToken.includes('.')) {
      try {
        // Decode the token to get user info
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        
        // Check if token is expired
        if (payload.exp * 1000 > Date.now()) {
          setToken(storedToken);
          setUser({
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            tenantId: payload.tenantId,
            tenantSlug: payload.tenantSlug,
          });
        } else {
          // Token expired, remove it
          localStorage.removeItem('auth-token');
        }
      } catch (error) {
        // Invalid token, remove it
        localStorage.removeItem('auth-token');
      }
    }
    setIsLoading(false);
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Throw the API error response for proper error handling
      throw {
        code: data.error?.code || 'LOGIN_FAILED',
        message: data.error?.message || 'Login failed',
        details: data.error?.details,
        statusCode: response.status,
      };
    }

    if (!data.success) {
      throw {
        code: data.error?.code || 'LOGIN_FAILED',
        message: data.error?.message || 'Login failed',
        details: data.error?.details,
      };
    }

    const authToken = data.data?.token;

    if (!authToken) {
      throw {
        code: 'INVALID_RESPONSE',
        message: 'No authentication token received from server',
      };
    }

    try {
      // Decode token to get user info
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      
      const userData: User = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
        tenantSlug: payload.tenantSlug,
      };

      // Store token and user data
      localStorage.setItem('auth-token', authToken);
      setToken(authToken);
      setUser(userData);
    } catch (decodeError) {
      throw {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token received',
      };
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('auth-token');
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}