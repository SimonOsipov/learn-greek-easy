import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PartOfSpeech } from '@/types/grammar';

export interface PartOfSpeechBadgeProps {
  partOfSpeech: PartOfSpeech;
  className?: string;
}

const PART_OF_SPEECH_CONFIG: Record<PartOfSpeech, { bgClass: string; textClass: string }> = {
  noun: { bgClass: 'bg-blue-500', textClass: 'text-white' },
  verb: { bgClass: 'bg-green-500', textClass: 'text-white' },
  adjective: { bgClass: 'bg-purple-500', textClass: 'text-white' },
  adverb: { bgClass: 'bg-orange-500', textClass: 'text-white' },
};

export function PartOfSpeechBadge({ partOfSpeech, className }: PartOfSpeechBadgeProps) {
  const { t } = useTranslation('review');
  const config = PART_OF_SPEECH_CONFIG[partOfSpeech];

  return (
    <Badge
      className={cn(config.bgClass, config.textClass, className)}
      data-testid="part-of-speech-badge"
    >
      {t(`grammar.partOfSpeech.${partOfSpeech}`)}
    </Badge>
  );
}
