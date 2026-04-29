import React from 'react';

import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDeckBackgroundStyle } from '@/lib/deckBackground';
import type { Deck } from '@/types/dashboard';

interface DeckCardProps {
  deck: Deck;
  onContinue?: () => void;
}

const statusBadgeClass: Record<string, string> = {
  'in-progress': 'badge b-blue',
  completed: 'badge b-green',
  'not-started': 'badge b-gray',
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

  const status = deck.status ?? 'not-started';

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
          <span
            className={`${statusBadgeClass[status] ?? 'badge b-gray'} flex-shrink-0 whitespace-nowrap`}
          >
            {getStatusLabel(status)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Button */}
        <Button
          variant="secondary"
          className="px-6 transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
          onClick={onContinue}
        >
          {status === 'not-started'
            ? t('card.actions.startLearning')
            : t('card.actions.continueLearning')}
        </Button>
      </CardContent>
    </Card>
  );
});

DeckCard.displayName = 'DeckCard';
