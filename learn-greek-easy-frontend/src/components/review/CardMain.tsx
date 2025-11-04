import type { CardReview } from '@/types/review';
import { GreekWord } from './shared/GreekWord';
import { Translation } from './shared/Translation';
import { WordTypeBadge } from './shared/WordTypeBadge';
import { LevelBadge } from './shared/LevelBadge';
import { KeyboardShortcutsTooltip } from './KeyboardShortcutsTooltip';

interface CardMainProps {
  card: CardReview;
  isFlipped: boolean;
  onFlip: () => void;
}

export function CardMain({ card, isFlipped, onFlip }: CardMainProps) {
  return (
    <div
      className="relative px-8 py-12 text-center min-h-[280px] flex flex-col justify-center cursor-pointer hover:bg-gray-50/50 transition-colors"
      onClick={onFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFlip();
        }
      }}
      aria-label="Flip card to reveal translation"
    >
      <KeyboardShortcutsTooltip />

      <GreekWord word={card.word || card.front} pronunciation={card.pronunciation || ''} />

      <div className="flex items-center justify-center gap-2 mb-6">
        <WordTypeBadge
          partOfSpeech={card.partOfSpeech}
          metadata={card.nounData || card.verbData}
        />
        <LevelBadge level={card.level} />
      </div>

      <Translation text={card.translation || card.back} isVisible={isFlipped} />

      {!isFlipped && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-gray-400 text-base">
          Click to reveal
        </div>
      )}
    </div>
  );
}
