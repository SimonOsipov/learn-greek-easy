/// <reference types="jest" />
/**
 * Unit tests for ExamDeckCard helpers (src/components/culture/exam-deck-card.tsx).
 *
 * Tests:
 *   1. dateWatermarkFromName — known month patterns from real deck names.
 *   2. dateWatermarkFromName — returns '' for names with no recognisable month.
 *   3. dateWatermarkFromName — null/undefined inputs return ''.
 *   4. dateWatermarkFromName — case-insensitive match (e.g. "jul", "JUL").
 *   5. dateWatermarkFromName — returns the matched casing from the source string.
 */
import { dateWatermarkFromName } from '../exam-deck-card';

describe('dateWatermarkFromName', () => {
  // The regex matches 3-letter abbreviations only (Jan/Feb/Mar/Apr/May/Jun/Jul/Aug/Sep/Oct/Nov/Dec)
  // — full month names (January, October) are NOT matched by design.
  it.each([
    ["Cultural Exam Jul'25", 'Jul'],
    ["Cultural Exam Sep'24", 'Sep'],
    ["Exam Feb 2025",        'Feb'],
    ["Exam for Dec",         'Dec'],
    ["B1 Apr Mock",          'Apr'],
    ["May Cultural Test",    'May'],
  ])('extracts 3-letter month abbreviation from "%s" → "%s"', (input, expected) => {
    expect(dateWatermarkFromName(input)).toBe(expected);
  });

  it('returns empty string when no month abbreviation is present', () => {
    expect(dateWatermarkFromName('Cultural Grammar Deck')).toBe('');
    expect(dateWatermarkFromName('Vocabulary Level A1')).toBe('');
    expect(dateWatermarkFromName('')).toBe('');
  });

  it('returns empty string for null input', () => {
    expect(dateWatermarkFromName(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(dateWatermarkFromName(undefined)).toBe('');
  });

  it('performs case-insensitive matching', () => {
    // match[1] preserves the casing from the source string
    expect(dateWatermarkFromName("exam jul'25")).toBe('jul');
    expect(dateWatermarkFromName("exam JUL'25")).toBe('JUL');
    expect(dateWatermarkFromName("exam Jul'25")).toBe('Jul');
  });
});
