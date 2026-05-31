// src/features/practice/pf/__tests__/judge.test.ts
//
// Truth-table tests for the forgiving judge (PRACT2-1-08).
//
// Covers:
//   - normalize: diacritics, punctuation (· ;), whitespace collapse
//   - judge: exact / article-skip / Greeklish transliteration / single-typo / wrong
//   - comma-separated alternatives: any-match passes
//   - resolveAnswerText: non-declension and declension cell extraction

import { describe, it, expect } from 'vitest';

import { judge, normalize, levenshtein, transliterateGreek, resolveAnswerText } from '../judge';

// ── normalize ────────────────────────────────────────────────────────────────

describe('normalize', () => {
  it('lowercases ASCII', () => {
    expect(normalize('House')).toBe('house');
  });

  it('strips Greek monotonic accents (ά→α, έ→ε, ή→η, etc.)', () => {
    expect(normalize('σπίτι')).toBe('σπιτι');
    expect(normalize('άνθρωπος')).toBe('ανθρωπος');
    expect(normalize('έχω')).toBe('εχω');
  });

  it('strips the Greek middle-dot U+00B7', () => {
    expect(normalize('α·β')).toBe('α β');
  });

  it('strips the Greek question-mark/semicolon U+037E', () => {
    // ; is the Greek semicolon
    expect(normalize('τι;')).toBe('τι');
  });

  it('strips ASCII semicolon ;', () => {
    expect(normalize('hello;')).toBe('hello');
  });

  it('strips standard punctuation .,!? and collapses the resulting whitespace', () => {
    // ',' → ' ', then whitespace collapsed → single space
    expect(normalize('hello, world!')).toBe('hello world');
    expect(normalize('σπίτι.')).toBe('σπιτι');
  });

  it('collapses internal whitespace and trims', () => {
    expect(normalize('  το  σπίτι  ')).toBe('το σπιτι');
  });

  it('handles empty string', () => {
    expect(normalize('')).toBe('');
  });
});

// ── levenshtein ──────────────────────────────────────────────────────────────

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('house', 'house')).toBe(0);
  });

  it('returns 1 for single substitution', () => {
    expect(levenshtein('house', 'mouse')).toBe(1);
  });

  it('returns 1 for single insertion', () => {
    expect(levenshtein('house', 'houses')).toBe(1);
  });

  it('returns 1 for single deletion', () => {
    expect(levenshtein('houses', 'house')).toBe(1);
  });

  it('returns 2 for two substitutions', () => {
    expect(levenshtein('house', 'moose')).toBe(2);
  });

  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('', '')).toBe(0);
  });
});

// ── transliterateGreek ───────────────────────────────────────────────────────

describe('transliterateGreek', () => {
  it('transliterates θ → th', () => {
    expect(transliterateGreek('θ')).toBe('th');
  });

  it('transliterates χ → ch', () => {
    expect(transliterateGreek('χ')).toBe('ch');
  });

  it('transliterates ψ → ps', () => {
    expect(transliterateGreek('ψ')).toBe('ps');
  });

  it('transliterates ξ → x', () => {
    expect(transliterateGreek('ξ')).toBe('x');
  });

  it('transliterates both sigmas σ/ς → s', () => {
    expect(transliterateGreek('ος')).toBe('os');
    expect(transliterateGreek('σ')).toBe('s');
  });

  it('maps η → i and ω → o', () => {
    expect(transliterateGreek('η')).toBe('i');
    expect(transliterateGreek('ω')).toBe('o');
  });

  it('passes Latin characters through unchanged', () => {
    expect(transliterateGreek('house')).toBe('house');
  });

  it('transliterates a full word', () => {
    // σπίτι after normalize is σπιτι
    expect(transliterateGreek('σπιτι')).toBe('spiti');
  });
});

// ── judge ────────────────────────────────────────────────────────────────────

describe('judge — exact match', () => {
  it('returns correct for exact normalized match', () => {
    expect(judge('σπίτι', 'σπίτι')).toBe('correct');
  });

  it('returns correct when typed lacks accents', () => {
    expect(judge('σπιτι', 'σπίτι')).toBe('correct');
  });

  it('returns correct for English exact match', () => {
    expect(judge('house', 'house')).toBe('correct');
  });

  it('returns correct ignoring case', () => {
    expect(judge('House', 'house')).toBe('correct');
  });

  it('returns correct ignoring trailing punctuation', () => {
    expect(judge('house!', 'house')).toBe('correct');
  });

  it('returns correct ignoring extra whitespace', () => {
    expect(judge('  το σπίτι  ', 'το σπίτι')).toBe('correct');
  });
});

describe('judge — article-skip (lenient)', () => {
  it('returns lenient when typed omits leading article from answer', () => {
    // answer is "το σπίτι", typed is "σπίτι"
    expect(judge('σπιτι', 'το σπίτι')).toBe('lenient');
  });

  it('returns lenient when typed includes article but answer lacks it', () => {
    expect(judge('το σπίτι', 'σπίτι')).toBe('lenient');
  });

  it('returns lenient for η article', () => {
    expect(judge('θαλασσα', 'η θάλασσα')).toBe('lenient');
  });

  it('returns lenient for ο article', () => {
    expect(judge('ανθρωπος', 'ο άνθρωπος')).toBe('lenient');
  });
});

describe('judge — Greeklish transliteration (lenient)', () => {
  it('returns lenient when typed Greeklish matches transliterated answer', () => {
    // σπίτι → spiti
    expect(judge('spiti', 'σπίτι')).toBe('lenient');
  });

  it('returns lenient for θ → th transliteration', () => {
    // θάλασσα → thalassa
    expect(judge('thalassa', 'θάλασσα')).toBe('lenient');
  });

  it('returns lenient for χ → ch transliteration', () => {
    // χαρά → chara
    expect(judge('chara', 'χαρά')).toBe('lenient');
  });

  it('returns lenient for ψ → ps', () => {
    expect(judge('psomi', 'ψωμί')).toBe('lenient');
  });

  it('returns lenient for ξ → x', () => {
    expect(judge('xenos', 'ξένος')).toBe('lenient');
  });

  it('returns wrong for Latin typed against Greek answer when no translit match', () => {
    expect(judge('zzz', 'σπίτι')).toBe('wrong');
  });
});

describe('judge — single-char typo (Levenshtein=1, lenient)', () => {
  it('returns lenient for 1 typo in a short word (≤14 chars)', () => {
    // "house" vs "hause" — 1 substitution
    expect(judge('hause', 'house')).toBe('lenient');
  });

  it('returns lenient for 1 missing char in a short word', () => {
    // "hose" vs "house"
    expect(judge('hose', 'house')).toBe('lenient');
  });

  it('returns wrong for 2 typos even in a short word', () => {
    expect(judge('hsse', 'house')).toBe('wrong');
  });

  it('suppresses single-typo leniency when longer string > 14 chars', () => {
    // "verylongwordXX" is 14 chars, "verylongwordXY" is 14 chars — still lenient
    const long = 'verylongwordXX'; // 14 chars
    const typed = 'verylongwordXY'; // 14 chars, 1 diff
    expect(judge(typed, long)).toBe('lenient'); // ≤14 chars boundary

    // 15 chars — suppressed
    const long15 = 'verylongwordXXX'; // 15 chars
    const typed15 = 'verylongwordXXY'; // 15 chars, 1 diff
    expect(judge(typed15, long15)).toBe('wrong');
  });

  it('handles Greek short word typo', () => {
    // "σπιτη" vs "σπιτι" (after normalize) — 1 substitution
    expect(judge('σπιτη', 'σπίτι')).toBe('lenient');
  });
});

describe('judge — comma-separated alternatives', () => {
  it('returns correct if any alternative is an exact match', () => {
    expect(judge('house', 'home, house, dwelling')).toBe('correct');
  });

  it('returns lenient if any alternative matches leniently', () => {
    // "spiti" matches "σπίτι" via transliteration
    expect(judge('spiti', 'σπίτι, home')).toBe('lenient');
  });

  it('returns wrong if no alternative matches', () => {
    expect(judge('tree', 'house, home, dwelling')).toBe('wrong');
  });

  it('correct beats lenient across alternatives', () => {
    // First alt matches leniently (typo), second is exact
    expect(judge('house', 'hause, house')).toBe('correct');
  });
});

describe('judge — wrong outcomes', () => {
  it('returns wrong for empty typed', () => {
    expect(judge('', 'house')).toBe('wrong');
  });

  it('returns wrong for completely wrong answer', () => {
    expect(judge('airplane', 'house')).toBe('wrong');
  });

  it('returns wrong for completely wrong Greek', () => {
    expect(judge('ζωη', 'σπίτι')).toBe('wrong');
  });
});

// ── resolveAnswerText ────────────────────────────────────────────────────────

describe('resolveAnswerText', () => {
  it('returns main for non-declension cards', () => {
    expect(resolveAnswerText('meaning_el_to_en', { main: 'house', answer: 'home' })).toBe('house');
  });

  it('falls back to answer when main is absent', () => {
    expect(resolveAnswerText('meaning_el_to_en', { answer: 'house' })).toBe('house');
  });

  it('returns empty string when neither main nor answer', () => {
    expect(resolveAnswerText('meaning_el_to_en', {})).toBe('');
  });

  it('resolves declension singular highlighted cell', () => {
    const back = {
      declension_table: {
        gender: 'Masculine',
        rows: [
          {
            case: 'Nominative',
            singular: 'ο άνθρωπος',
            plural: 'οι άνθρωποι',
            highlight_singular: false,
            highlight_plural: false,
          },
          {
            case: 'Genitive',
            singular: 'του ανθρώπου',
            plural: 'των ανθρώπων',
            highlight_singular: true,
            highlight_plural: false,
          },
          {
            case: 'Accusative',
            singular: 'τον άνθρωπο',
            plural: 'τους ανθρώπους',
            highlight_singular: false,
            highlight_plural: false,
          },
          {
            case: 'Vocative',
            singular: 'άνθρωπε',
            plural: 'άνθρωποι',
            highlight_singular: false,
            highlight_plural: false,
          },
        ],
      },
    };
    expect(resolveAnswerText('declension', back)).toBe('του ανθρώπου');
  });

  it('resolves declension plural highlighted cell', () => {
    const back = {
      declension_table: {
        gender: 'Feminine',
        rows: [
          {
            case: 'Nominative',
            singular: 'η θάλασσα',
            plural: 'οι θάλασσες',
            highlight_singular: false,
            highlight_plural: false,
          },
          {
            case: 'Genitive',
            singular: 'της θάλασσας',
            plural: 'των θαλασσών',
            highlight_singular: false,
            highlight_plural: true,
          },
          {
            case: 'Accusative',
            singular: 'τη θάλασσα',
            plural: 'τις θάλασσες',
            highlight_singular: false,
            highlight_plural: false,
          },
          {
            case: 'Vocative',
            singular: 'θάλασσα',
            plural: 'θάλασσες',
            highlight_singular: false,
            highlight_plural: false,
          },
        ],
      },
    };
    expect(resolveAnswerText('declension', back)).toBe('των θαλασσών');
  });

  it('returns empty string for declension with no highlighted cell', () => {
    const back = {
      declension_table: {
        gender: 'Neuter',
        rows: [
          {
            case: 'Nominative',
            singular: 'το σπίτι',
            plural: 'τα σπίτια',
            highlight_singular: false,
            highlight_plural: false,
          },
        ],
      },
    };
    expect(resolveAnswerText('declension', back)).toBe('');
  });

  it('returns empty string for declension with invalid table', () => {
    expect(resolveAnswerText('declension', {})).toBe('');
    expect(resolveAnswerText('declension', { declension_table: null })).toBe('');
  });
});

// ── resolveAnswerText — lang param ───────────────────────────────────────────

describe('resolveAnswerText — lang param', () => {
  it('defaults to en behaviour when lang is omitted', () => {
    expect(
      resolveAnswerText('sentence_translation', {
        answer: 'Good morning!',
        answer_ru: 'Доброе утро!',
      })
    ).toBe('Good morning!');
  });

  it('returns answer_ru for sentence_translation when lang=ru and answer_ru is present', () => {
    expect(
      resolveAnswerText(
        'sentence_translation',
        { answer: 'Good morning!', answer_ru: 'Доброе утро!' },
        'ru'
      )
    ).toBe('Доброе утро!');
  });

  it('falls back to English answer for sentence_translation when lang=ru but answer_ru is absent', () => {
    expect(resolveAnswerText('sentence_translation', { answer: 'Good morning!' }, 'ru')).toBe(
      'Good morning!'
    );
  });

  it('falls back to English answer for sentence_translation when lang=ru but answer_ru is empty string', () => {
    expect(
      resolveAnswerText('sentence_translation', { answer: 'Good morning!', answer_ru: '' }, 'ru')
    ).toBe('Good morning!');
  });

  it('returns answer_sub_ru for plural_form when lang=ru and answer_sub_ru is present', () => {
    // plural_form: main = Greek stem, answer = plural form; answer_sub_ru = RU gender label
    expect(
      resolveAnswerText(
        'plural_form',
        { main: 'σπίτια', answer: 'σπίτια', answer_sub_ru: 'дома' },
        'ru'
      )
    ).toBe('дома');
  });

  it('falls back to main for plural_form when lang=ru but answer_sub_ru is absent', () => {
    expect(resolveAnswerText('plural_form', { main: 'σπίτια' }, 'ru')).toBe('σπίτια');
  });

  it('does not apply RU variant for article card type (no answer_ru field)', () => {
    // article cards: answer = the article ("ο"), no answer_ru
    expect(resolveAnswerText('article', { answer: 'ο', gender: 'masculine' }, 'ru')).toBe('ο');
  });

  it('does not apply RU variant for meaning cards', () => {
    expect(resolveAnswerText('meaning_el_to_en', { main: 'house' }, 'ru')).toBe('house');
  });
});
