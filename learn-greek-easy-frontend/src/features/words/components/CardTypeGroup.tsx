import { useTranslation } from 'react-i18next';

import { CardItem } from './CardItem';

import type { CardGroupKey, GroupedCards } from './cardGrouping';
import type { CardMasteryItem } from '../hooks';

export interface CardTypeGroupProps {
  groupKey: CardGroupKey;
  i18nKey: string;
  cards: CardMasteryItem[];
  masteredCount: number;
  totalCount: number;
  wordEntryId: string;
  deckId: string;
}

export function CardTypeGroup({
  groupKey,
  i18nKey,
  cards,
  masteredCount,
  totalCount,
  wordEntryId,
  deckId,
}: CardTypeGroupProps) {
  const { t } = useTranslation('deck');

  return (
    <div
      className="space-y-3 rounded-lg border bg-card p-4 shadow-sm"
      data-testid={`card-group-${groupKey}`}
    >
      <div
        className="flex items-center justify-between"
        data-testid={`card-group-header-${groupKey}`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(`wordReference.${i18nKey}`)}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('wordReference.groupMastered', { mastered: masteredCount, total: totalCount })}
        </span>
      </div>
      <div className="divide-y divide-border rounded-md border">
        {cards.map((card, idx) => (
          <CardItem
            key={`${card.card_type}-${idx}`}
            card={card}
            index={idx}
            wordEntryId={wordEntryId}
            deckId={deckId}
          />
        ))}
      </div>
    </div>
  );
}

// Re-export GroupedCards for convenience
export type { GroupedCards };
