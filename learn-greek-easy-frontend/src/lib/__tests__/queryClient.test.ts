/**
 * PERF-08: queryClient configuration tests.
 *
 * Guards against re-enabling refetchOnWindowFocus globally, which was the
 * root cause of 12 679 / 9 846 per-focus DB calls driving 7 GB egress.
 */

import { describe, it, expect } from 'vitest';

import { queryClient } from '../queryClient';

describe('queryClient – PERF-08 egress guards', () => {
  const defaults = queryClient.getDefaultOptions().queries ?? {};

  it('refetchOnWindowFocus is false (PERF-08)', () => {
    expect(defaults.refetchOnWindowFocus).toBe(false);
  });

  it('staleTime is at least 5 minutes', () => {
    const staleTime = defaults.staleTime as number;
    expect(staleTime).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });

  it('refetchInterval is false (no polling)', () => {
    expect(defaults.refetchInterval).toBe(false);
  });
});
