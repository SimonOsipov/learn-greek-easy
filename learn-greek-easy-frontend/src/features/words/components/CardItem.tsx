import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { MasteryDots } from '@/components/shared/MasteryDots';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { trackWordReferenceCardExpanded } from '@/lib/analytics';

import type { CardMasteryItem, MasteryStatus } from '../hooks';

export interface CardItemProps {
  card: CardMasteryItem;
  index: number;
  wordEntryId: string;
  deckId: string;
}

function getMasteryFilled(status: MasteryStatus): number {
  if (status === 'mastered') return 4;
  if (status === 'studied') return 2;
  return 0;
}

function extractFrontPreview(frontContent: Record<string, unknown>): string {
  const priorityKeys = ['prompt', 'question', 'greek', 'word', 'sentence', 'text'];
  for (const key of priorityKeys) {
    const val = frontContent[key];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  // Fallback: first string value
  for (const val of Object.values(frontContent)) {
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return '';
}

export function CardItem({ card, index, wordEntryId, deckId }: CardItemProps) {
  const { t } = useTranslation('deck');
  const [isOpen, setIsOpen] = useState(false);
  const filled = getMasteryFilled(card.mastery_status);
  const preview = extractFrontPreview(card.front_content);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          trackWordReferenceCardExpanded({
            card_type: card.card_type,
            word_entry_id: wordEntryId,
            deck_id: deckId,
          });
        }
        setIsOpen(open);
      }}
      data-testid={`card-item-${card.card_type}-${index}`}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md p-3 text-left transition-colors hover:bg-muted/50">
        <span className="text-sm font-medium">
          {t(`wordReference.cardType.${card.card_type}`, { defaultValue: card.card_type })}
        </span>
        <MasteryDots filled={filled} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {preview && <div className="px-3 pb-3 pt-1 text-sm text-muted-foreground">{preview}</div>}
      </CollapsibleContent>
    </Collapsible>
  );
}
