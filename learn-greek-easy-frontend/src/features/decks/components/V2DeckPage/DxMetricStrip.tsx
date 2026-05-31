// src/features/decks/components/V2DeckPage/DxMetricStrip.tsx
//
// DX-06 — Metric strip: Due today / Streak (deck) / Mastered / Time on deck
//
// Consumes ProgressMetrics + DeckStatistics from V2DeckHeader deckProgress query.
// Streak and WeekHeat data are placeholder (no per-deck backend yet) — UnwiredDots.

import { Check, Clock, Flame, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { DeckStatistics, ProgressMetrics } from '@/services/progressAPI';

import { WeekHeat } from '../../dx';

import type { deriveWordProgress } from '../../dx';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Mon=0 … Sun=6 — matches WeekHeat DAY_LABELS index. */
function getTodayIdx(): number {
  // getDay() returns 0=Sun, 1=Mon … 6=Sat
  // Remap to Mon=0 … Sun=6
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface DxMetricStripProps {
  progress: ProgressMetrics | undefined;
  statistics: DeckStatistics | undefined;
  wordProgress?: ReturnType<typeof deriveWordProgress> | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DxMetricStrip({ progress, statistics, wordProgress }: DxMetricStripProps) {
  const { t } = useTranslation('deck');

  const due = progress?.cards_due ?? 0;
  const timeMin = Math.round((statistics?.total_study_time_seconds ?? 0) / 60);
  const todayIdx = getTodayIdx();

  // Mastered card uses word-level counts when available
  const mastered = wordProgress?.masteredWords ?? 0;
  const total = wordProgress?.totalWords ?? 0;
  const pct = wordProgress?.progressPct ?? 0;

  return (
    <div className="dx-metrics" data-testid="dx-metric-strip">
      {/* Card 1: Due today (primary) */}
      <div className="dx-metric" data-tone="primary" data-testid="dx-metric-due">
        <div className="dx-metric-icon">
          <Layers />
        </div>
        <div className="dx-metric-body">
          <div className="dx-metric-l">{t('detail.metricDueToday')}</div>
          <div className="dx-metric-v" data-testid="dx-metric-due-value">
            {due}
          </div>
          <div
            className={['dx-metric-trend', due === 0 ? 'is-flat' : ''].filter(Boolean).join(' ')}
          >
            {due > 0 ? t('detail.metricDueTodayTrend') : t('detail.metricDueAllCaughtUp')}
          </div>
        </div>
      </div>

      {/* Card 2: Streak (amber) — placeholder, UnwiredDot R1 */}
      <div className="dx-metric" data-tone="amber" data-testid="dx-metric-streak">
        <div className="dx-metric-icon">
          <Flame />
        </div>
        <div className="dx-metric-body">
          <div className="dx-metric-l">{t('detail.metricStreakDeck')}</div>
          <div className="dx-metric-v" data-testid="dx-metric-streak-value">
            <span className="dx-stat-value">{statistics?.deck_streak_current ?? 0}</span>
            <small>{t('detail.metricStreakLabel')}</small>
          </div>
        </div>
      </div>

      {/* Card 3: Mastered (green) — word-level data */}
      <div className="dx-metric" data-tone="green" data-testid="dx-metric-mastered">
        <div className="dx-metric-icon">
          <Check />
        </div>
        <div className="dx-metric-body">
          <div className="dx-metric-l">{t('detail.metricMastered')}</div>
          <div className="dx-metric-v" data-testid="dx-metric-mastered-value">
            {t('detail.metricMasteredValue', { mastered, total })}
          </div>
          <div className="dx-metric-trend is-flat">{t('detail.metricPctOfDeck', { pct })}</div>
        </div>
      </div>

      {/* Card 4: Time on deck (violet) + WeekHeat (UnwiredDot R2) */}
      <div className="dx-metric" data-tone="violet" data-testid="dx-metric-time">
        <div className="dx-metric-icon">
          <Clock />
        </div>
        <div className="dx-metric-body">
          <div className="dx-metric-l">{t('detail.metricTimeOnDeck')}</div>
          <div className="dx-metric-v" data-testid="dx-metric-time-value">
            {timeMin}
            <small>{t('detail.metricTimeMin')}</small>
          </div>
          <WeekHeat
            heat={statistics?.weekly_activity ?? [0, 0, 0, 0, 0, 0, 0]}
            todayIdx={todayIdx}
            label={t('dx.weekHeatLabel')}
          />
        </div>
      </div>
    </div>
  );
}
