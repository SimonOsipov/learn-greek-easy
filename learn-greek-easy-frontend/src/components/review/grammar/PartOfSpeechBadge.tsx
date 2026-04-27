import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { PartOfSpeech } from '@/types/grammar';

export interface PartOfSpeechBadgeProps {
  partOfSpeech: PartOfSpeech;
  className?: string;
}

// Semantic color mapping: noun=amber, verb=green, adjective=violet, adverb=blue
const PART_OF_SPEECH_CONFIG: Record<PartOfSpeech, string> = {
  noun: 'b-amber',
  verb: 'b-green',
  adjective: 'b-violet',
  adverb: 'b-blue',
};

export function PartOfSpeechBadge({ partOfSpeech, className }: PartOfSpeechBadgeProps) {
  const { t } = useTranslation('review');
  const badgeVariant = PART_OF_SPEECH_CONFIG[partOfSpeech];

  return (
    <span className={cn('badge', badgeVariant, className)} data-testid="part-of-speech-badge">
      {t(`grammar.partOfSpeech.${partOfSpeech}`)}
    </span>
  );
}
