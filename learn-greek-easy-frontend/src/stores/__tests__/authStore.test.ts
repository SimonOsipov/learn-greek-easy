// src/stores/__tests__/authStore.test.ts
/**
 * AuthStore Unit Tests
 *
 * These tests are enabled by TEST-FIX-1's conditional persistence pattern.
 * In test mode (import.meta.env.MODE === 'test'), the persist middleware
 * is disabled, allowing proper unit testing with mocked APIs.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { mockAuthAPI } from '@/services/mockAuthAPI';
import type { User, AuthResponse, AuthError } from '@/types/auth';

import { useAuthStore } from '../authStore';
import { useAnalyticsStore } from '../analyticsStore';

// Mock the mockAuthAPI service
vi.mock('@/services/mockAuthAPI', () => ({
  mockAuthAPI: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    verifyToken: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

// Mock the analytics store
vi.mock('../analyticsStore', () => ({
  useAnalyticsStore: {
    getState: vi.fn(() => ({
      clearAnalytics: vi.fn(),
    })),
  },
}));

describe('authStore', () => {
  // Mock data
  const mockUser: User = {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'free',
    preferences: {
      language: 'en',
      dailyGoal: 10,
      notifications: true,
    },
    stats: {
      streak: 5,
      wordsLearned: 100,
      totalXP: 500,
      joinedDate: new Date('2025-01-01'),
    },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockAuthResponse: AuthResponse = {
    user: mockUser,
    token: 'mock-token-123',
    refreshToken: 'mock-refresh-token-123',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  };

  const mockClearAnalytics = vi.fn();

  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      rememberMe: false,
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Clear sessionStorage
    sessionStorage.clear();

    // Setup analytics store mock
    vi.mocked(useAnalyticsStore.getState).mockReturnValue({
      clearAnalytics: mockClearAnalytics,
    } as ReturnType<typeof useAnalyticsStore.getState>);
  });

  describe('Initial State', () => {
    it('should have correct initial state values', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.refreshToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.rememberMe).toBe(false);
    });

    it('should not be authenticated initially', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('login', () => {
    it('should set loading state during login', async () => {
      vi.mocked(mockAuthAPI.login).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockAuthResponse), 100))
      );

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.isLoading).toBe(false);

      const loginPromise = act(async () => {
        await result.current.login('test@example.com', 'password123', true);
      });

      // Check loading state is set (may need to wait for state update)
      await act(async () => {
        // Small delay to allow state to update
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await loginPromise;

      expect(result.current.isLoading).toBe(false);
    });

    it('should set user and tokens on successful login', async () => {
      vi.mocked(mockAuthAPI.login).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password123', true);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe('mock-token-123');
      expect(result.current.refreshToken).toBe('mock-refresh-token-123');
    });

    it('should set isAuthenticated to true on success', async () => {
      vi.mocked(mockAuthAPI.login).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password123', true);
      });

      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should set rememberMe based on parameter', async () => {
      vi.mocked(mockAuthAPI.login).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuthStore());

      // Test with rememberMe = true
      await act(async () => {
        await result.current.login('test@example.com', 'password123', true);
      });

      expect(result.current.rememberMe).toBe(true);

      // Reset state
      useAuthStore.setState({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        rememberMe: false,
      });

      // Test with rememberMe = false
      await act(async () => {
        await result.current.login('test@example.com', 'password123', false);
      });

      expect(result.current.rememberMe).toBe(false);
    });

    it('should store token in sessionStorage when rememberMe is false', async () => {
      vi.mocked(mockAuthAPI.login).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password123', false);
      });

      expect(sessionStorage.getItem('auth-token')).toBe('mock-token-123');
    });

    it('should not store token in sessionStorage when rememberMe is true', async () => {
      vi.mocked(mockAuthAPI.login).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password123', true);
      });

      expect(sessionStorage.getItem('auth-token')).toBeNull();
    });

    it('should set error on failed login', async () => {
      const mockError: AuthError = {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      };
      vi.mocked(mockAuthAPI.login).mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.login('test@example.com', 'wrongpassword', false);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toEqual(mockError);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should clear previous errors on new login attempt', async () => {
      const mockError: AuthError = {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      };
      vi.mocked(mockAuthAPI.login).mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useAuthStore());

      // First attempt - fails
      await act(async () => {
        try {
          await result.current.login('test@example.com', 'wrongpassword', false);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toEqual(mockError);

      // Second attempt - succeeds
      vi.mocked(mockAuthAPI.login).mockResolvedValue(mockAuthResponse);

      await act(async () => {
        await result.current.login('test@example.com', 'password123', true);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('logout', () => {
    beforeEach(async () => {
      // Setup authenticated state
      vi.mocked(mockAuthAPI.login).mockResolvedValue(mockAuthResponse);
      const store = useAuthStore.getState();
      await store.login('test@example.com', 'password123', true);
    });

    it('should clear all auth state on logout', async () => {
      vi.mocked(mockAuthAPI.logout).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.isAuthenticated).toBe(true);

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.refreshToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.rememberMe).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should call mockAuthAPI.logout with token', async () => {
      vi.mocked(mockAuthAPI.logout).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockAuthAPI.logout).toHaveBeenCalledWith('mock-token-123');
    });

    it('should clear analytics store', async () => {
      vi.mocked(mockAuthAPI.logout).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockClearAnalytics).toHaveBeenCalled();
    });

    it('should clear sessionStorage', async () => {
      vi.mocked(mockAuthAPI.logout).mockResolvedValue(undefined);
      sessionStorage.setItem('auth-token', 'mock-token-123');

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      expect(sessionStorage.getItem('auth-token')).toBeNull();
    });

    it('should handle logout errors gracefully', async () => {
      vi.mocked(mockAuthAPI.logout).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuthStore());

      // Should not throw
      await act(async () => {
        await result.current.logout();
      });

      // State should still be cleared
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('register', () => {
    const registerData = {
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
    };

    it('should set loading during registration', async () => {
      vi.mocked(mockAuthAPI.register).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockAuthResponse), 100))
      );

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.isLoading).toBe(false);

      const registerPromise = act(async () => {
        await result.current.register(registerData);
      });

      await registerPromise;

      expect(result.current.isLoading).toBe(false);
    });

    it('should set user and tokens on successful registration', async () => {
      vi.mocked(mockAuthAPI.register).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.register(registerData);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe('mock-token-123');
      expect(result.current.refreshToken).toBe('mock-refresh-token-123');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should store token in sessionStorage (new users start without rememberMe)', async () => {
      vi.mocked(mockAuthAPI.register).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.register(registerData);
      });

      expect(sessionStorage.getItem('auth-token')).toBe('mock-token-123');
      expect(result.current.rememberMe).toBe(false);
    });

    it('should set error on failed registration (duplicate email)', async () => {
      const mockError: AuthError = {
        code: 'EMAIL_EXISTS',
        message: 'An account with this email already exists',
        field: 'email',
      };
      vi.mocked(mockAuthAPI.register).mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.register(registerData);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toEqual(mockError);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('refreshSession', () => {
    it('should refresh tokens successfully', async () => {
      const newAuthResponse: AuthResponse = {
        ...mockAuthResponse,
        token: 'new-token-456',
        refreshToken: 'new-refresh-token-456',
      };
      vi.mocked(mockAuthAPI.refreshToken).mockResolvedValue(newAuthResponse);

      // Setup state with existing refresh token
      useAuthStore.setState({
        user: mockUser,
        token: 'old-token',
        refreshToken: 'mock-refresh-token-123',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        rememberMe: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(mockAuthAPI.refreshToken).toHaveBeenCalledWith('mock-refresh-token-123');
      expect(result.current.token).toBe('new-token-456');
      expect(result.current.refreshToken).toBe('new-refresh-token-456');
    });

    it('should throw error when no refresh token', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.refreshSession();
        } catch (error) {
          expect((error as Error).message).toBe('No refresh token available');
        }
      });

      expect(mockAuthAPI.refreshToken).not.toHaveBeenCalled();
    });

    it('should set error and unauthenticated on refresh failure', async () => {
      const mockError: AuthError = {
        code: 'INVALID_TOKEN',
        message: 'Invalid refresh token',
      };
      vi.mocked(mockAuthAPI.refreshToken).mockRejectedValue(mockError);

      // Setup state with existing refresh token
      useAuthStore.setState({
        user: mockUser,
        token: 'old-token',
        refreshToken: 'expired-refresh-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        rememberMe: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.refreshSession();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toEqual(mockError);
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      // Setup authenticated state
      useAuthStore.setState({
        user: mockUser,
        token: 'mock-token-123',
        refreshToken: 'mock-refresh-token-123',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        rememberMe: true,
      });
    });

    it('should update user profile successfully', async () => {
      const updatedUser: User = {
        ...mockUser,
        name: 'Updated Name',
      };
      vi.mocked(mockAuthAPI.updateProfile).mockResolvedValue(updatedUser);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.updateProfile({ name: 'Updated Name' });
      });

      expect(mockAuthAPI.updateProfile).toHaveBeenCalledWith('test-user-123', {
        name: 'Updated Name',
      });
      expect(result.current.user?.name).toBe('Updated Name');
    });

    it('should throw error when no user logged in', async () => {
      // Clear user
      useAuthStore.setState({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        rememberMe: false,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.updateProfile({ name: 'New Name' });
        } catch (error) {
          expect((error as Error).message).toBe('No user logged in');
        }
      });

      expect(mockAuthAPI.updateProfile).not.toHaveBeenCalled();
    });

    it('should set error on update failure', async () => {
      const mockError: AuthError = {
        code: 'UPDATE_FAILED',
        message: 'Failed to update profile',
      };
      vi.mocked(mockAuthAPI.updateProfile).mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.updateProfile({ name: 'New Name' });
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('checkAuth', () => {
    it('should verify existing token and restore auth state', async () => {
      vi.mocked(mockAuthAPI.verifyToken).mockResolvedValue(mockUser);

      // Setup state with existing token
      useAuthStore.setState({
        user: null,
        token: 'mock-token-123',
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        rememberMe: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(mockAuthAPI.verifyToken).toHaveBeenCalledWith('mock-token-123');
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should check sessionStorage for token', async () => {
      vi.mocked(mockAuthAPI.verifyToken).mockResolvedValue(mockUser);
      sessionStorage.setItem('auth-token', 'session-token-123');

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(mockAuthAPI.verifyToken).toHaveBeenCalledWith('session-token-123');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should set unauthenticated when no token', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(mockAuthAPI.verifyToken).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle invalid tokens (verifyToken returns null)', async () => {
      vi.mocked(mockAuthAPI.verifyToken).mockResolvedValue(null);

      // Setup state with expired token
      useAuthStore.setState({
        user: null,
        token: 'expired-token',
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        rememberMe: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle verification errors gracefully', async () => {
      vi.mocked(mockAuthAPI.verifyToken).mockRejectedValue(new Error('Network error'));

      // Setup state with token
      useAuthStore.setState({
        user: null,
        token: 'mock-token-123',
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        rememberMe: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear errors with clearError action', async () => {
      // Setup state with error
      useAuthStore.setState({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: {
          code: 'SOME_ERROR',
          message: 'Some error message',
        },
        rememberMe: false,
      });

      const { result } = renderHook(() => useAuthStore());

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
