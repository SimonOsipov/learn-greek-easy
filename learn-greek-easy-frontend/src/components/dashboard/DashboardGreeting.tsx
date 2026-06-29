// src/components/dashboard/DashboardGreeting.tsx
// Greeting bar + week heat strip (DASH2-01-02).
// No CEFR chip. No CTA button inside this component.

import { Trans, useTranslation } from 'react-i18next';

import { UnwiredDot, rollingDayLabels } from '@/features/decks/dx';
import type { AnalyticsActivityItem } from '@/types/analytics';

import { buildWeekHeat } from './lib/weekHeat';

export interface DashboardGreetingProps {
  userName: string;
  /** Cards due today from analytics.today.cardsDue */
  cardsDue: number;
  /** Number of decks that have due cards today */
  deckCount: number;
  /** Minutes studied today (round(studyTimeSeconds/60)) — real data */
  minutesToday: number;
  /** Recent activity entries from analyticsData.recentActivity */
  recentActivity: AnalyticsActivityItem[];
}

export function DashboardGreeting({
  userName,
  cardsDue,
  deckCount,
  minutesToday,
  recentActivity,
}: DashboardGreetingProps) {
  const { t } = useTranslation('common');

  // Map AnalyticsActivityItem[] → the shape buildWeekHeat expects
  const activityForHeat = recentActivity.map((a) => ({
    timestamp: a.timestamp instanceof Date ? a.timestamp.toISOString() : String(a.timestamp),
    cardsReviewed: a.cardsReviewed ?? 0,
  }));

  const { heat, todayIdx } = buildWeekHeat(activityForHeat);
  const hasHeat = heat.some((h) => h > 0);

  // Weekday initials for the rolling window (UTC), oldest first
  const dayInitials = rollingDayLabels();

  return (
    <div className="db-greeting">
      <div className="db-greeting-l">
        <h1 className="db-hello">
          <span lang="el">{t('welcome.helloGreek')}</span>
          <span className="db-hello-en"> {userName}</span>
          <span className="db-hello-wave">👋</span>
        </h1>

        {cardsDue > 0 ? (
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
