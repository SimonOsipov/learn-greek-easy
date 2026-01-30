import { useTranslation } from 'react-i18next';

import type { CardReview } from '@/types/review';

import { PartOfSpeechBadge } from './grammar';

interface CardHeaderProps {
  card: CardReview;
  onFlip: () => void;
}

export function CardHeader({ card, onFlip }: CardHeaderProps) {
  const { t } = useTranslation('review');
  const partOfSpeech = card.part_of_speech;

  // Get gender for nouns or voice for verbs
  const getMetadataLabel = () => {
    if (partOfSpeech === 'noun') {
      const gender = card.noun_data?.gender;
      if (gender) {
        return t(`grammar.nounDeclension.genders.${gender}`);
      }
    }
    if (partOfSpeech === 'verb') {
      const voice = card.verb_data?.voice;
      if (voice) {
        return t(`grammar.verbConjugation.voice.${voice}`);
      }
    }
    return null;
  };

  const metadataLabel = getMetadataLabel();

  return (
    <div
      className="cursor-pointer rounded-lg bg-card p-6 text-center"
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {partOfSpeech && <PartOfSpeechBadge partOfSpeech={partOfSpeech} />}
        </div>
        {metadataLabel && <span className="text-sm text-muted-foreground">{metadataLabel}</span>}
      </div>
      <h2 className="mt-4 text-4xl font-bold">{card.word || card.front}</h2>
      {card.pronunciation && (
        <p className="mt-2 text-lg italic text-muted-foreground">{card.pronunciation}</p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">{t('session.clickToReveal')}</p>
    </div>
  );
}
