/**
 * getMediaType Helper Function Tests
 *
 * Tests for the getMediaType helper function, verifying:
 * - Correct MediaType mapping for all CardRecordType values
 * - Type safety and exhaustive switch coverage
 * - Matches PRD specification for [MBADG-01]
 */

import { describe, expect, it } from 'vitest';

import { getMediaType } from '../MediaBadge';
import type { CardRecordType } from '@/services/wordEntryAPI';

describe('getMediaType', () => {
  describe('Vocabulary Mapping', () => {
    it('should map meaning_el_to_en to vocabulary', () => {
      const result = getMediaType('meaning_el_to_en');
      expect(result).toBe('vocabulary');
    });

    it('should map meaning_en_to_el to vocabulary', () => {
      const result = getMediaType('meaning_en_to_el');
      expect(result).toBe('vocabulary');
    });
  });

  describe('Sentence Mapping', () => {
    it('should map sentence_translation to sentence', () => {
      const result = getMediaType('sentence_translation');
      expect(result).toBe('sentence');
    });
  });

  describe('Plural Mapping', () => {
    it('should map plural_form to plural', () => {
      const result = getMediaType('plural_form');
      expect(result).toBe('plural');
    });
  });

  describe('Article Mapping', () => {
    it('should map article to article', () => {
      const result = getMediaType('article');
      expect(result).toBe('article');
    });
  });

  describe('Grammar Mapping', () => {
    it('should map conjugation to grammar', () => {
      const result = getMediaType('conjugation');
      expect(result).toBe('grammar');
    });

    it('should map declension to grammar', () => {
      const result = getMediaType('declension');
      expect(result).toBe('grammar');
    });

    it('should map cloze to grammar', () => {
      const result = getMediaType('cloze');
      expect(result).toBe('grammar');
    });
  });

  describe('Exhaustive Coverage', () => {
    const allCardTypes: CardRecordType[] = [
      'meaning_el_to_en',
      'meaning_en_to_el',
      'sentence_translation',
      'plural_form',
      'article',
      'conjugation',
      'declension',
      'cloze',
    ];

    it.each(allCardTypes)('should handle %s without throwing', (cardType: CardRecordType) => {
      expect(() => getMediaType(cardType)).not.toThrow();
    });

    it.each([
      { input: 'meaning_el_to_en', expected: 'vocabulary' },
      { input: 'meaning_en_to_el', expected: 'vocabulary' },
      { input: 'sentence_translation', expected: 'sentence' },
      { input: 'plural_form', expected: 'plural' },
      { input: 'article', expected: 'article' },
      { input: 'conjugation', expected: 'grammar' },
      { input: 'declension', expected: 'grammar' },
      { input: 'cloze', expected: 'grammar' },
    ] as Array<{ input: CardRecordType; expected: string }>)(
      'should map $input to $expected',
      ({ input, expected }) => {
        expect(getMediaType(input)).toBe(expected);
      }
    );
  });
});
