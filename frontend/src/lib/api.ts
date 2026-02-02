import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance with default config
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

/**
 * Request interceptor - Add auth token and family session to all requests
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Get family session from localStorage
    const familySessionId = localStorage.getItem('family_session_id');
    if (familySessionId && config.headers) {
      config.headers['X-Family-Session'] = familySessionId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - Handle common errors and token expiration
 */
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<ApiError>) => {
    // Network error
    if (!error.response) {
      console.error('Network error:', error.message);
      return Promise.reject({
        error: 'Network error. Please check your connection.',
      });
    }

    const { status, data } = error.response;

    // Handle specific error codes
    switch (status) {
      case 401: {
        // Unauthorized - clear auth and redirect to login
        const errorMessage = (data?.error || '').toLowerCase();
        const errorCode = data?.code;

        // Don't logout for family password verification errors
        if (errorCode !== 'FAMILY_PASSWORD_REQUIRED' && !errorMessage.includes('family password')) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');

          // Only redirect if not already on auth pages
          if (!window.location.pathname.includes('/login') &&
              !window.location.pathname.includes('/register')) {
            window.location.href = '/login';
          }
        }
        break;
      }

      case 403: {
        // Forbidden - might be family password required
        const errorMessage = (data?.error || '').toLowerCase();
        const errorCode = data?.code;
        if (
          errorCode === 'FAMILY_PASSWORD_REQUIRED' ||
          errorMessage.includes('family password') ||
          errorMessage.includes('family session') ||
          errorMessage.includes('session')
        ) {
          // Clear family session - will trigger modal
          localStorage.removeItem('family_session_id');

          // Dispatch custom event to trigger family password modal
          window.dispatchEvent(new CustomEvent('family-password-required'));
        }
        break;
      }

      case 404:
        console.error('Resource not found:', data?.error);
        break;

      case 500:
        console.error('Server error:', data?.error);
        break;

      default:
        console.error(`API Error (${status}):`, data?.error);
    }

    return Promise.reject(error.response?.data || error);
  }
);

/**
 * Helper function to handle API errors consistently
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    return (error as ApiError).error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

export default api;
