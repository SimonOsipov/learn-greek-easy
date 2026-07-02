// src/components/dashboard/DashboardGreeting.tsx
// Greeting bar + week heat strip (DASH2-01-02).
// No CEFR chip. No CTA button inside this component.

import { Trans, useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import { UnwiredDot, rollingDayLabels } from '@/features/decks/dx';
import type { DashboardWeekHeat } from '@/types/dashboard';

export interface DashboardGreetingProps {
  userName: string;
  /** Cards due today from summary.today.cards_due */
  cardsDue: number;
  /** Number of decks that have due cards today */
  deckCount: number;
  /** Minutes studied today (round(study_time_seconds/60)) — real data */
  minutesToday: number;
  /**
   * Week-heat strip data from summary.week_heat (PERF-15) — bucketing is
   * computed server-side now; this component only renders it. Undefined
   * while the summary is still loading (heat strip renders hidden).
   */
  weekHeat?: DashboardWeekHeat;
  /**
   * True while the summary is still loading. Suppresses the subtitle (renders a
   * skeleton instead) so the zero-due "nothingDue" onboarding copy never flashes
   * before the real `cardsDue` arrives — `cardsDue` defaults to 0 during load,
   * which would otherwise show "Welcome aboard…" on every refresh.
   */
  isLoading?: boolean;
}

export function DashboardGreeting({
  userName,
  cardsDue,
  deckCount,
  minutesToday,
  weekHeat,
  isLoading = false,
}: DashboardGreetingProps) {
  const { t } = useTranslation('common');

  const heat = weekHeat?.heat ?? [];
  const todayIdx = weekHeat?.today_idx ?? 6;
  const hasHeat = heat.some((h) => h > 0);

  // Weekday initials for the rolling window (UTC), oldest first
  const dayInitials = rollingDayLabels();

  return (
    <div className="db-greeting">
      <div className="db-greeting-l">
        <h1 className="db-hello" data-testid="dashboard-title">
          <span lang="el">{t('welcome.helloGreek')}</span>
          <span className="db-hello-en"> {userName}</span>
          <span className="db-hello-wave">👋</span>
        </h1>

        {isLoading ? (
          <Skeleton className="h-5 w-80 max-w-full rounded" data-testid="greeting-sub-skeleton" />
        ) : cardsDue > 0 ? (
          <p className="db-hello-sub">
            <Trans
              i18nKey="welcome.dueAcrossDecks"
              ns="common"
              values={{ count: cardsDue, decks: deckCount }}
              components={{ count: <b />, decks: <b /> }}
            />{' '}
            <Trans
              i18nKey="welcome.minutesGoalLine"
              ns="common"
              values={{ current: minutesToday }}
              components={{
                goal: <UnwiredDot tone="danger" aria-label={t('welcome.minuteGoalUnwiredAria')} />,
                current: <b />,
              }}
            />
          </p>
        ) : (
          <p className="db-hello-sub">{t('welcome.nothingDue')}</p>
        )}

        {hasHeat && (
          <div className="db-week">
            <span className="db-week-l">{t('welcome.thisWeek')}</span>
            {heat.map((h, i) => (
              <span
                key={i}
                className={['db-week-cell', i === todayIdx ? 'db-week-today' : '']
                  .filter(Boolean)
                  .join(' ')}
                data-h={h}
                title={t('welcome.heatReviews', { count: h })}
                aria-label={`${dayInitials[i] ?? ''}: ${t('welcome.heatReviews', {
                  count: h,
                })}${i === todayIdx ? ' (today)' : ''}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
