import { useTranslation } from 'react-i18next';

import type { CardReview } from '@/types/review';

import { KeyboardShortcutsTooltip } from './KeyboardShortcutsTooltip';
import { GreekWord } from './shared/GreekWord';
import { LevelBadge } from './shared/LevelBadge';
import { Translation } from './shared/Translation';
import { WordTypeBadge } from './shared/WordTypeBadge';

interface CardMainProps {
  card: CardReview;
  isFlipped: boolean;
  onFlip: () => void;
}

export function CardMain({ card, isFlipped, onFlip }: CardMainProps) {
  const { t } = useTranslation('review');

  return (
    <div
      className="relative flex min-h-[280px] cursor-pointer flex-col justify-center px-8 py-12 text-center transition-colors hover:bg-gray-50/50"
      onClick={onFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFlip();
        }
      }}
      aria-label={t('session.flipCardAriaLabel')}
    >
      <KeyboardShortcutsTooltip />

      <GreekWord word={card.word || card.front} pronunciation={card.pronunciation || ''} />

      <div className="mb-6 flex items-center justify-center gap-2">
        <WordTypeBadge partOfSpeech={card.partOfSpeech} metadata={card.nounData || card.verbData} />
        <LevelBadge level={card.level} />
      </div>

      <Translation text={card.translation || card.back} isVisible={isFlipped} />

      {!isFlipped && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-base text-gray-400">
          {t('session.clickToReveal')}
        </div>
      )}
    </div>
  );
}
