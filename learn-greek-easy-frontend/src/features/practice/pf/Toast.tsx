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

import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

// ── Interval formatter ────────────────────────────────────────────────────────

/**
 * Formats a whole-day SM-2 interval into a localized human-readable string.
 *
 * Resolves against the shared i18next singleton (same instance the app and the
 * test setup initialize), so the `(days)` signature stays unchanged for callers.
 * Components that render this (Toast, RatingRow) subscribe via useTranslation and
 * re-render on language change, which re-invokes this with the active language.
 * i18next picks the correct plural form per `count` (en: one/other, ru: one/few/many).
 *
 * Examples (en): 0 → "today", 1 → "1 day", 3 → "3 days",
 *                14 → "2 weeks", 30 → "1 month", 365 → "1 year"
 */
export function formatReviewInterval(days: number): string {
  const t = i18n.t.bind(i18n);
  if (days <= 0) return t('deck:practice.interval.today');
  if (days < 7) return t('deck:practice.interval.day', { count: days });
  if (days < 14) return t('deck:practice.interval.week', { count: 1 });
  if (days < 30) return t('deck:practice.interval.week', { count: Math.round(days / 7) });
  if (days < 365) return t('deck:practice.interval.month', { count: Math.round(days / 30) });
  return t('deck:practice.interval.year', { count: Math.round(days / 365) });
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
  const { t } = useTranslation('deck');
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
      aria-label={t('practice.nextReviewAria', { interval: intervalText })}
      data-testid="pf-toast"
    >
      <span className="pf-toast__label">{t('practice.nextIn')}</span>
      <span className="pf-toast__interval" data-testid="pf-toast-interval">
        {intervalText}
      </span>
    </div>
  );
}
