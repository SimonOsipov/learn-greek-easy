import type { CardRecordType } from '@/services/wordEntryAPI';

import type { CardMasteryItem } from '../hooks';

export type CardGroupKey = 'translation' | 'grammar' | 'declension' | 'audio';

export const GROUP_TONE: Record<CardGroupKey, 'primary' | 'violet' | 'cyan' | 'amber'> = {
  translation: 'primary',
  grammar: 'violet',
  declension: 'cyan',
  audio: 'amber',
};

export interface CardGroupDefinition {
  key: CardGroupKey;
  i18nKey: string;
  types: CardRecordType[];
}

export interface GroupedCards {
  key: CardGroupKey;
  i18nKey: string;
  cards: CardMasteryItem[];
  masteredCount: number;
  totalCount: number;
  tone: 'primary' | 'violet' | 'cyan' | 'amber';
  isPlaceholder?: boolean;
}

const CARD_GROUPS: CardGroupDefinition[] = [
  {
    key: 'translation',
    i18nKey: 'groupTranslation',
    types: ['meaning_el_to_en', 'meaning_en_to_el', 'sentence_translation'],
  },
  {
    key: 'grammar',
    i18nKey: 'groupGrammar',
    types: ['plural_form', 'article', 'conjugation'],
  },
  {
    key: 'declension',
    i18nKey: 'groupDeclension',
    types: ['declension'],
  },
];

export function groupCards(cards: CardMasteryItem[]): GroupedCards[] {
  const buckets: Record<Exclude<CardGroupKey, 'audio'>, CardMasteryItem[]> = {
    translation: [],
    grammar: [],
    declension: [],
  };

  for (const card of cards) {
    const group = CARD_GROUPS.find((g) => (g.types as string[]).includes(card.card_type));
    if (group) {
      buckets[group.key as Exclude<CardGroupKey, 'audio'>].push(card);
    } else {
      // Unknown types fall into grammar catch-all
      buckets.grammar.push(card);
    }
  }

  const realGroups = CARD_GROUPS.map((def) => {
    const groupItems = buckets[def.key as Exclude<CardGroupKey, 'audio'>];
    return {
      key: def.key,
      i18nKey: def.i18nKey,
      cards: groupItems,
      masteredCount: groupItems.filter((c) => c.mastery_status === 'mastered').length,
      totalCount: groupItems.length,
      tone: GROUP_TONE[def.key],
    };
  }).filter((g) => g.totalCount > 0);

  // Synthetic Audio placeholder — always appended, excluded from summary totals
  const audioPlaceholder: GroupedCards = {
    key: 'audio',
    i18nKey: 'groupAudio',
    cards: [],
    masteredCount: 0,
    totalCount: 0,
    tone: GROUP_TONE.audio,
    isPlaceholder: true,
  };

  return [...realGroups, audioPlaceholder];
}
