import React from 'react';

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { Deck } from '@/types/dashboard';

interface DeckCardProps {
  deck: Deck;
  onContinue?: () => void;
}

const statusVariants = {
  'in-progress': 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  completed: 'bg-green-100 text-green-700 hover:bg-green-200',
  'not-started': 'bg-gray-100 text-gray-700 hover:bg-gray-200',
};

export const DeckCard: React.FC<DeckCardProps> = ({ deck, onContinue }) => {
  const { t } = useTranslation('deck');

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in-progress':
        return t('card.status.inProgress');
      case 'completed':
        return t('card.status.completed');
      default:
        return t('card.status.notStarted');
    }
  };

  return (
    <Card className="group transition-all hover:border-primary">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{deck.title}</CardTitle>
            <CardDescription className="text-text-muted">{deck.description}</CardDescription>
          </div>
          <Badge className={statusVariants[deck.status ?? 'not-started']}>
            {getStatusLabel(deck.status ?? 'not-started')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Section */}
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-text-muted">
              {t('card.progress', { current: deck.progress.current, total: deck.progress.total })}
            </span>
            <span className="font-medium">{deck.progress.percentage}%</span>
          </div>
          <Progress
            value={deck.progress.percentage}
            className="h-2"
            aria-label={`${deck.title} progress: ${deck.progress.percentage}% complete`}
          />
        </div>

        {/* Stats Row */}
        <div className="flex gap-4 text-sm text-text-muted">
          <span className="flex items-center gap-1">
            <span className="text-base">📚</span> {t('card.stats.due', { count: deck.stats.due })}
          </span>
          <span className="flex items-center gap-1">
            <span className="text-base">✅</span>{' '}
            {t('card.stats.mastered', { count: deck.stats.mastered })}
          </span>
          <span className="flex items-center gap-1">
            <span className="text-base">📝</span>{' '}
            {t('card.stats.learning', { count: deck.stats.learning })}
          </span>
        </div>

        {/* Action Button */}
        <Button
          variant="outline"
          className="w-full transition-colors group-hover:bg-primary group-hover:text-white"
          onClick={onContinue}
        >
          {(deck.status ?? 'not-started') === 'not-started'
            ? t('card.actions.startLearning')
            : t('card.actions.continueLearning')}
        </Button>
      </CardContent>
    </Card>
  );
};
