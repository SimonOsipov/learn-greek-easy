/**
 * usePremiumAccess Hook Tests
 *
 * Tests premium access detection based on user role.
 *
 * Note: Tests work because authStore uses conditional persistence
 * (disabled in test environment via import.meta.env.MODE check).
 * See src/stores/authStore.ts for implementation details.
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { useAuthStore } from '@/stores/authStore';

describe('usePremiumAccess Hook', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Reset auth store (this triggers persist middleware)
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      token: null,
      refreshToken: null,
      isLoading: false,
      error: null,
      rememberMe: false,
    });
  });

  it('should return false when user is null', () => {
    const { result } = renderHook(() => usePremiumAccess());
    expect(result.current).toBe(false);
  });

  it('should return false for free users', () => {
    useAuthStore.setState({
      user: {
        id: '1',
        email: 'free@example.com',
        name: 'Free User',
        role: 'free',
        createdAt: new Date().toISOString(),
      },
      isAuthenticated: true,
    });

    const { result } = renderHook(() => usePremiumAccess());
    expect(result.current).toBe(false);
  });

  it('should return true for premium users', () => {
    useAuthStore.setState({
      user: {
        id: '2',
        email: 'premium@example.com',
        name: 'Premium User',
        role: 'premium',
        createdAt: new Date().toISOString(),
      },
      isAuthenticated: true,
    });

    const { result } = renderHook(() => usePremiumAccess());
    expect(result.current).toBe(true);
  });

  it('should return true for admin users', () => {
    useAuthStore.setState({
      user: {
        id: '3',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        createdAt: new Date().toISOString(),
      },
      isAuthenticated: true,
    });

    const { result } = renderHook(() => usePremiumAccess());
    expect(result.current).toBe(true);
  });

  it('should update when user role changes', () => {
    const { result, rerender } = renderHook(() => usePremiumAccess());

    // Initially no user
    expect(result.current).toBe(false);

    // User upgrades to premium
    useAuthStore.setState({
      user: {
        id: '4',
        email: 'upgraded@example.com',
        name: 'Upgraded User',
        role: 'premium',
        createdAt: new Date().toISOString(),
      },
      isAuthenticated: true,
    });

    rerender();
    expect(result.current).toBe(true);

    // User downgrades to free
    useAuthStore.setState({
      user: {
        id: '4',
        email: 'upgraded@example.com',
        name: 'Upgraded User',
        role: 'free',
        createdAt: new Date().toISOString(),
      },
      isAuthenticated: true,
    });

    rerender();
    expect(result.current).toBe(false);
  });
});
