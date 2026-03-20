import { useEffect, useRef } from 'react';

import posthog from 'posthog-js';

export interface UsePracticeSessionOptions {
  getStartProps: () => Record<string, unknown> | null;
  getCompleteProps: (durationSec: number) => Record<string, unknown> | null;
  getAbandonProps: (durationSec: number) => Record<string, unknown> | null;
  startEvent: string;
  completeEvent: string;
  abandonEvent: string;
  isSessionActive: boolean;
  isSessionComplete: boolean;
  fallbackDurationSec?: number;
  onCompleteTracked?: () => void;
}

export interface UsePracticeSessionReturn {
  sessionStartTimeRef: React.MutableRefObject<number | null>;
  resetTracking: () => void;
}

/**
 * Manages session lifecycle PostHog tracking with start, complete, and abandon events.
 *
 * Handles:
 * - Session start tracking (when isSessionActive becomes true)
 * - Session complete tracking (when isSessionComplete becomes true)
 * - Session abandon tracking (beforeunload event)
 * - Deduplication via refs (no double-tracking on re-renders)
 */
export function usePracticeSession(options: UsePracticeSessionOptions): UsePracticeSessionReturn {
  const {
    getStartProps,
    getCompleteProps,
    getAbandonProps,
    startEvent,
    completeEvent,
    abandonEvent,
    isSessionActive,
    isSessionComplete,
    fallbackDurationSec,
    onCompleteTracked,
  } = options;

  const sessionStartTimeRef = useRef<number | null>(null);
  const hasTrackedStartRef = useRef(false);
  const hasTrackedCompleteRef = useRef(false);

  // Track session start
  useEffect(() => {
    if (isSessionActive && !hasTrackedStartRef.current) {
      hasTrackedStartRef.current = true;
      sessionStartTimeRef.current = Date.now();
      const props = getStartProps();
      if (props !== null) {
        try {
          posthog.capture(startEvent, props);
        } catch {
          // Silent failure
        }
      }
    }
  }, [isSessionActive, getStartProps, startEvent]);

  // Track session complete
  useEffect(() => {
    if (isSessionComplete && !hasTrackedCompleteRef.current) {
      hasTrackedCompleteRef.current = true;
      const durationSec = sessionStartTimeRef.current
        ? Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
        : (fallbackDurationSec ?? 0);
      const props = getCompleteProps(durationSec);
      if (props !== null) {
        try {
          posthog.capture(completeEvent, props);
        } catch {
          // Silent failure
        }
      }
      onCompleteTracked?.();
    }
  }, [isSessionComplete, getCompleteProps, completeEvent, fallbackDurationSec, onCompleteTracked]);

  // Track session abandoned on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const durationSec = sessionStartTimeRef.current
        ? Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
        : (fallbackDurationSec ?? 0);
      const props = getAbandonProps(durationSec);
      if (props !== null) {
        try {
          posthog.capture(abandonEvent, props);
        } catch {
          // Silent failure
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [getAbandonProps, abandonEvent, fallbackDurationSec]);

  const resetTracking = () => {
    sessionStartTimeRef.current = null;
    hasTrackedStartRef.current = false;
    hasTrackedCompleteRef.current = false;
  };

  return { sessionStartTimeRef, resetTracking };
}
