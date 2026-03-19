import React from 'react';

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDeckBackgroundStyle } from '@/lib/deckBackground';
import type { Deck } from '@/types/dashboard';

interface DeckCardProps {
  deck: Deck;
  onContinue?: () => void;
}

const statusVariants = {
  'in-progress':
    'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50',
  completed:
    'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50',
  'not-started': 'bg-muted text-muted-foreground hover:bg-muted/80',
};

export const DeckCard = React.memo<DeckCardProps>(({ deck, onContinue }) => {
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
    <Card
      className="group transition-all hover:border-primary"
      style={getDeckBackgroundStyle(deck.coverImageUrl)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{deck.title}</CardTitle>
            <CardDescription className="text-foreground">{deck.description}</CardDescription>
          </div>
          <Badge
            className={`${statusVariants[deck.status ?? 'not-started']} flex-shrink-0 whitespace-nowrap`}
          >
            {getStatusLabel(deck.status ?? 'not-started')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Button */}
        <Button
          variant="outline"
          className="px-6 transition-colors group-hover:bg-primary group-hover:text-white"
          onClick={onContinue}
        >
          {(deck.status ?? 'not-started') === 'not-started'
            ? t('card.actions.startLearning')
            : t('card.actions.continueLearning')}
        </Button>
      </CardContent>
    </Card>
  );
});

DeckCard.displayName = 'DeckCard';
