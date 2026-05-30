// src/features/practice/pf/Toast.tsx
//
// "Next in {interval}" pill that appears after a card is rated.
//
// The interval comes from ReviewResult.interval (whole days from SM-2).
// NEVER uses hardcoded placeholder copy ("1m", "6m", "1d", "4d") — always
// derives from the real next_review_date / interval returned by the API.
//
// Auto-dismiss after 3 seconds (configurable). Honours prefers-reduced-motion
// (collapse/expand animation is handled in PRACT2-1-10; here we focus on the
// enter/exit keyframe defined in pf.css).

import { useEffect, useState } from 'react';

// ── Interval formatter ────────────────────────────────────────────────────────

/**
 * Formats a whole-day SM-2 interval into a human-readable string.
 * No existing util for this — added here as specified (task implementation plan step 3).
 *
 * Examples: 0 → "today", 1 → "1 day", 3 → "3 days",
 *           14 → "2 weeks", 30 → "1 month", 365 → "1 year"
 */
export function formatReviewInterval(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 14) return '1 week';
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? '1 month' : `${months} months`;
  }
  const years = Math.round(days / 365);
  return years === 1 ? '1 year' : `${years} years`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ToastProps {
  /** The whole-day SM-2 interval from ReviewResult.interval. */
  interval: number;
  /** Auto-dismiss after this many milliseconds. Defaults to 3000. */
  autoDismissMs?: number;
  /** Called when the toast dismisses itself. */
  onDismiss?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Toast — "next in {interval}" pill shown after a card is rated.
 *
 * Populated from the real ReviewResult.interval (SM-2 whole days).
 * Auto-dismisses after autoDismissMs (default 3s).
 */
export function Toast({ interval, autoDismissMs = 3000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [visible, autoDismissMs, onDismiss]);

  if (!visible) return null;

  const intervalText = formatReviewInterval(interval);

  return (
    <div
      className="pf-toast"
      role="status"
      aria-live="polite"
      aria-label={`Next review in ${intervalText}`}
      data-testid="pf-toast"
    >
      <span className="pf-toast__label">next in</span>
      <span className="pf-toast__interval" data-testid="pf-toast-interval">
        {intervalText}
      </span>
    </div>
  );
}
