import { useTranslation } from 'react-i18next';

import { useReviewStore } from '@/stores/reviewStore';

export function ProgressHeader() {
  const { t } = useTranslation('review');
  const { progress, sessionStats } = useReviewStore();
  const { current, total } = progress;
  const percentage = total > 0 ? (current / total) * 100 : 0;

  // Calculate estimated time remaining
  const avgTimePerCard = sessionStats.averageTime || 30; // 30s default
  const cardsRemaining = sessionStats.cardsRemaining;
  const minutesRemaining = Math.ceil((cardsRemaining * avgTimePerCard) / 60);

  return (
    <div className="border-b border-border bg-muted/50 px-6 py-4">
      {/* Progress bar */}
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-gradient-from to-gradient-to transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Progress text */}
      <div className="text-center text-sm text-muted-foreground">
        {t('session.cardOf', { current: current + 1, total })} •{' '}
        {t('session.minRemaining', { minutes: minutesRemaining })}
      </div>
    </div>
  );
}
