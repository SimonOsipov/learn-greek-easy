import type { CardRecordType } from '@/services/wordEntryAPI';

import type { CardMasteryItem } from '../hooks';

export type CardGroupKey = 'translation' | 'grammar' | 'declension';

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
  const buckets: Record<CardGroupKey, CardMasteryItem[]> = {
    translation: [],
    grammar: [],
    declension: [],
  };

  for (const card of cards) {
    const group = CARD_GROUPS.find((g) => (g.types as string[]).includes(card.card_type));
    if (group) {
      buckets[group.key].push(card);
    } else {
      // Unknown types fall into grammar catch-all
      buckets.grammar.push(card);
    }
  }

  return CARD_GROUPS.map((def) => {
    const groupCards = buckets[def.key];
    return {
      key: def.key,
      i18nKey: def.i18nKey,
      cards: groupCards,
      masteredCount: groupCards.filter((c) => c.mastery_status === 'mastered').length,
      totalCount: groupCards.length,
    };
  }).filter((g) => g.totalCount > 0);
}
