/**
 * useDashboard Hook Tests
 * Tests dashboard data hook (placeholder implementation)
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { useDashboard } from '@/hooks/useDashboard';

describe('useDashboard Hook', () => {
  it('should return placeholder data structure', () => {
    const { result } = renderHook(() => useDashboard());

    expect(result.current).toHaveProperty('metrics');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
  });

  it('should return null metrics initially', () => {
    const { result } = renderHook(() => useDashboard());
    expect(result.current.metrics).toBeNull();
  });

  it('should not be loading initially', () => {
    const { result } = renderHook(() => useDashboard());
    expect(result.current.isLoading).toBe(false);
  });

  it('should have no error initially', () => {
    const { result } = renderHook(() => useDashboard());
    expect(result.current.error).toBeNull();
  });
});
