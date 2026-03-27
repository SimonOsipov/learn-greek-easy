import { useTranslation } from 'react-i18next';

import { Progress } from '@/components/ui/progress';

export interface CardsSummaryBarProps {
  mastered: number;
  total: number;
}

export function CardsSummaryBar({ mastered, total }: CardsSummaryBarProps) {
  const { t } = useTranslation('deck');
  const progressValue = total > 0 ? (mastered / total) * 100 : 0;

  return (
    <div className="space-y-2 p-4" data-testid="cards-summary-bar">
      <p className="text-sm text-muted-foreground">
        {t('wordReference.cardsMasterySummary', { mastered, total })}
      </p>
      <Progress value={progressValue} className="h-2 [&>div]:bg-green-500" />
    </div>
  );
}
