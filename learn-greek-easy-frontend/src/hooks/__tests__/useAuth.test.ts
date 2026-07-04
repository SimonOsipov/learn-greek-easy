/**
 * useAuth Hook Tests
 * Tests authentication hooks including useAuth, useRequireAuth, useRedirectIfAuth, and useRequireRole
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAuth, useRequireAuth, useRedirectIfAuth, useRequireRole } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import type { User, UserRole } from '@/types/auth';

// Helper: build a minimal valid User for test assertions
function makeUser(overrides: { id: string; email: string; name: string; role: UserRole }): User {
  return {
    ...overrides,
    preferences: { language: 'en', dailyGoal: 20, notifications: true },
    stats: { streak: 0, wordsLearned: 0, totalXP: 0, joinedDate: new Date('2025-01-01') },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };
}

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('useAuth Hook', () => {
  beforeEach(() => {
    // Reset auth store
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    mockNavigate.mockClear();
  });

  describe('useAuth', () => {
    it('should return unauthenticated state initially', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return authenticated user data', () => {
      const mockUser = makeUser({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'free',
      });

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('should provide login function', () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.login).toBe('function');
    });

    it('should provide logout function', () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.logout).toBe('function');
    });

    it('should provide register function', () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.register).toBe('function');
    });

    it('should provide updateProfile function', () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.updateProfile).toBe('function');
    });

    it('should provide clearError function', () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.clearError).toBe('function');
    });

    describe('Role-based computed properties', () => {
      it('should identify admin users', () => {
        useAuthStore.setState({
          user: makeUser({
            id: '1',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin',
          }),
          isAuthenticated: true,
        });

        const { result } = renderHook(() => useAuth());

        expect(result.current.isAdmin).toBe(true);
        expect(result.current.isPremium).toBe(true);
        expect(result.current.isFree).toBe(false);
      });

      it('should identify premium users', () => {
        useAuthStore.setState({
          user: makeUser({
            id: '2',
            email: 'premium@example.com',
            name: 'Premium User',
            role: 'premium',
          }),
          isAuthenticated: true,
        });

        const { result } = renderHook(() => useAuth());

        expect(result.current.isAdmin).toBe(false);
        expect(result.current.isPremium).toBe(true);
        expect(result.current.isFree).toBe(false);
      });

      it('should identify free users', () => {
        useAuthStore.setState({
          user: makeUser({ id: '3', email: 'free@example.com', name: 'Free User', role: 'free' }),
          isAuthenticated: true,
        });

        const { result } = renderHook(() => useAuth());

        expect(result.current.isAdmin).toBe(false);
        expect(result.current.isPremium).toBe(false);
        expect(result.current.isFree).toBe(true);
      });

      it('should handle no user (all flags false)', () => {
        const { result } = renderHook(() => useAuth());

        expect(result.current.isAdmin).toBe(false);
        expect(result.current.isPremium).toBe(false);
        expect(result.current.isFree).toBe(false);
      });
    });

    it('should return error state when present', () => {
      const mockError = {
        message: 'Invalid credentials',
        code: 'AUTH_ERROR',
      };

      useAuthStore.setState({ error: mockError });

      const { result } = renderHook(() => useAuth());
      expect(result.current.error).toEqual(mockError);
    });

    it('should return loading state', () => {
      useAuthStore.setState({ isLoading: true });

      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('useRequireAuth', () => {
    it('should not redirect when authenticated', () => {
      useAuthStore.setState({
        user: makeUser({ id: '1', email: 'test@example.com', name: 'Test User', role: 'free' }),
        isAuthenticated: true,
        isLoading: false,
      });

      renderHook(() => useRequireAuth());

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should redirect to login when not authenticated', () => {
      useAuthStore.setState({
        isAuthenticated: false,
        isLoading: false,
      });

      renderHook(() => useRequireAuth());

      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    it('should use custom redirect path', () => {
      useAuthStore.setState({
        isAuthenticated: false,
        isLoading: false,
      });

      renderHook(() => useRequireAuth('/custom-login'));

      expect(mockNavigate).toHaveBeenCalledWith('/custom-login', { replace: true });
    });

    it('should not redirect while loading', () => {
      useAuthStore.setState({
        isAuthenticated: false,
        isLoading: true,
      });

      renderHook(() => useRequireAuth());

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should return authentication status', () => {
      useAuthStore.setState({
        isAuthenticated: true,
        isLoading: false,
      });

      const { result } = renderHook(() => useRequireAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('useRedirectIfAuth', () => {
    it('should redirect to dashboard when authenticated', () => {
      useAuthStore.setState({
        user: makeUser({ id: '1', email: 'test@example.com', name: 'Test User', role: 'free' }),
        isAuthenticated: true,
      });

      renderHook(() => useRedirectIfAuth());

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });

    it('should not redirect when not authenticated', () => {
      useAuthStore.setState({
        isAuthenticated: false,
      });

      renderHook(() => useRedirectIfAuth());

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should use custom redirect path', () => {
      useAuthStore.setState({
        user: makeUser({ id: '1', email: 'test@example.com', name: 'Test User', role: 'free' }),
        isAuthenticated: true,
      });

      renderHook(() => useRedirectIfAuth('/home'));

      expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true });
    });
  });

  describe('useRequireRole', () => {
    it('should redirect to login when not authenticated', () => {
      useAuthStore.setState({
        isAuthenticated: false,
      });

      renderHook(() => useRequireRole('premium'));

      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    it('should not redirect when user has required role', () => {
      useAuthStore.setState({
        user: makeUser({
          id: '1',
          email: 'premium@example.com',
          name: 'Premium User',
          role: 'premium',
        }),
        isAuthenticated: true,
      });

      renderHook(() => useRequireRole('premium'));

      // Should not redirect (only login redirect should happen, and it doesn't because authenticated)
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should redirect when user lacks required role', () => {
      useAuthStore.setState({
        user: makeUser({ id: '1', email: 'free@example.com', name: 'Free User', role: 'free' }),
        isAuthenticated: true,
      });

      renderHook(() => useRequireRole('premium'));

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });

    it('should allow admin users to access premium features', () => {
      useAuthStore.setState({
        user: makeUser({ id: '1', email: 'admin@example.com', name: 'Admin User', role: 'admin' }),
        isAuthenticated: true,
      });

      renderHook(() => useRequireRole('premium'));

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should allow admin users to access admin features', () => {
      useAuthStore.setState({
        user: makeUser({ id: '1', email: 'admin@example.com', name: 'Admin User', role: 'admin' }),
        isAuthenticated: true,
      });

      renderHook(() => useRequireRole('admin'));

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should not allow premium users to access admin features', () => {
      useAuthStore.setState({
        user: makeUser({
          id: '1',
          email: 'premium@example.com',
          name: 'Premium User',
          role: 'premium',
        }),
        isAuthenticated: true,
      });

      renderHook(() => useRequireRole('admin'));

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });

    it('should use custom redirect path when access denied', () => {
      useAuthStore.setState({
        user: makeUser({ id: '1', email: 'free@example.com', name: 'Free User', role: 'free' }),
        isAuthenticated: true,
      });

      renderHook(() => useRequireRole('premium', '/pricing'));

      expect(mockNavigate).toHaveBeenCalledWith('/pricing', { replace: true });
    });

    it('should redirect (not crash) when authenticated but user is null (divergent store state)', () => {
      // isAuthenticated:true with user:null shouldn't normally happen, but the
      // hook must not throw on it - hasAccess should fall through to false
      // via the null?.role optional chain rather than reading a role off null.
      useAuthStore.setState({
        user: null,
        isAuthenticated: true,
      });

      renderHook(() => useRequireRole('premium'));

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });

    it('should return hasAccess based on user role', () => {
      useAuthStore.setState({
        user: makeUser({
          id: '1',
          email: 'premium@example.com',
          name: 'Premium User',
          role: 'premium',
        }),
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useRequireRole('premium'));

      expect(result.current.hasAccess).toBe(true);
    });

    it('should return hasAccess false when user lacks role', () => {
      useAuthStore.setState({
        user: makeUser({ id: '1', email: 'free@example.com', name: 'Free User', role: 'free' }),
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useRequireRole('premium'));

      expect(result.current.hasAccess).toBe(false);
    });
  });
});
