import { useTranslation } from 'react-i18next';

import { Progress } from '@/components/ui/progress';
import { useReviewStore } from '@/stores/reviewStore';

export function ProgressHeader() {
  const { t } = useTranslation('review');
  const { progress } = useReviewStore();
  const { current, total } = progress;
  const percentage = total > 0 ? (current / total) * 100 : 0;

  // Time fields removed from SessionStats - this component will be deleted in GRAMREF-05
  const cardsRemaining = Math.max(0, total - current);
  const minutesRemaining = Math.ceil((cardsRemaining * 30) / 60); // 30s default per card

  return (
    <div className="border-b border-border bg-muted/50 px-6 py-4">
      {/* Progress bar */}
      <Progress
        value={percentage}
        className="mb-2 h-2 bg-muted [&>div]:bg-gradient-to-r [&>div]:from-gradient-from [&>div]:to-gradient-to"
        aria-label={t('session.cardOf', { current: current + 1, total })}
      />

      {/* Progress text */}
      <div className="text-center text-sm text-muted-foreground">
        {t('session.cardOf', { current: current + 1, total })} •{' '}
        {t('session.minRemaining', { minutes: minutesRemaining })}
      </div>
    </div>
  );
}
