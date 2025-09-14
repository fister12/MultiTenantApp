'use client';

import { useState, useCallback } from 'react';
import { 
  ClientError, 
  parseApiError, 
  getUserFriendlyMessage, 
  extractValidationErrors,
  ErrorDisplayConfig 
} from '@/lib/client-error-handler';

// Error state interface
export interface ErrorState {
  error: ClientError | null;
  isError: boolean;
  message: string;
  fieldErrors: Record<string, string>;
}

// Hook options
export interface UseErrorHandlerOptions {
  displayConfig?: Partial<ErrorDisplayConfig>;
  onError?: (error: ClientError) => void;
  clearOnSuccess?: boolean;
}

// Error handler hook
export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isError: false,
    message: '',
    fieldErrors: {},
  });

  // Handle error
  const handleError = useCallback((error: unknown) => {
    const clientError = parseApiError(error);
    const message = getUserFriendlyMessage(clientError, options.displayConfig);
    const fieldErrors = extractValidationErrors(clientError);

    const newErrorState: ErrorState = {
      error: clientError,
      isError: true,
      message,
      fieldErrors,
    };

    setErrorState(newErrorState);

    // Call custom error handler if provided
    if (options.onError) {
      options.onError(clientError);
    }

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error handled:', clientError);
    }
  }, [options.displayConfig, options.onError]);

  // Clear error
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isError: false,
      message: '',
      fieldErrors: {},
    });
  }, []);

  // Handle success (optionally clear errors)
  const handleSuccess = useCallback(() => {
    if (options.clearOnSuccess !== false) {
      clearError();
    }
  }, [clearError, options.clearOnSuccess]);

  // Async wrapper that handles errors automatically
  const withErrorHandling = useCallback(
    <T>(asyncFn: () => Promise<T>) => {
      return async (): Promise<T | null> => {
        try {
          const result = await asyncFn();
          handleSuccess();
          return result;
        } catch (error) {
          handleError(error);
          return null;
        }
      };
    },
    [handleError, handleSuccess]
  );

  return {
    ...errorState,
    handleError,
    clearError,
    handleSuccess,
    withErrorHandling,
  };
}

// Specialized hook for form validation errors
export function useFormErrorHandler(options: UseErrorHandlerOptions = {}) {
  const errorHandler = useErrorHandler(options);

  // Get error for specific field
  const getFieldError = useCallback(
    (fieldName: string): string | undefined => {
      return errorHandler.fieldErrors[fieldName];
    },
    [errorHandler.fieldErrors]
  );

  // Check if field has error
  const hasFieldError = useCallback(
    (fieldName: string): boolean => {
      return Boolean(errorHandler.fieldErrors[fieldName]);
    },
    [errorHandler.fieldErrors]
  );

  // Get all field errors as array
  const getFieldErrorsArray = useCallback((): Array<{ field: string; message: string }> => {
    return Object.entries(errorHandler.fieldErrors).map(([field, message]) => ({
      field,
      message,
    }));
  }, [errorHandler.fieldErrors]);

  return {
    ...errorHandler,
    getFieldError,
    hasFieldError,
    getFieldErrorsArray,
  };
}

// Hook for API requests with loading and error states
export function useApiRequest<T>(options: UseErrorHandlerOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const errorHandler = useErrorHandler(options);

  const execute = useCallback(
    async (apiCall: () => Promise<T>): Promise<T | null> => {
      setIsLoading(true);
      errorHandler.clearError();

      try {
        const result = await apiCall();
        errorHandler.handleSuccess();
        return result;
      } catch (error) {
        errorHandler.handleError(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [errorHandler]
  );

  return {
    ...errorHandler,
    isLoading,
    execute,
  };
}

// Hook for optimistic updates with error rollback
export function useOptimisticUpdate<T>(
  initialData: T,
  options: UseErrorHandlerOptions = {}
) {
  const [data, setData] = useState<T>(initialData);
  const [previousData, setPreviousData] = useState<T>(initialData);
  const errorHandler = useErrorHandler(options);

  const executeOptimistic = useCallback(
    async (
      optimisticUpdate: T,
      apiCall: () => Promise<T>
    ): Promise<T | null> => {
      // Store current data for rollback
      setPreviousData(data);
      
      // Apply optimistic update
      setData(optimisticUpdate);
      errorHandler.clearError();

      try {
        const result = await apiCall();
        setData(result);
        errorHandler.handleSuccess();
        return result;
      } catch (error) {
        // Rollback on error
        setData(previousData);
        errorHandler.handleError(error);
        return null;
      }
    },
    [data, previousData, errorHandler]
  );

  return {
    ...errorHandler,
    data,
    setData,
    executeOptimistic,
  };
}