// src/components/admin/vocabulary/grammar-display/grammar-edit/__tests__/grammarEditHelpers.test.ts

import { describe, it, expect } from 'vitest';
import {
  getFieldKeysForPOS,
  buildFormState,
  buildGrammarPayload,
  hasFormChanges,
  NOUN_FIELDS,
  VERB_FIELDS,
  ADJECTIVE_FIELDS,
  ADVERB_FIELDS,
} from '../grammarEditHelpers';

// ============================================
// Suite 1: getFieldKeysForPOS
// ============================================

describe('getFieldKeysForPOS', () => {
  it('returns 9 keys for noun', () => {
    const keys = getFieldKeysForPOS('noun');
    expect(keys.length).toBe(9);
    expect(keys).toEqual(NOUN_FIELDS);
  });

  it('returns 33 keys for verb', () => {
    const keys = getFieldKeysForPOS('verb');
    expect(keys.length).toBe(33);
    expect(keys).toEqual(VERB_FIELDS);
  });

  it('returns 26 keys for adjective', () => {
    const keys = getFieldKeysForPOS('adjective');
    expect(keys.length).toBe(26);
    expect(keys).toEqual(ADJECTIVE_FIELDS);
  });

  it('returns 2 keys for adverb', () => {
    const keys = getFieldKeysForPOS('adverb');
    expect(keys.length).toBe(2);
    expect(keys).toEqual(ADVERB_FIELDS);
  });

  it('returns [] for "phrase"', () => {
    expect(getFieldKeysForPOS('phrase')).toEqual([]);
  });

  it('returns [] for unknown POS', () => {
    expect(getFieldKeysForPOS('unknown_type')).toEqual([]);
  });
});

// ============================================
// Suite 2: buildFormState
// ============================================

describe('buildFormState', () => {
  it('returns all-empty-string map for null grammar data (noun)', () => {
    const state = buildFormState(null, 'noun');
    expect(Object.keys(state).length).toBe(9);
    for (const value of Object.values(state)) {
      expect(value).toBe('');
    }
    // Verify all 9 noun keys are present
    expect(state).toHaveProperty('gender', '');
    expect(state).toHaveProperty('nominative_singular', '');
    expect(state).toHaveProperty('nominative_plural', '');
    expect(state).toHaveProperty('genitive_singular', '');
    expect(state).toHaveProperty('genitive_plural', '');
    expect(state).toHaveProperty('accusative_singular', '');
    expect(state).toHaveProperty('accusative_plural', '');
    expect(state).toHaveProperty('vocative_singular', '');
    expect(state).toHaveProperty('vocative_plural', '');
  });

  it('returns all-empty-string map for null grammar data (verb)', () => {
    const state = buildFormState(null, 'verb');
    expect(Object.keys(state).length).toBe(33);
    for (const value of Object.values(state)) {
      expect(value).toBe('');
    }
  });

  it('handles V1 flat noun data — populates matching fields, fills missing with ""', () => {
    const v1Data = {
      gender: 'masculine',
      nominative_singular: 'σπίτι',
    };
    const state = buildFormState(v1Data, 'noun');

    expect(state.gender).toBe('masculine');
    expect(state.nominative_singular).toBe('σπίτι');
    // Missing fields should be empty string
    expect(state.nominative_plural).toBe('');
    expect(state.genitive_singular).toBe('');
    expect(state.genitive_plural).toBe('');
    expect(state.accusative_singular).toBe('');
    expect(state.accusative_plural).toBe('');
    expect(state.vocative_singular).toBe('');
    expect(state.vocative_plural).toBe('');
  });

  it('handles V2 nested noun data — correctly normalizes via normalizer', () => {
    const v2Data = {
      gender: 'neuter',
      cases: {
        singular: {
          nominative: 'σπίτι',
          genitive: 'σπιτιού',
        },
        plural: {},
      },
    };
    const state = buildFormState(v2Data, 'noun');

    expect(state.gender).toBe('neuter');
    expect(state.nominative_singular).toBe('σπίτι');
    expect(state.genitive_singular).toBe('σπιτιού');
    // Missing values from normalizer (null) should become ''
    expect(state.accusative_singular).toBe('');
    expect(state.nominative_plural).toBe('');
  });

  it('returns empty object for unknown POS', () => {
    const state = buildFormState({ foo: 'bar' }, 'phrase');
    expect(state).toEqual({});
  });

  it('fills missing fields with "" when normalizer returns partial data', () => {
    const partialData = {
      gender: 'feminine',
      cases: {
        singular: { nominative: 'γυναίκα' },
        // plural missing
      },
    };
    const state = buildFormState(partialData, 'noun');

    expect(state.nominative_singular).toBe('γυναίκα');
    // All fields that normalizer returns null for should become ''
    expect(state.genitive_singular).toBe('');
    expect(state.nominative_plural).toBe('');
    expect(state.genitive_plural).toBe('');
  });
});

// ============================================
// Suite 3: buildGrammarPayload
// ============================================

describe('buildGrammarPayload', () => {
  it('converts empty string to null', () => {
    const payload = buildGrammarPayload({ gender: '' });
    expect(payload.gender).toBeNull();
  });

  it('converts whitespace-only string to null', () => {
    const payload = buildGrammarPayload({ gender: '   ' });
    expect(payload.gender).toBeNull();
  });

  it('trims and preserves non-empty string values', () => {
    const payload = buildGrammarPayload({ nominative_singular: '  σπίτι  ' });
    expect(payload.nominative_singular).toBe('σπίτι');
  });

  it('handles mixed map with some empty and some filled values', () => {
    const formState = {
      gender: 'masculine',
      nominative_singular: 'σπίτι',
      nominative_plural: '',
      genitive_singular: '   ',
    };
    const payload = buildGrammarPayload(formState);

    expect(payload.gender).toBe('masculine');
    expect(payload.nominative_singular).toBe('σπίτι');
    expect(payload.nominative_plural).toBeNull();
    expect(payload.genitive_singular).toBeNull();
  });
});

// ============================================
// Suite 4: hasFormChanges
// ============================================

describe('hasFormChanges', () => {
  it('returns false for identical maps', () => {
    const map = { gender: 'masculine', nominative_singular: 'σπίτι' };
    expect(hasFormChanges(map, { ...map })).toBe(false);
  });

  it('returns true when one value differs', () => {
    const original = { gender: 'masculine', nominative_singular: 'σπίτι' };
    const current = { gender: 'feminine', nominative_singular: 'σπίτι' };
    expect(hasFormChanges(current, original)).toBe(true);
  });

  it('returns true when extra key has non-empty value', () => {
    const original = { gender: 'masculine' };
    const current = { gender: 'masculine', nominative_singular: 'σπίτι' };
    expect(hasFormChanges(current, original)).toBe(true);
  });

  it('returns false when extra key maps to "" (treated as missing)', () => {
    const original = { gender: 'masculine' };
    const current = { gender: 'masculine', nominative_singular: '' };
    expect(hasFormChanges(current, original)).toBe(false);
  });

  it('returns false for two empty maps', () => {
    expect(hasFormChanges({}, {})).toBe(false);
  });
});
