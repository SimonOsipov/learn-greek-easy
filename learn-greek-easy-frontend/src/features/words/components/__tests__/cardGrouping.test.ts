import { describe, it, expect } from 'vitest';

import { groupCards } from '../cardGrouping';
import type { CardMasteryItem } from '../../hooks';

function makeCard(
  card_type: string,
  mastery_status: 'none' | 'studied' | 'mastered' = 'none'
): CardMasteryItem {
  return {
    card_type: card_type as CardMasteryItem['card_type'],
    front_content: { prompt: 'test' },
    back_content: { answer: 'test' },
    mastery_status,
  };
}

describe('groupCards', () => {
  it('groups meaning_el_to_en into translation', () => {
    const result = groupCards([makeCard('meaning_el_to_en')]);
    const realGroups = result.filter((g) => !g.isPlaceholder);
    expect(realGroups).toHaveLength(1);
    expect(realGroups[0].key).toBe('translation');
    expect(realGroups[0].cards).toHaveLength(1);
  });

  it('groups meaning_en_to_el into translation', () => {
    const result = groupCards([makeCard('meaning_en_to_el')]);
    expect(result[0].key).toBe('translation');
  });

  it('groups sentence_translation into translation', () => {
    const result = groupCards([makeCard('sentence_translation')]);
    expect(result[0].key).toBe('translation');
  });

  it('groups plural_form into grammar', () => {
    const result = groupCards([makeCard('plural_form')]);
    expect(result[0].key).toBe('grammar');
  });

  it('groups article into grammar', () => {
    const result = groupCards([makeCard('article')]);
    expect(result[0].key).toBe('grammar');
  });

  it('groups conjugation into grammar', () => {
    const result = groupCards([makeCard('conjugation')]);
    expect(result[0].key).toBe('grammar');
  });

  it('groups declension into declension', () => {
    const result = groupCards([makeCard('declension')]);
    expect(result[0].key).toBe('declension');
  });

  it('puts unknown types (cloze) into grammar catch-all', () => {
    const result = groupCards([makeCard('cloze')]);
    expect(result[0].key).toBe('grammar');
    expect(result[0].cards[0].card_type).toBe('cloze');
  });

  it('omits empty real groups', () => {
    // Only translation card — grammar and declension should be omitted
    const result = groupCards([makeCard('meaning_el_to_en')]);
    const keys = result.map((g) => g.key);
    expect(keys).not.toContain('grammar');
    expect(keys).not.toContain('declension');
  });

  it('real groups get correct tone', () => {
    const cards = [makeCard('meaning_el_to_en'), makeCard('plural_form'), makeCard('declension')];
    const result = groupCards(cards);
    expect(result.find((g) => g.key === 'translation')?.tone).toBe('primary');
    expect(result.find((g) => g.key === 'grammar')?.tone).toBe('violet');
    expect(result.find((g) => g.key === 'declension')?.tone).toBe('cyan');
  });

  it('synthetic Audio (isPlaceholder) is always appended regardless of data', () => {
    const result = groupCards([makeCard('meaning_el_to_en')]);
    const audio = result.find((g) => g.key === 'audio');
    expect(audio).toBeDefined();
    expect(audio?.isPlaceholder).toBe(true);
    expect(audio?.tone).toBe('amber');
  });

  it('Audio placeholder always appended even with empty input', () => {
    const result = groupCards([]);
    const audio = result.find((g) => g.key === 'audio');
    expect(audio).toBeDefined();
    expect(audio?.isPlaceholder).toBe(true);
  });

  it('totals (masteredCount, totalCount) on Audio placeholder are 0', () => {
    const result = groupCards([makeCard('meaning_el_to_en', 'mastered')]);
    const audio = result.find((g) => g.key === 'audio')!;
    expect(audio.masteredCount).toBe(0);
    expect(audio.totalCount).toBe(0);
  });

  it('preserves fixed order: translation, grammar, declension, then audio', () => {
    const cards = [makeCard('declension'), makeCard('plural_form'), makeCard('meaning_el_to_en')];
    const result = groupCards(cards);
    expect(result.map((g) => g.key)).toEqual(['translation', 'grammar', 'declension', 'audio']);
  });

  it('computes masteredCount correctly', () => {
    const cards = [
      makeCard('meaning_el_to_en', 'mastered'),
      makeCard('meaning_en_to_el', 'studied'),
      makeCard('sentence_translation', 'none'),
    ];
    const result = groupCards(cards);
    const translationGroup = result.find((g) => g.key === 'translation')!;
    expect(translationGroup.masteredCount).toBe(1);
  });

  it('computes totalCount correctly', () => {
    const cards = [
      makeCard('meaning_el_to_en'),
      makeCard('meaning_en_to_el'),
      makeCard('sentence_translation'),
    ];
    const result = groupCards(cards);
    const translationGroup = result.find((g) => g.key === 'translation')!;
    expect(translationGroup.totalCount).toBe(3);
  });
});
