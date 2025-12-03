/**
 * useDecks Hook Tests
 * Tests deck management hook (placeholder implementation)
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { useDecks } from '@/hooks/useDecks';

describe('useDecks Hook', () => {
  it('should return placeholder data structure', () => {
    const { result } = renderHook(() => useDecks());

    expect(result.current).toHaveProperty('decks');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
  });

  it('should return empty decks array initially', () => {
    const { result } = renderHook(() => useDecks());
    expect(result.current.decks).toEqual([]);
    expect(Array.isArray(result.current.decks)).toBe(true);
  });

  it('should not be loading initially', () => {
    const { result } = renderHook(() => useDecks());
    expect(result.current.isLoading).toBe(false);
  });

  it('should have no error initially', () => {
    const { result } = renderHook(() => useDecks());
    expect(result.current.error).toBeNull();
  });
});
