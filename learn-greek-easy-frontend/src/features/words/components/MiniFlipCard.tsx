import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { CardMasteryItem, MasteryStatus } from '../hooks';

export interface MiniFlipCardProps {
  card: CardMasteryItem;
  onFlip?: (flipped: boolean) => void;
}

const MASTERY_DOT_COLOR: Record<MasteryStatus, string> = {
  none: 'bg-muted-foreground/30',
  studied: 'bg-blue-500',
  mastered: 'bg-green-500',
};

function extractCardContent(card: CardMasteryItem) {
  const front = card.front_content;
  const back = card.back_content;
  return {
    frontPrompt: (front.prompt as string) ?? '',
    frontMain: (front.main as string) ?? '',
    backAnswer: (back.answer as string) ?? '',
    backSub:
      (back.answer_sub as string) ?? (back.gender as string) ?? (back.answer_ru as string) ?? '',
  };
}

export function MiniFlipCard({ card, onFlip }: MiniFlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const { t } = useTranslation('deck');
  const { frontPrompt, frontMain, backAnswer, backSub } = extractCardContent(card);
  const dotColor = MASTERY_DOT_COLOR[card.mastery_status];

  const handleFlip = () => {
    const newFlipped = !flipped;
    setFlipped(newFlipped);
    onFlip?.(newFlipped);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFlip();
    }
  };

  return (
    <div
      data-testid={`mini-flip-card-${card.id}`}
      className="aspect-[4/3] cursor-pointer [perspective:600px]"
      onClick={handleFlip}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div
        className={`relative h-full w-full transition-transform duration-300 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}
      >
        {/* Front face */}
        <div className="absolute inset-0 flex flex-col justify-between rounded-lg border bg-card p-3 shadow-sm [backface-visibility:hidden]">
          <span className="line-clamp-1 text-[10px] text-muted-foreground">{frontPrompt}</span>
          <span className="line-clamp-2 text-center text-sm font-bold">{frontMain}</span>
          <div className="flex items-end justify-between">
            <span className="text-[10px] text-muted-foreground">
              {t(`wordReference.cardType.${card.card_type}`, { defaultValue: card.card_type })}
            </span>
            <div className={`h-2 w-2 rounded-full ${dotColor}`} />
          </div>
        </div>
        {/* Back face */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border bg-muted p-3 shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span className="line-clamp-2 text-center text-sm font-bold">{backAnswer}</span>
          {backSub && (
            <span className="mt-1 line-clamp-1 text-center text-xs text-muted-foreground">
              {backSub}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
