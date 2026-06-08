/**
 * useFlag Hook Tests
 *
 * Covers: dev/test static paths, window.__FF_OVERRIDES__ seam,
 * production PostHog path, and onFeatureFlags re-render.
 */

import { act, renderHook } from '@testing-library/react';
import posthog, { type FeatureFlagsCallback } from 'posthog-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FLAGS } from '@/lib/flags';

import { useFlag } from '../useFlag';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clean up the override seam between tests. */
function deleteOverride() {
  if (typeof window !== 'undefined') {
    delete window.__FF_OVERRIDES__;
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteOverride();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    deleteOverride();
  });

  // -------------------------------------------------------------------------
  // Development path
  // -------------------------------------------------------------------------

  describe('development environment', () => {
    it('returns true for collocations flag (dev default is ON)', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'development');

      const { result } = renderHook(() => useFlag(FLAGS.collocations));

      expect(result.current).toBe(true);
    });

    it('does NOT call posthog.isFeatureEnabled in dev', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'development');

      renderHook(() => useFlag(FLAGS.collocations));

      expect(vi.mocked(posthog.isFeatureEnabled)).not.toHaveBeenCalled();
    });

    it('does NOT call posthog.onFeatureFlags in dev', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'development');

      renderHook(() => useFlag(FLAGS.collocations));

      expect(vi.mocked(posthog.onFeatureFlags)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Test environment path
  // -------------------------------------------------------------------------

  describe('test environment', () => {
    it('returns false for collocations flag (test default is OFF)', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'test');

      const { result } = renderHook(() => useFlag(FLAGS.collocations));

      expect(result.current).toBe(false);
    });

    it('does NOT call posthog.isFeatureEnabled in test env', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'test');

      renderHook(() => useFlag(FLAGS.collocations));

      expect(vi.mocked(posthog.isFeatureEnabled)).not.toHaveBeenCalled();
    });

    it('does NOT call posthog.onFeatureFlags in test env', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'test');

      renderHook(() => useFlag(FLAGS.collocations));

      expect(vi.mocked(posthog.onFeatureFlags)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Override seam (non-live environments)
  // -------------------------------------------------------------------------

  describe('window.__FF_OVERRIDES__ seam (non-live)', () => {
    it('forces flag ON when override is set to true in test env', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'test');
      window.__FF_OVERRIDES__ = { 'collocations-enabled': true };

      const { result } = renderHook(() => useFlag(FLAGS.collocations));

      expect(result.current).toBe(true);
    });

    it('forces flag ON when override is set to true in dev env', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'development');
      window.__FF_OVERRIDES__ = { 'collocations-enabled': true };

      const { result } = renderHook(() => useFlag(FLAGS.collocations));

      expect(result.current).toBe(true);
    });

    it('returns flagDefault on a fresh render after override key is deleted', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'test');

      // First render: with override ON
      window.__FF_OVERRIDES__ = { 'collocations-enabled': true };
      const { result: resultOn } = renderHook(() => useFlag(FLAGS.collocations));
      expect(resultOn.current).toBe(true);

      // Second render (new hook instance): override removed → falls back to flagDefault
      delete window.__FF_OVERRIDES__;
      const { result: resultOff } = renderHook(() => useFlag(FLAGS.collocations));
      expect(resultOff.current).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Production path — PostHog drives the value
  // -------------------------------------------------------------------------

  describe('production environment', () => {
    it('returns true when posthog.isFeatureEnabled returns true', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'production');
      vi.mocked(posthog.isFeatureEnabled).mockReturnValue(true);

      const { result } = renderHook(() => useFlag(FLAGS.collocations));

      expect(result.current).toBe(true);
    });

    it('returns false when posthog.isFeatureEnabled returns false', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'production');
      vi.mocked(posthog.isFeatureEnabled).mockReturnValue(false);

      const { result } = renderHook(() => useFlag(FLAGS.collocations));

      expect(result.current).toBe(false);
    });

    it('folds undefined from posthog to flagDefault (false for collocations in prod)', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'production');
      vi.mocked(posthog.isFeatureEnabled).mockReturnValue(undefined);

      const { result } = renderHook(() => useFlag(FLAGS.collocations));

      expect(result.current).toBe(false);
    });

    it('ignores window.__FF_OVERRIDES__ in production', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'production');
      // Override says true, but PostHog says false — production must NOT read the override
      window.__FF_OVERRIDES__ = { 'collocations-enabled': true };
      vi.mocked(posthog.isFeatureEnabled).mockReturnValue(false);

      const { result } = renderHook(() => useFlag(FLAGS.collocations));

      // Production must honour PostHog, not the seam
      expect(result.current).toBe(false);
    });

    it('calls posthog.isFeatureEnabled in production', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'production');
      vi.mocked(posthog.isFeatureEnabled).mockReturnValue(false);

      renderHook(() => useFlag(FLAGS.collocations));

      expect(vi.mocked(posthog.isFeatureEnabled)).toHaveBeenCalledWith('collocations-enabled');
    });

    it('registers posthog.onFeatureFlags callback in production', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'production');
      vi.mocked(posthog.isFeatureEnabled).mockReturnValue(false);

      renderHook(() => useFlag(FLAGS.collocations));

      expect(vi.mocked(posthog.onFeatureFlags)).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // onFeatureFlags re-render in production
  // -------------------------------------------------------------------------

  describe('onFeatureFlags re-render (production)', () => {
    it('re-renders with new value when onFeatureFlags callback fires', () => {
      vi.stubEnv('VITE_ENVIRONMENT', 'production');

      // Capture the callback passed to onFeatureFlags
      let capturedCallback: FeatureFlagsCallback | null = null;
      vi.mocked(posthog.onFeatureFlags).mockImplementation((cb) => {
        capturedCallback = cb;
        return () => {}; // unsubscribe no-op
      });

      // Initial value: false
      vi.mocked(posthog.isFeatureEnabled).mockReturnValue(false);

      const { result } = renderHook(() => useFlag(FLAGS.collocations));
      expect(result.current).toBe(false);

      // PostHog now returns true
      vi.mocked(posthog.isFeatureEnabled).mockReturnValue(true);

      // Fire the callback so the hook re-evaluates
      act(() => {
        capturedCallback!([], {});
      });

      expect(result.current).toBe(true);
    });
  });
});
