// src/components/admin/vocabulary/grammar-display/__tests__/grammarNormalizer.test.ts

import { describe, it, expect } from 'vitest';
import { normalizeGrammarData } from '../grammarNormalizer';

// ============================================
// Noun Tests
// ============================================

describe('normalizeGrammarData - noun', () => {
  it('normalizes V2 nested noun grammar data', () => {
    const v2Data = {
      gender: 'neuter',
      cases: {
        singular: {
          nominative: 'σπίτι',
          genitive: 'σπιτιού',
          accusative: 'σπίτι',
          vocative: 'σπίτι',
        },
        plural: {
          nominative: 'σπίτια',
          genitive: 'σπιτιών',
          accusative: 'σπίτια',
          vocative: 'σπίτια',
        },
      },
    };
    const result = normalizeGrammarData(v2Data, 'noun');

    expect(result.gender).toBe('neuter');
    expect(result.nominative_singular).toBe('σπίτι');
    expect(result.genitive_singular).toBe('σπιτιού');
    expect(result.accusative_singular).toBe('σπίτι');
    expect(result.vocative_singular).toBe('σπίτι');
    expect(result.nominative_plural).toBe('σπίτια');
    expect(result.genitive_plural).toBe('σπιτιών');
    expect(result.accusative_plural).toBe('σπίτια');
    expect(result.vocative_plural).toBe('σπίτια');
  });

  it('normalizes V1 flat noun grammar data', () => {
    const v1Data = {
      gender: 'masculine',
      nominative_singular: 'άντρας',
      genitive_singular: 'άντρα',
      accusative_singular: 'άντρα',
      vocative_singular: 'άντρα',
      nominative_plural: 'άντρες',
      genitive_plural: 'αντρών',
      accusative_plural: 'άντρες',
      vocative_plural: 'άντρες',
    };
    const result = normalizeGrammarData(v1Data, 'noun');

    expect(result.gender).toBe('masculine');
    expect(result.nominative_singular).toBe('άντρας');
    expect(result.nominative_plural).toBe('άντρες');
    expect(result.genitive_singular).toBe('άντρα');
  });

  it('returns null for missing cases in V2 nested noun', () => {
    const partialData = {
      gender: 'feminine',
      cases: {
        singular: {
          nominative: 'γυναίκα',
        },
        // plural missing
      },
    };
    const result = normalizeGrammarData(partialData, 'noun');

    expect(result.gender).toBe('feminine');
    expect(result.nominative_singular).toBe('γυναίκα');
    expect(result.genitive_singular).toBeNull();
    expect(result.nominative_plural).toBeNull();
  });

  it('returns null gender when not present in V1 flat', () => {
    const data = { nominative_singular: 'test' };
    const result = normalizeGrammarData(data, 'noun');
    expect(result.gender).toBeNull();
  });

  it('returns empty keys for null data', () => {
    const result = normalizeGrammarData(null, 'noun');
    expect(result).toEqual({});
  });
});

// ============================================
// Verb Tests
// ============================================

describe('normalizeGrammarData - verb', () => {
  it('normalizes V2 nested verb grammar data with Greek person keys', () => {
    const v2Data = {
      voice: 'active',
      tenses: {
        present: {
          εγώ: 'γράφω',
          εσύ: 'γράφεις',
          'αυτός/αυτή/αυτό': 'γράφει',
          εμείς: 'γράφουμε',
          εσείς: 'γράφετε',
          'αυτοί/αυτές/αυτά': 'γράφουν',
        },
      },
    };
    const result = normalizeGrammarData(v2Data, 'verb');

    expect(result.voice).toBe('active');
    expect(result.present_1s).toBe('γράφω');
    expect(result.present_2s).toBe('γράφεις');
    expect(result.present_3s).toBe('γράφει');
    expect(result.present_1p).toBe('γράφουμε');
    expect(result.present_2p).toBe('γράφετε');
    expect(result.present_3p).toBe('γράφουν');
  });

  it('fills missing tenses with null in V2 nested verb', () => {
    const v2Data = {
      voice: 'active',
      tenses: {
        present: { εγώ: 'γράφω' },
        // other tenses missing
      },
    };
    const result = normalizeGrammarData(v2Data, 'verb');

    expect(result.present_1s).toBe('γράφω');
    expect(result.imperfect_1s).toBeNull();
    expect(result.past_1s).toBeNull();
    expect(result.future_1s).toBeNull();
    expect(result.perfect_1s).toBeNull();
  });

  it('reads imperative fields from top-level in V2', () => {
    const v2Data = {
      voice: 'active',
      tenses: {},
      imperative_2s: 'γράψε',
      imperative_2p: 'γράψτε',
    };
    const result = normalizeGrammarData(v2Data, 'verb');

    expect(result.imperative_2s).toBe('γράψε');
    expect(result.imperative_2p).toBe('γράψτε');
  });

  it('normalizes V1 flat verb grammar data', () => {
    const v1Data = {
      voice: 'active',
      present_1s: 'γράφω',
      present_2s: 'γράφεις',
      imperative_2s: 'γράψε',
      imperative_2p: 'γράψτε',
    };
    const result = normalizeGrammarData(v1Data, 'verb');

    expect(result.voice).toBe('active');
    expect(result.present_1s).toBe('γράφω');
    expect(result.present_2s).toBe('γράφεις');
    expect(result.imperative_2s).toBe('γράψε');
    expect(result.imperative_2p).toBe('γράψτε');
  });

  it('returns null for imperative fields when absent in V2', () => {
    const v2Data = { voice: 'active', tenses: {} };
    const result = normalizeGrammarData(v2Data, 'verb');

    expect(result.imperative_2s).toBeNull();
    expect(result.imperative_2p).toBeNull();
  });
});

// ============================================
// Adjective Tests
// ============================================

describe('normalizeGrammarData - adjective', () => {
  it('normalizes V2 nested adjective data with forms.[gender].[number].[case]', () => {
    const v2Data = {
      forms: {
        masculine: {
          singular: {
            nominative: 'ωραίος',
            genitive: 'ωραίου',
            accusative: 'ωραίο',
            vocative: 'ωραίε',
          },
          plural: {
            nominative: 'ωραίοι',
            genitive: 'ωραίων',
            accusative: 'ωραίους',
            vocative: 'ωραίοι',
          },
        },
        feminine: {
          singular: {
            nominative: 'ωραία',
          },
        },
      },
    };
    const result = normalizeGrammarData(v2Data, 'adjective');

    expect(result.masculine_nom_sg).toBe('ωραίος');
    expect(result.masculine_gen_sg).toBe('ωραίου');
    expect(result.masculine_acc_sg).toBe('ωραίο');
    expect(result.masculine_voc_sg).toBe('ωραίε');
    expect(result.masculine_nom_pl).toBe('ωραίοι');
    expect(result.feminine_nom_sg).toBe('ωραία');
    expect(result.feminine_gen_sg).toBeNull();
    expect(result.neuter_nom_sg).toBeNull();
  });

  it('normalizes V1 flat adjective data', () => {
    const v1Data = {
      masculine_nom_sg: 'ωραίος',
      masculine_gen_sg: 'ωραίου',
      comparative: 'πιο ωραίος',
      superlative: 'ο πιο ωραίος',
    };
    const result = normalizeGrammarData(v1Data, 'adjective');

    expect(result.masculine_nom_sg).toBe('ωραίος');
    expect(result.masculine_gen_sg).toBe('ωραίου');
    expect(result.comparative).toBe('πιο ωραίος');
    expect(result.superlative).toBe('ο πιο ωραίος');
  });

  it('includes comparative and superlative from V2 data', () => {
    const v2Data = {
      forms: {},
      comparative: 'πιο ωραίος',
      superlative: 'ο πιο ωραίος',
    };
    const result = normalizeGrammarData(v2Data, 'adjective');

    expect(result.comparative).toBe('πιο ωραίος');
    expect(result.superlative).toBe('ο πιο ωραίος');
  });
});

// ============================================
// Adverb Tests
// ============================================

describe('normalizeGrammarData - adverb', () => {
  it('returns {comparative: null, superlative: null} for V2 adverb with only category', () => {
    const v2Data = { category: 'time' };
    const result = normalizeGrammarData(v2Data, 'adverb');

    expect(result).toEqual({ comparative: null, superlative: null });
  });

  it('returns comparative and superlative when present', () => {
    const data = { comparative: 'πιο γρήγορα', superlative: 'πιο αργά' };
    const result = normalizeGrammarData(data, 'adverb');

    expect(result.comparative).toBe('πιο γρήγορα');
    expect(result.superlative).toBe('πιο αργά');
  });

  it('returns null for empty string values', () => {
    const data = { comparative: '', superlative: '' };
    const result = normalizeGrammarData(data, 'adverb');

    expect(result.comparative).toBeNull();
    expect(result.superlative).toBeNull();
  });
});

// ============================================
// Unknown POS Tests
// ============================================

describe('normalizeGrammarData - unknown/phrase', () => {
  it('returns empty object for unknown POS', () => {
    const result = normalizeGrammarData({ foo: 'bar' }, 'phrase');
    expect(result).toEqual({});
  });

  it('returns empty object for completely unknown POS', () => {
    const result = normalizeGrammarData({ foo: 'bar' }, 'unknown_type');
    expect(result).toEqual({});
  });

  it('returns empty object for null data on any POS', () => {
    expect(normalizeGrammarData(null, 'noun')).toEqual({});
    expect(normalizeGrammarData(null, 'verb')).toEqual({});
    expect(normalizeGrammarData(null, 'adjective')).toEqual({});
    expect(normalizeGrammarData(null, 'adverb')).toEqual({});
  });
});
