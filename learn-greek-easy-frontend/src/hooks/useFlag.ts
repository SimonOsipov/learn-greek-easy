import { useEffect, useState } from 'react';

import posthog from 'posthog-js';

import { type FlagKey, flagDefault, isFlagLiveEnv } from '@/lib/flags';

function resolveBool(flag: FlagKey): boolean {
  if (isFlagLiveEnv()) {
    const v =
      typeof posthog?.isFeatureEnabled === 'function' ? posthog.isFeatureEnabled(flag) : undefined;
    return v ?? flagDefault(flag); // fold undefined → default (no flicker)
  }
  // non-live (development/test): test-only override seam, else static default. PostHog never touched.
  const override = typeof window !== 'undefined' ? window.__FF_OVERRIDES__?.[flag] : undefined;
  return override ?? flagDefault(flag);
}

export function useFlag(flag: FlagKey): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => resolveBool(flag));
  useEffect(() => {
    setEnabled(resolveBool(flag));
    if (!isFlagLiveEnv()) return;
    if (typeof posthog?.onFeatureFlags !== 'function') return;
    return posthog.onFeatureFlags(() => setEnabled(resolveBool(flag))); // returns ()=>void unsub
  }, [flag]);
  return enabled;
}

// Siblings for future use — same live-env gate; not consumed by this story.
export function useFlagVariant(flag: FlagKey): string | boolean | undefined {
  const read = (): string | boolean | undefined => {
    if (isFlagLiveEnv()) {
      return typeof posthog?.getFeatureFlag === 'function'
        ? posthog.getFeatureFlag(flag)
        : undefined;
    }
    return typeof window !== 'undefined' ? window.__FF_OVERRIDES__?.[flag] : undefined;
  };
  const [variant, setVariant] = useState<string | boolean | undefined>(read);
  useEffect(() => {
    setVariant(read());
    if (!isFlagLiveEnv()) return;
    if (typeof posthog?.onFeatureFlags !== 'function') return;
    return posthog.onFeatureFlags(() => setVariant(read()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag]);
  return variant;
}

export function useFlagPayload<T = unknown>(flag: FlagKey): T | undefined {
  const read = (): T | undefined => {
    if (isFlagLiveEnv() && typeof posthog?.getFeatureFlagPayload === 'function') {
      return posthog.getFeatureFlagPayload(flag) as T | undefined;
    }
    return undefined;
  };
  const [payload, setPayload] = useState<T | undefined>(read);
  useEffect(() => {
    setPayload(read());
    if (!isFlagLiveEnv()) return;
    if (typeof posthog?.onFeatureFlags !== 'function') return;
    return posthog.onFeatureFlags(() => setPayload(read()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag]);
  return payload;
}
