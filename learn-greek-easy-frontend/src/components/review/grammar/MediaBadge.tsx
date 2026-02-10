import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CardRecordType } from '@/services/wordEntryAPI';

/**
 * Display categories for card type badges.
 * Maps multiple CardRecordType values to user-facing badge labels.
 */
export type MediaType = 'vocabulary' | 'sentence' | 'plural' | 'article' | 'grammar';

/**
 * Maps a card record type to its display media type category.
 * Uses exhaustive switch for compile-time safety when new card types are added.
 *
 * @param cardType - The card_type value from CardRecordResponse
 * @returns The display category for badge rendering
 */
export function getMediaType(cardType: CardRecordType): MediaType {
  switch (cardType) {
    case 'meaning_el_to_en':
    case 'meaning_en_to_el':
      return 'vocabulary';
    case 'sentence_translation':
      return 'sentence';
    case 'plural_form':
      return 'plural';
    case 'article':
      return 'article';
    case 'conjugation':
    case 'declension':
    case 'cloze':
      return 'grammar';
  }
}

const MEDIA_TYPE_CONFIG: Record<
  MediaType,
  { bgClass: string; textClass: string; labelKey: string }
> = {
  vocabulary: {
    bgClass: 'bg-blue-500',
    textClass: 'text-white',
    labelKey: 'practice.meaningBadge',
  },
  sentence: {
    bgClass: 'bg-teal-500',
    textClass: 'text-white',
    labelKey: 'practice.sentenceTranslationBadge',
  },
  plural: {
    bgClass: 'bg-purple-500',
    textClass: 'text-white',
    labelKey: 'practice.pluralFormBadge',
  },
  article: { bgClass: 'bg-amber-500', textClass: 'text-white', labelKey: 'practice.articleBadge' },
  grammar: {
    bgClass: 'bg-emerald-500',
    textClass: 'text-white',
    labelKey: 'practice.grammarBadge',
  },
};

export interface MediaBadgeProps {
  cardType: CardRecordType;
  className?: string;
}

export function MediaBadge({ cardType, className }: MediaBadgeProps) {
  const { t } = useTranslation('deck');
  const mediaType = getMediaType(cardType);
  const config = MEDIA_TYPE_CONFIG[mediaType];

  return (
    <Badge className={cn(config.bgClass, config.textClass, className)} data-testid="media-badge">
      {t(config.labelKey)}
    </Badge>
  );
}
