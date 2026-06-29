// src/components/dashboard/MetricStrip.tsx
//
// DASH2-01-04 — 4-up metric strip for the user dashboard.
//
// Mirrors DxMetricStrip / CultureMetricStrip layout but uses the .db-*
// class family (authored in index.css under DASH2-01-04).
//
// Props are flat primitive values; all formatting happens here.
// Trend lines that are not yet wired to backend data use <UnwiredDot>.

import { Check, Clock, Flame, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { UnwiredDot } from '@/features/decks/dx';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricStripProps {
  /** SRS cards due today — from today.cardsDue (NOT learning+review). */
  dueToday: number;
  /** User's current consecutive-day streak. */
  currentStreak: number;
  /** All-time longest streak (used in the streak trend line). */
  longestStreak: number;
  /** Mastered word count (from masteredCount(wordStatus)). */
  mastered: number;
  /** Pre-formatted all-time study time string (e.g. "4h 30m"). */
  allTimeLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MetricStrip({
  dueToday,
  currentStreak,
  longestStreak,
  mastered,
  allTimeLabel,
}: MetricStripProps) {
  const { t } = useTranslation('common');

  return (
    <section className="db-metrics" data-testid="metric-strip">
      {/* 1. Due today — primary */}
      <div className="db-metric" data-tone="primary" data-testid="db-metric-due">
        <div className="db-metric-icon">
          <Layers />
        </div>
        <div className="db-metric-body">
          <div className="db-metric-l">{t('dashboard.metrics.dueToday')}</div>
          <div className="db-metric-v" data-testid="db-metric-due-value">
            {dueToday}
          </div>
          <div className="db-metric-trend is-flat">
            <UnwiredDot tone="danger" aria-label={t('dashboard.metrics.trendSinceYesterdayAria')}>
              {t('dashboard.metrics.trendSinceYesterday')}
            </UnwiredDot>
          </div>
        </div>
      </div>

      {/* 2. Current streak — amber */}
      <div className="db-metric" data-tone="amber" data-testid="db-metric-streak">
        <div className="db-metric-icon">
          <Flame />
        </div>
        <div className="db-metric-body">
          <div className="db-metric-l">{t('dashboard.metrics.currentStreak')}</div>
          <div className="db-metric-v" data-testid="db-metric-streak-value">
            {currentStreak}
            <small>{t('dashboard.metrics.days')}</small>
          </div>
          {currentStreak > 0 ? (
            <div className="db-metric-trend">
              {t('dashboard.metrics.trendBestStreak', { count: longestStreak })}
            </div>
          ) : (
            <div className="db-metric-trend is-flat">{t('dashboard.metrics.trendStartStreak')}</div>
          )}
        </div>
      </div>

      {/* 3. Mastered — green */}
      <div className="db-metric" data-tone="green" data-testid="db-metric-mastered">
        <div className="db-metric-icon">
          <Check />
        </div>
        <div className="db-metric-body">
          <div className="db-metric-l">{t('dashboard.metrics.mastered')}</div>
          <div className="db-metric-v" data-testid="db-metric-mastered-value">
            {mastered}
            <small>{t('dashboard.metrics.wordsUnit')}</small>
          </div>
          <div className="db-metric-trend is-flat">
            <UnwiredDot tone="danger" aria-label={t('dashboard.metrics.trendGoalAria')}>
              {t('dashboard.metrics.trendGoal')}
            </UnwiredDot>
          </div>
        </div>
      </div>

      {/* 4. All-time — violet */}
      <div className="db-metric" data-tone="violet" data-testid="db-metric-alltime">
        <div className="db-metric-icon">
          <Clock />
        </div>
        <div className="db-metric-body">
          <div className="db-metric-l">{t('dashboard.metrics.allTimeLabel')}</div>
          <div className="db-metric-v" data-testid="db-metric-alltime-value">
            {allTimeLabel}
          </div>
          <div className="db-metric-trend is-flat">
            <UnwiredDot tone="danger" aria-label={t('dashboard.metrics.trendNewTodayAria')}>
              {t('dashboard.metrics.trendNewToday')}
            </UnwiredDot>
          </div>
        </div>
      </div>
    </section>
  );
}
