'use client';

import React from 'react';
import { ClientError, formatErrorForDisplay } from '@/lib/client-error-handler';

// Error display props
interface ErrorDisplayProps {
  error: ClientError | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  showDetails?: boolean;
  showCode?: boolean;
  className?: string;
  variant?: 'banner' | 'card' | 'inline' | 'toast';
}

// Error icon component
function ErrorIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  );
}

// Warning icon component
function WarningIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

// Close icon component
function CloseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

// Get error severity based on error code
function getErrorSeverity(code: string): 'error' | 'warning' | 'info' {
  const warningCodes = [
    'SUBSCRIPTION_LIMIT_EXCEEDED',
    'RATE_LIMIT_EXCEEDED',
    'REQUEST_TOO_LARGE',
  ];
  
  const infoCodes = [
    'RESOURCE_NOT_FOUND',
    'VALIDATION_ERROR',
  ];
  
  if (warningCodes.includes(code)) return 'warning';
  if (infoCodes.includes(code)) return 'info';
  return 'error';
}

// Banner variant
function ErrorBanner({ 
  error, 
  onDismiss, 
  onRetry, 
  showDetails, 
  showCode 
}: ErrorDisplayProps) {
  if (!error) return null;
  
  const formatted = formatErrorForDisplay(error, { showDetails, showCode });
  const severity = getErrorSeverity(error.code);
  
  const bgColor = {
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
  }[severity];
  
  const textColor = {
    error: 'text-red-800',
    warning: 'text-yellow-800',
    info: 'text-blue-800',
  }[severity];
  
  const iconColor = {
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400',
  }[severity];
  
  return (
    <div className={`border rounded-md p-4 ${bgColor}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {severity === 'warning' ? (
            <WarningIcon className={`h-5 w-5 ${iconColor}`} />
          ) : (
            <ErrorIcon className={`h-5 w-5 ${iconColor}`} />
          )}
        </div>
        
        <div className="ml-3 flex-1">
          <p className={`text-sm font-medium ${textColor}`}>
            {formatted.message}
          </p>
          
          {formatted.code && (
            <p className={`mt-1 text-xs ${textColor} opacity-75`}>
              Error Code: {formatted.code}
            </p>
          )}
          
          {formatted.details && (
            <div className={`mt-2 text-xs ${textColor} opacity-75`}>
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(formatted.details, null, 2)}
              </pre>
            </div>
          )}
          
          {onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className={`text-sm font-medium ${textColor} hover:opacity-75`}
              >
                Try again
              </button>
            </div>
          )}
        </div>
        
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={onDismiss}
                className={`inline-flex rounded-md p-1.5 ${textColor} hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600`}
              >
                <span className="sr-only">Dismiss</span>
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Card variant
function ErrorCard({ 
  error, 
  onDismiss, 
  onRetry, 
  showDetails, 
  showCode 
}: ErrorDisplayProps) {
  if (!error) return null;
  
  const formatted = formatErrorForDisplay(error, { showDetails, showCode });
  
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <ErrorIcon className="h-8 w-8 text-red-400" />
        </div>
        
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-medium text-gray-900">
            Error
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {formatted.message}
          </p>
        </div>
        
        {onDismiss && (
          <div className="ml-4">
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600"
            >
              <CloseIcon className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>
      
      {formatted.code && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-500">
            Error Code: {formatted.code}
          </p>
        </div>
      )}
      
      {formatted.details && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-500 mb-2">Details:</p>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
            {JSON.stringify(formatted.details, null, 2)}
          </pre>
        </div>
      )}
      
      {onRetry && (
        <div className="mt-6">
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// Inline variant
function ErrorInline({ 
  error, 
  onDismiss, 
  showDetails, 
  showCode 
}: ErrorDisplayProps) {
  if (!error) return null;
  
  const formatted = formatErrorForDisplay(error, { showDetails, showCode });
  
  return (
    <div className="flex items-start space-x-2 text-sm text-red-600">
      <ErrorIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <span>{formatted.message}</span>
        {formatted.code && (
          <span className="ml-2 text-xs opacity-75">
            ({formatted.code})
          </span>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Toast variant
function ErrorToast({ 
  error, 
  onDismiss, 
  onRetry, 
  showDetails, 
  showCode 
}: ErrorDisplayProps) {
  if (!error) return null;
  
  const formatted = formatErrorForDisplay(error, { showDetails, showCode });
  
  return (
    <div className="max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <ErrorIcon className="h-6 w-6 text-red-400" />
          </div>
          
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-gray-900">
              Error
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {formatted.message}
            </p>
            
            {onRetry && (
              <div className="mt-3">
                <button
                  onClick={onRetry}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
          
          {onDismiss && (
            <div className="ml-4 flex-shrink-0 flex">
              <button
                onClick={onDismiss}
                className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <span className="sr-only">Close</span>
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main ErrorDisplay component
export function ErrorDisplay(props: ErrorDisplayProps) {
  const { variant = 'banner', className = '' } = props;
  
  if (!props.error) return null;
  
  const Component = {
    banner: ErrorBanner,
    card: ErrorCard,
    inline: ErrorInline,
    toast: ErrorToast,
  }[variant];
  
  return (
    <div className={className}>
      <Component {...props} />
    </div>
  );
}

// Field error display for forms
export function FieldError({ 
  error, 
  className = '' 
}: { 
  error?: string; 
  className?: string;
}) {
  if (!error) return null;
  
  return (
    <p className={`text-sm text-red-600 ${className}`}>
      {error}
    </p>
  );
}

// Multiple field errors display
export function FieldErrors({ 
  errors, 
  className = '' 
}: { 
  errors: Record<string, string>; 
  className?: string;
}) {
  const errorEntries = Object.entries(errors);
  
  if (errorEntries.length === 0) return null;
  
  return (
    <div className={`space-y-1 ${className}`}>
      {errorEntries.map(([field, message]) => (
        <div key={field} className="flex items-start space-x-2 text-sm text-red-600">
          <ErrorIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            <span className="font-medium capitalize">{field}:</span> {message}
          </span>
        </div>
      ))}
    </div>
  );
}