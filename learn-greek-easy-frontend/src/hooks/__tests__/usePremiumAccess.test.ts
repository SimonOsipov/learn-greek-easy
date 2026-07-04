/**
 * usePremiumAccess Hook Tests
 * Tests premium access detection based on user role
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { usePremiumAccess } from '@/hooks/usePremiumAccess';
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

describe('usePremiumAccess Hook', () => {
  beforeEach(() => {
    // Reset auth store
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('should return false when user is null', () => {
    const { result } = renderHook(() => usePremiumAccess());
    expect(result.current).toBe(false);
  });

  it('should return false for free users', () => {
    useAuthStore.setState({
      user: makeUser({ id: '1', email: 'free@example.com', name: 'Free User', role: 'free' }),
      isAuthenticated: true,
    });

    const { result } = renderHook(() => usePremiumAccess());
    expect(result.current).toBe(false);
  });

  it('should return true for premium users', () => {
    useAuthStore.setState({
      user: makeUser({
        id: '2',
        email: 'premium@example.com',
        name: 'Premium User',
        role: 'premium',
      }),
      isAuthenticated: true,
    });

    const { result } = renderHook(() => usePremiumAccess());
    expect(result.current).toBe(true);
  });

  it('should return true for admin users', () => {
    useAuthStore.setState({
      user: makeUser({ id: '3', email: 'admin@example.com', name: 'Admin User', role: 'admin' }),
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
      user: makeUser({
        id: '4',
        email: 'upgraded@example.com',
        name: 'Upgraded User',
        role: 'premium',
      }),
      isAuthenticated: true,
    });

    rerender();
    expect(result.current).toBe(true);

    // User downgrades to free
    useAuthStore.setState({
      user: makeUser({
        id: '4',
        email: 'upgraded@example.com',
        name: 'Upgraded User',
        role: 'free',
      }),
      isAuthenticated: true,
    });

    rerender();
    expect(result.current).toBe(false);
  });
});
