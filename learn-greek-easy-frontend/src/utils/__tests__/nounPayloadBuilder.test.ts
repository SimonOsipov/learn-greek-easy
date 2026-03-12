/**
 * Unit tests for nounPayloadBuilder utilities
 *
 * Covers:
 * - toAsciiLemma: Greek → Latin transliteration, diacritic stripping
 * - resolveFieldValue: selectionMap lookup vs cross-AI fallback
 * - buildWordEntryPayload: flat grammar_data, example IDs, translation fields
 */

import { describe, it, expect } from 'vitest';

import type { SelectionSource } from '@/components/admin/UnifiedVerificationTable';
import type { CrossAIVerificationResult, LocalVerificationResult } from '@/services/adminAPI';

import { toAsciiLemma, resolveFieldValue, buildWordEntryPayload } from '../nounPayloadBuilder';

// ============================================
// toAsciiLemma
// ============================================

describe('toAsciiLemma', () => {
  it('converts simple Greek noun (γάτα → gata)', () => {
    expect(toAsciiLemma('γάτα')).toBe('gata');
  });

  it('strips diacritics/accents before mapping (σπίτι → spiti)', () => {
    expect(toAsciiLemma('σπίτι')).toBe('spiti');
  });

  it('handles multi-char mappings (θ → th, χ → ch, ψ → ps, ξ → x)', () => {
    expect(toAsciiLemma('θ')).toBe('th');
    expect(toAsciiLemma('χ')).toBe('ch');
    expect(toAsciiLemma('ψ')).toBe('ps');
    expect(toAsciiLemma('ξ')).toBe('x');
  });

  it('drops non-alphanumeric characters (spaces, hyphens)', () => {
    expect(toAsciiLemma('αβ γ')).toBe('abg');
  });

  it('maps both sigma forms (σ and ς) to s', () => {
    expect(toAsciiLemma('σς')).toBe('ss');
  });

  it('maps η and ω to i and o respectively', () => {
    expect(toAsciiLemma('η')).toBe('i');
    expect(toAsciiLemma('ω')).toBe('o');
  });

  it('returns empty string for empty input', () => {
    expect(toAsciiLemma('')).toBe('');
  });
});

// ============================================
// resolveFieldValue
// ============================================

const mockLocal: LocalVerificationResult = {
  tier: 'auto_approve',
  stages_skipped: [],
  summary: 'All checks passed',
  fields: [
    {
      field_path: 'grammar_data.gender',
      status: 'pass',
      checks: [
        {
          check_name: 'spellcheck',
          status: 'pass',
          message: null,
          reference_value: 'masculine',
          reference_source: null,
        },
      ],
    },
  ],
};

const mockCrossAI: CrossAIVerificationResult = {
  comparisons: [
    {
      field_path: 'grammar_data.gender',
      primary_value: 'masculine',
      secondary_value: 'neuter',
      agrees: false,
      weight: 1,
    },
    {
      field_path: 'cases.singular.nominative',
      primary_value: 'ο άντρας',
      secondary_value: 'άντρας',
      agrees: true,
      weight: 1,
    },
  ],
  overall_agreement: 0.5,
  secondary_model: 'test-model',
  secondary_generation: null,
  error: null,
};

const mockVerification = { local: mockLocal, cross_ai: mockCrossAI };

describe('resolveFieldValue', () => {
  it('returns null when selectionMap is empty and no cross-AI verification', () => {
    expect(
      resolveFieldValue('grammar_data.gender', new Map(), { local: null, cross_ai: null })
    ).toBeNull();
  });

  it('falls back to cross-AI primary_value when field not in selectionMap', () => {
    expect(resolveFieldValue('grammar_data.gender', new Map(), mockVerification)).toBe('masculine');
  });

  it('returns null when field not in selectionMap and not in cross-AI', () => {
    expect(resolveFieldValue('unknown.field', new Map(), mockVerification)).toBeNull();
  });

  it('resolves local source from checks reference_value', () => {
    const map = new Map<string, SelectionSource>([['grammar_data.gender', 'local']]);
    expect(resolveFieldValue('grammar_data.gender', map, mockVerification)).toBe('masculine');
  });

  it('returns null for local source when field not in local.fields', () => {
    const map = new Map<string, SelectionSource>([['unknown.field', 'local']]);
    expect(resolveFieldValue('unknown.field', map, mockVerification)).toBeNull();
  });

  it('resolves primary source from cross-AI primary_value', () => {
    const map = new Map<string, SelectionSource>([['grammar_data.gender', 'primary']]);
    expect(resolveFieldValue('grammar_data.gender', map, mockVerification)).toBe('masculine');
  });

  it('resolves secondary source from cross-AI secondary_value', () => {
    const map = new Map<string, SelectionSource>([['grammar_data.gender', 'secondary']]);
    expect(resolveFieldValue('grammar_data.gender', map, mockVerification)).toBe('neuter');
  });

  it('returns null for primary/secondary when verification is null', () => {
    const map = new Map<string, SelectionSource>([['grammar_data.gender', 'primary']]);
    expect(resolveFieldValue('grammar_data.gender', map, null)).toBeNull();
  });

  it('returns null for primary/secondary when field not in cross-AI comparisons', () => {
    const map = new Map<string, SelectionSource>([['unknown.field', 'primary']]);
    expect(resolveFieldValue('unknown.field', map, mockVerification)).toBeNull();
  });
});

// ============================================
// buildWordEntryPayload
// ============================================

const mockGeneration = {
  lemma: 'γάτα',
  part_of_speech: 'noun' as const,
  translation_en: 'cat',
  translation_en_plural: 'cats',
  translation_ru: 'кошка',
  translation_ru_plural: 'кошки',
  pronunciation: '/ˈɣa.ta/',
  grammar_data: {
    gender: 'feminine' as const,
    declension_group: 'feminine_a',
    cases: {
      singular: {
        nominative: 'η γάτα',
        genitive: 'της γάτας',
        accusative: 'τη γάτα',
        vocative: 'γάτα',
      },
      plural: {
        nominative: 'οι γάτες',
        genitive: 'των γατών',
        accusative: 'τις γάτες',
        vocative: 'γάτες',
      },
    },
  },
  examples: [
    { id: 1, greek: 'Η γάτα κοιμάται.', english: 'The cat is sleeping.', russian: 'Кошка спит.' },
    {
      id: 2,
      greek: 'Οι γάτες παίζουν.',
      english: 'The cats are playing.',
      russian: 'Кошки играют.',
    },
  ],
};

const defaultEditableTranslations = {
  en: 'cat',
  en_plural: 'cats',
  ru: 'кошка',
  ru_plural: 'кошки',
};

const defaultEditableExamples = [
  { greek: 'Η γάτα κοιμάται.', english: 'The cat is sleeping.', russian: 'Кошка спит.' },
  { greek: 'Οι γάτες παίζουν.', english: 'The cats are playing.', russian: 'Кошки играют.' },
];

describe('buildWordEntryPayload', () => {
  it('sets lemma and part_of_speech correctly', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      editableTranslations: defaultEditableTranslations,
      editablePronunciation: '/ˈɣa.ta/',
      editableExamples: defaultEditableExamples,
      selectionMap: new Map(),
      verification: null,
    });

    expect(payload.lemma).toBe('γάτα');
    expect(payload.part_of_speech).toBe('noun');
  });

  it('uses editableTranslations for translation fields', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      editableTranslations: {
        en: 'kitty',
        en_plural: 'kitties',
        ru: 'котёнок',
        ru_plural: 'котята',
      },
      editablePronunciation: '',
      editableExamples: [],
      selectionMap: new Map(),
      verification: null,
    });

    expect(payload.translation_en).toBe('kitty');
    expect(payload.translation_en_plural).toBe('kitties');
    expect(payload.translation_ru).toBe('котёнок');
    expect(payload.translation_ru_plural).toBe('котята');
  });

  it('sets translation_en_plural to null when empty string', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      editableTranslations: { en: 'cat', en_plural: '', ru: '', ru_plural: '' },
      editablePronunciation: '',
      editableExamples: [],
      selectionMap: new Map(),
      verification: null,
    });

    expect(payload.translation_en_plural).toBeNull();
    expect(payload.translation_ru).toBeNull();
    expect(payload.translation_ru_plural).toBeNull();
  });

  it('flattens nested cases to flat grammar_data keys', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      editableTranslations: defaultEditableTranslations,
      editablePronunciation: '',
      editableExamples: [],
      selectionMap: new Map(),
      verification: null,
    });

    const gd = payload.grammar_data as Record<string, unknown>;
    expect(gd['nominative_singular']).toBe('η γάτα');
    expect(gd['genitive_singular']).toBe('της γάτας');
    expect(gd['accusative_singular']).toBe('τη γάτα');
    expect(gd['vocative_singular']).toBe('γάτα');
    expect(gd['nominative_plural']).toBe('οι γάτες');
    expect(gd['genitive_plural']).toBe('των γατών');
    expect(gd['accusative_plural']).toBe('τις γάτες');
    expect(gd['vocative_plural']).toBe('γάτες');
    expect(gd['gender']).toBe('feminine');
    expect(gd['declension_group']).toBe('feminine_a');
  });

  it('generates example IDs as ex_{asciiLemma}{index} (0-based)', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      editableTranslations: defaultEditableTranslations,
      editablePronunciation: '',
      editableExamples: defaultEditableExamples,
      selectionMap: new Map(),
      verification: null,
    });

    expect(payload.examples).toHaveLength(2);
    expect(payload.examples![0].id).toBe('ex_gata0');
    expect(payload.examples![1].id).toBe('ex_gata1');
  });

  it('uses editablePronunciation when no verification selection', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      editableTranslations: defaultEditableTranslations,
      editablePronunciation: '/custom/',
      editableExamples: [],
      selectionMap: new Map(),
      verification: null,
    });

    expect(payload.pronunciation).toBe('/custom/');
  });

  it('uses verification primary value for pronunciation when selected', () => {
    const verif = {
      local: null,
      cross_ai: {
        comparisons: [
          {
            field_path: 'pronunciation',
            primary_value: '/verified/',
            secondary_value: '/other/',
            agrees: false,
          },
        ],
      } as CrossAIVerificationResult,
    };

    const map = new Map<string, SelectionSource>([['pronunciation', 'primary']]);
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      editableTranslations: defaultEditableTranslations,
      editablePronunciation: '/editable/',
      editableExamples: [],
      selectionMap: map,
      verification: verif,
    });

    expect(payload.pronunciation).toBe('/verified/');
  });

  it('sets pronunciation to null when both sources are empty', () => {
    const payload = buildWordEntryPayload({
      generation: { ...mockGeneration, pronunciation: '' },
      editableTranslations: defaultEditableTranslations,
      editablePronunciation: '',
      editableExamples: [],
      selectionMap: new Map(),
      verification: null,
    });

    expect(payload.pronunciation).toBeNull();
  });

  it('resolves grammar_data field via selectionMap (secondary source)', () => {
    const verif = {
      local: null,
      cross_ai: {
        comparisons: [
          {
            field_path: 'grammar_data.gender',
            primary_value: 'feminine',
            secondary_value: 'neuter',
            agrees: false,
          },
        ],
      } as CrossAIVerificationResult,
    };

    const map = new Map<string, SelectionSource>([['grammar_data.gender', 'secondary']]);
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      editableTranslations: defaultEditableTranslations,
      editablePronunciation: '',
      editableExamples: [],
      selectionMap: map,
      verification: verif,
    });

    const gd = payload.grammar_data as Record<string, unknown>;
    expect(gd['gender']).toBe('neuter');
  });

  it('handles empty editableExamples (returns empty array)', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      editableTranslations: defaultEditableTranslations,
      editablePronunciation: '',
      editableExamples: [],
      selectionMap: new Map(),
      verification: null,
    });

    expect(payload.examples).toHaveLength(0);
  });
});
