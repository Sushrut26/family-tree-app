import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { getErrorMessage } from '../lib/api';
import type {
  User,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  FamilyPasswordRequest,
  FamilyPasswordResponse,
} from '../types';

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  familySessionId: string | null;
  showFamilyPasswordModal: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  verifyFamilyPassword: (password: string) => Promise<void>;
  setShowFamilyPasswordModal: (show: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      // Initial state
      user: null,
      token: null,
      familySessionId: null,
      showFamilyPasswordModal: false,
      isLoading: false,
      error: null,

      // Login action
      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null });

        try {
          const response = await api.post<AuthResponse>('/auth/login', credentials);
          const { user, token } = response.data;

          set({
            user,
            token: token || null,
            isLoading: false,
            showFamilyPasswordModal: true, // Show family password modal after login
          });
        } catch (error) {
          const message = getErrorMessage(error);
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      // Register action
      register: async (data: RegisterRequest) => {
        set({ isLoading: true, error: null });

        try {
          const response = await api.post<AuthResponse>('/auth/register', data);
          const { user, token } = response.data;

          set({
            user,
            token: token || null,
            isLoading: false,
            showFamilyPasswordModal: true, // Show family password modal after registration
          });
        } catch (error) {
          const message = getErrorMessage(error);
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      // Logout action
      logout: () => {
        void api.post('/auth/logout').catch(() => {
          // Ignore logout network errors
        });

        // Reset state
        set({
          user: null,
          token: null,
          familySessionId: null,
          showFamilyPasswordModal: false,
          error: null,
        });
      },

      // Verify family password
      verifyFamilyPassword: async (password: string) => {
        set({ isLoading: true, error: null });

        try {
          const request: FamilyPasswordRequest = { password };
          const response = await api.post<FamilyPasswordResponse>(
            '/family-config/verify',
            request
          );

          set({
            showFamilyPasswordModal: false,
            isLoading: false,
            familySessionId: response.data.sessionId || null,
          });
        } catch (error) {
          const message = getErrorMessage(error);
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      // Control family password modal visibility
      setShowFamilyPasswordModal: (show: boolean) => {
        set({ showFamilyPasswordModal: show });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      // Only persist user data, not sensitive tokens or states
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        familySessionId: state.familySessionId,
      }),
    }
  )
);

// Listen for family password required events from axios interceptor
if (typeof window !== 'undefined') {
  window.addEventListener('family-password-required', () => {
    useAuthStore.setState({ showFamilyPasswordModal: true });
  });
}
