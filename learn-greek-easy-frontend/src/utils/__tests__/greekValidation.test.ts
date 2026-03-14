import { describe, expect, it } from 'vitest';
import {
  isValidGreekInput,
  containsLatinCharacters,
  MAX_GREEK_INPUT_LENGTH,
  detectScript,
  scriptToLanguage,
} from '../greekValidation';

describe('greekValidation', () => {
  describe('isValidGreekInput', () => {
    it('accepts a simple Greek word', () => {
      expect(isValidGreekInput('σπίτι')).toEqual({ valid: true });
    });

    it('accepts a Greek phrase with space', () => {
      expect(isValidGreekInput('το σπίτι')).toEqual({ valid: true });
    });

    it('accepts a Greek word with accent', () => {
      expect(isValidGreekInput('μολύβι')).toEqual({ valid: true });
    });

    it('accepts a hyphenated Greek compound', () => {
      expect(isValidGreekInput('ελληνο-αγγλικό')).toEqual({ valid: true });
    });

    it('accepts a single Greek letter', () => {
      expect(isValidGreekInput('α')).toEqual({ valid: true });
    });

    it('accepts exactly 50 Greek characters', () => {
      const input = 'α'.repeat(50);
      expect(isValidGreekInput(input)).toEqual({ valid: true });
    });

    it('rejects an empty string', () => {
      const result = isValidGreekInput('');
      expect(result.valid).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('rejects a whitespace-only string', () => {
      const result = isValidGreekInput('   ');
      expect(result.valid).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('rejects a Latin-only word', () => {
      expect(isValidGreekInput('spiti')).toEqual({ valid: false, reason: 'latin' });
    });

    it('rejects a mixed Greek and Latin word', () => {
      expect(isValidGreekInput('σπίτιtest')).toEqual({ valid: false, reason: 'latin' });
    });

    it('rejects a numbers-only string', () => {
      expect(isValidGreekInput('123')).toEqual({ valid: false, reason: 'numbersOnly' });
    });

    it('rejects input exceeding 50 characters', () => {
      const input = 'α'.repeat(51);
      expect(isValidGreekInput(input)).toEqual({ valid: false, reason: 'tooLong' });
    });

    it('rejects Cyrillic characters (fallback to latin reason)', () => {
      expect(isValidGreekInput('дом')).toEqual({ valid: false, reason: 'latin' });
    });

    it('rejects mixed Greek and numbers (fallback to latin reason)', () => {
      expect(isValidGreekInput('σπίτι123')).toEqual({ valid: false, reason: 'latin' });
    });

    it('rejects a hyphen-only string (no Greek letters)', () => {
      expect(isValidGreekInput('-')).toEqual({ valid: false, reason: 'latin' });
    });

    it('rejects a semicolon-only string (no Greek letters)', () => {
      expect(isValidGreekInput(';')).toEqual({ valid: false, reason: 'latin' });
    });

    it('rejects middle-dots-only string (no Greek letters)', () => {
      expect(isValidGreekInput('\u00B7\u00B7\u00B7')).toEqual({ valid: false, reason: 'latin' });
    });
  });

  describe('containsLatinCharacters', () => {
    it('returns true for a Latin word', () => {
      expect(containsLatinCharacters('hello')).toBe(true);
    });

    it('returns false for a Greek word', () => {
      expect(containsLatinCharacters('σπίτι')).toBe(false);
    });

    it('returns true for a mixed Greek and Latin string', () => {
      expect(containsLatinCharacters('σπίτιtest')).toBe(true);
    });

    it('returns false for digits only', () => {
      expect(containsLatinCharacters('123')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(containsLatinCharacters('')).toBe(false);
    });
  });

  describe('MAX_GREEK_INPUT_LENGTH', () => {
    it('equals 50', () => {
      expect(MAX_GREEK_INPUT_LENGTH).toBe(50);
    });
  });

  describe('detectScript', () => {
    it('returns latin for English text', () => {
      expect(detectScript('house')).toBe('latin');
    });
    it('returns cyrillic for Russian text', () => {
      expect(detectScript('дом')).toBe('cyrillic');
    });
    it('returns greek for Greek text', () => {
      expect(detectScript('σπίτι')).toBe('greek');
    });
    it('returns latin for empty string', () => {
      expect(detectScript('')).toBe('latin');
    });
    it('returns latin for accented latin', () => {
      expect(detectScript('café')).toBe('latin');
    });
    it('returns greek when input contains Greek characters', () => {
      expect(detectScript('Ελλάδα')).toBe('greek');
    });
  });

  describe('scriptToLanguage', () => {
    it('maps latin to en', () => {
      expect(scriptToLanguage('latin')).toBe('en');
    });
    it('maps cyrillic to ru', () => {
      expect(scriptToLanguage('cyrillic')).toBe('ru');
    });
  });
});
