/**
 * Unit tests for nounPayloadBuilder utilities
 *
 * Covers:
 * - toAsciiLemma: Greek → Latin transliteration, diacritic stripping
 * - buildWordEntryPayload: flat grammar_data, example IDs, translation fields, resolvedValues
 * - initializeResolvedValues: pill state seeding from generation + verification
 */

import { describe, it, expect } from 'vitest';

import type { PillState } from '@/components/admin/UnifiedVerificationTable';
import type { CrossAIVerificationResult, VerificationSummary } from '@/services/adminAPI';

import {
  toAsciiLemma,
  buildWordEntryPayload,
  initializeResolvedValues,
  EDITABLE_FIELDS,
} from '../nounPayloadBuilder';

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

const defaultEditableExamples = [
  { greek: 'Η γάτα κοιμάται.', english: 'The cat is sleeping.', russian: 'Кошка спит.' },
  { greek: 'Οι γάτες παίζουν.', english: 'The cats are playing.', russian: 'Кошки играют.' },
];

function makeMap(entries: Record<string, string>): Map<string, PillState> {
  const map = new Map<string, PillState>();
  for (const [key, value] of Object.entries(entries)) {
    map.set(key, { value, source: 'auto', status: 'agreed' });
  }
  return map;
}

function defaultResolvedValues(): Map<string, PillState> {
  return makeMap({
    translation_en: 'cat',
    translation_en_plural: 'cats',
    translation_ru: 'кошка',
    translation_ru_plural: 'кошки',
    pronunciation: '/ˈɣa.ta/',
  });
}

describe('buildWordEntryPayload', () => {
  it('sets lemma and part_of_speech correctly', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: defaultResolvedValues(),
      editableExamples: defaultEditableExamples,
    });

    expect(payload.lemma).toBe('γάτα');
    expect(payload.part_of_speech).toBe('noun');
  });

  it('uses resolved lemma when present in resolvedValues', () => {
    const map = makeMap({ lemma: 'σκύλος' });
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: map,
      editableExamples: [],
    });

    expect(payload.lemma).toBe('σκύλος');
  });

  it('uses resolved lemma ASCII form for example IDs', () => {
    const map = makeMap({ lemma: 'σκύλος' });
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: map,
      editableExamples: defaultEditableExamples,
    });

    expect(payload.examples![0].id).toBe('ex_skulos0');
    expect(payload.examples![1].id).toBe('ex_skulos1');
  });

  it('uses resolvedValues for translation fields', () => {
    const map = makeMap({
      translation_en: 'kitty',
      translation_en_plural: 'kitties',
      translation_ru: 'котёнок',
      translation_ru_plural: 'котята',
    });
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: map,
      editableExamples: [],
    });

    expect(payload.translation_en).toBe('kitty');
    expect(payload.translation_en_plural).toBe('kitties');
    expect(payload.translation_ru).toBe('котёнок');
    expect(payload.translation_ru_plural).toBe('котята');
  });

  it('sets translation_en_plural to null when resolved value is empty string', () => {
    const map = makeMap({
      translation_en: 'cat',
      translation_en_plural: '',
      translation_ru: '',
      translation_ru_plural: '',
    });
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: map,
      editableExamples: [],
    });

    expect(payload.translation_en_plural).toBeNull();
    expect(payload.translation_ru).toBeNull();
    expect(payload.translation_ru_plural).toBeNull();
  });

  it('falls back to generation for translation fields not in resolvedValues', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: new Map(),
      editableExamples: [],
    });

    expect(payload.translation_en).toBe('cat');
    expect(payload.translation_en_plural).toBe('cats');
    expect(payload.translation_ru).toBe('кошка');
    expect(payload.translation_ru_plural).toBe('кошки');
  });

  it('flattens nested cases to flat grammar_data keys', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: defaultResolvedValues(),
      editableExamples: [],
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

  it('overlays grammar fields from resolvedValues when present', () => {
    const map = makeMap({
      'grammar_data.gender': 'neuter',
      'cases.singular.nominative': 'το σπίτι',
    });
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: map,
      editableExamples: [],
    });

    const gd = payload.grammar_data as Record<string, unknown>;
    expect(gd['gender']).toBe('neuter');
    expect(gd['nominative_singular']).toBe('το σπίτι');
    // Non-overridden fields still come from generation
    expect(gd['genitive_singular']).toBe('της γάτας');
  });

  it('generates example IDs as ex_{asciiLemma}{index} (0-based)', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: defaultResolvedValues(),
      editableExamples: defaultEditableExamples,
    });

    expect(payload.examples).toHaveLength(2);
    expect(payload.examples![0].id).toBe('ex_gata0');
    expect(payload.examples![1].id).toBe('ex_gata1');
  });

  it('uses pronunciation from resolvedValues', () => {
    const map = makeMap({ pronunciation: '/custom/' });
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: map,
      editableExamples: [],
    });

    expect(payload.pronunciation).toBe('/custom/');
  });

  it('falls back to generation pronunciation when not in resolvedValues', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: new Map(),
      editableExamples: [],
    });

    expect(payload.pronunciation).toBe('/ˈɣa.ta/');
  });

  it('sets pronunciation to null when resolved value is empty string', () => {
    const map = makeMap({ pronunciation: '' });
    const payload = buildWordEntryPayload({
      generation: { ...mockGeneration, pronunciation: '' },
      resolvedValues: map,
      editableExamples: [],
    });

    expect(payload.pronunciation).toBeNull();
  });

  it('handles empty editableExamples (returns empty array)', () => {
    const payload = buildWordEntryPayload({
      generation: mockGeneration,
      resolvedValues: defaultResolvedValues(),
      editableExamples: [],
    });

    expect(payload.examples).toHaveLength(0);
  });
});

// ============================================
// initializeResolvedValues
// ============================================

const mockCrossAI: CrossAIVerificationResult = {
  comparisons: [
    {
      field_path: 'cases.singular.nominative',
      primary_value: 'η γάτα',
      secondary_value: 'γάτα',
      agrees: true,
      weight: 1,
    },
    {
      field_path: 'grammar_data.gender',
      primary_value: 'feminine',
      secondary_value: 'neuter',
      agrees: false,
      weight: 1,
    },
  ],
  overall_agreement: 0.5,
  secondary_model: 'test-model',
  secondary_generation: null,
  error: null,
};

const mockVerification: VerificationSummary = {
  local: null,
  wiktionary_local: null,
  cross_ai: mockCrossAI,
  combined_tier: 'quick_review',
  morphology_source: 'llm',
};

describe('initializeResolvedValues', () => {
  it('returns empty map when generation is null', () => {
    const map = initializeResolvedValues(null, null);
    expect(map.size).toBe(0);
  });

  it('includes lemma in the resolved values map', () => {
    const map = initializeResolvedValues(mockGeneration, null);
    expect(map.has('lemma')).toBe(true);
    expect(map.get('lemma')?.value).toBe('γάτα');
  });

  it('seeds agreed pills when cross-AI agrees', () => {
    const map = initializeResolvedValues(mockGeneration, mockVerification);
    const pill = map.get('cases.singular.nominative');
    expect(pill).toEqual({ value: 'η γάτα', source: 'auto', status: 'agreed' });
  });

  it('seeds unresolved pills when cross-AI disagrees', () => {
    const map = initializeResolvedValues(mockGeneration, mockVerification);
    const pill = map.get('grammar_data.gender');
    expect(pill).toEqual({ value: 'feminine', source: 'auto', status: 'unresolved' });
  });

  it('seeds editable pills for translation/pronunciation fields without cross-AI', () => {
    const map = initializeResolvedValues(mockGeneration, null);
    for (const field of EDITABLE_FIELDS) {
      const pill = map.get(field);
      expect(pill?.status).toBe('editable');
      expect(pill?.source).toBe('auto');
    }
  });

  it('seeds agreed pills for non-editable fields without cross-AI', () => {
    const map = initializeResolvedValues(mockGeneration, null);
    const pill = map.get('cases.singular.nominative');
    expect(pill).toEqual({ value: 'η γάτα', source: 'auto', status: 'agreed' });
  });

  it('handles null verification (falls back to editable/agreed based on field type)', () => {
    const map = initializeResolvedValues(mockGeneration, null);
    // translation field → editable
    expect(map.get('translation_en')?.status).toBe('editable');
    // grammar field → agreed
    expect(map.get('grammar_data.gender')?.status).toBe('agreed');
  });

  it('seeds null plural translations as empty string', () => {
    const gen = { ...mockGeneration, translation_en_plural: null, translation_ru_plural: null };
    const map = initializeResolvedValues(gen, null);
    expect(map.get('translation_en_plural')?.value).toBe('');
    expect(map.get('translation_ru_plural')?.value).toBe('');
  });

  it('includes all grammar case keys', () => {
    const map = initializeResolvedValues(mockGeneration, null);
    for (const key of [
      'cases.singular.nominative',
      'cases.singular.genitive',
      'cases.singular.accusative',
      'cases.singular.vocative',
      'cases.plural.nominative',
      'cases.plural.genitive',
      'cases.plural.accusative',
      'cases.plural.vocative',
    ]) {
      expect(map.has(key)).toBe(true);
    }
  });

  it('uses primary_value (not secondary) for cross-AI seeded pills', () => {
    const map = initializeResolvedValues(mockGeneration, mockVerification);
    // gender disagrees: primary=feminine, secondary=neuter → seeds primary
    expect(map.get('grammar_data.gender')?.value).toBe('feminine');
  });

  it('treats all fields as agreed when cross-AI error result has populated comparisons (primary_only_result)', () => {
    // Simulates the primary_only_result() path: error is set but comparisons are populated,
    // all agrees=true with secondary_value='—'
    const primaryOnlyCrossAI: CrossAIVerificationResult = {
      comparisons: [
        {
          field_path: 'cases.singular.nominative',
          primary_value: 'η γάτα',
          secondary_value: '—',
          agrees: true,
          weight: 2.0,
        },
        {
          field_path: 'grammar_data.gender',
          primary_value: 'feminine',
          secondary_value: '—',
          agrees: true,
          weight: 3.0,
        },
        {
          field_path: 'translation_en',
          primary_value: 'cat',
          secondary_value: '—',
          agrees: true,
          weight: 1.0,
        },
      ],
      overall_agreement: null,
      secondary_model: 'qwen/qwen3-30b-a3b-instruct-2507',
      secondary_generation: null,
      error: 'Secondary generation failed or skipped',
    };
    const verification: VerificationSummary = {
      local: null,
      wiktionary_local: null,
      cross_ai: primaryOnlyCrossAI,
      combined_tier: 'quick_review',
      morphology_source: 'llm',
    };

    const map = initializeResolvedValues(mockGeneration, verification);

    // All populated fields from comparisons should be 'agreed' (agrees=true)
    expect(map.get('cases.singular.nominative')?.status).toBe('agreed');
    expect(map.get('grammar_data.gender')?.status).toBe('agreed');
    expect(map.get('translation_en')?.status).toBe('agreed');
    // Primary values from the comparisons are used
    expect(map.get('cases.singular.nominative')?.value).toBe('η γάτα');
    expect(map.get('grammar_data.gender')?.value).toBe('feminine');
    expect(map.get('translation_en')?.value).toBe('cat');
  });

  it('L1+L2 same reference_value → pill status is agreed', () => {
    const local = {
      fields: [
        {
          field_path: 'cases.singular.nominative',
          status: 'pass' as const,
          checks: [
            {
              check_name: 'spell',
              status: 'pass' as const,
              message: null,
              reference_value: 'η γάτα',
              reference_source: 'lexicon',
            },
          ],
        },
      ],
      tier: 'auto_approve' as const,
      stages_skipped: [],
      summary: '',
    };
    const wiktionaryLocal = {
      fields: [
        {
          field_path: 'cases.singular.nominative',
          status: 'pass' as const,
          checks: [
            {
              check_name: 'spell',
              status: 'pass' as const,
              message: null,
              reference_value: 'η γάτα',
              reference_source: 'wiktionary',
            },
          ],
        },
      ],
      tier: 'auto_approve' as const,
      stages_skipped: [],
      summary: '',
    };
    const verification: VerificationSummary = {
      local,
      wiktionary_local: wiktionaryLocal,
      cross_ai: null,
      combined_tier: 'auto_approve',
      morphology_source: 'both',
    };
    const map = initializeResolvedValues(mockGeneration, verification);
    expect(map.get('cases.singular.nominative')?.status).toBe('agreed');
  });

  it('L1+L2 different reference_values → pill status is unresolved', () => {
    const local = {
      fields: [
        {
          field_path: 'cases.singular.nominative',
          status: 'pass' as const,
          checks: [
            {
              check_name: 'spell',
              status: 'pass' as const,
              message: null,
              reference_value: 'η γάτα',
              reference_source: 'lexicon',
            },
          ],
        },
      ],
      tier: 'auto_approve' as const,
      stages_skipped: [],
      summary: '',
    };
    const wiktionaryLocal = {
      fields: [
        {
          field_path: 'cases.singular.nominative',
          status: 'warn' as const,
          checks: [
            {
              check_name: 'spell',
              status: 'warn' as const,
              message: null,
              reference_value: 'γάτα',
              reference_source: 'wiktionary',
            },
          ],
        },
      ],
      tier: 'quick_review' as const,
      stages_skipped: [],
      summary: '',
    };
    const verification: VerificationSummary = {
      local,
      wiktionary_local: wiktionaryLocal,
      cross_ai: null,
      combined_tier: 'quick_review',
      morphology_source: 'both',
    };
    const map = initializeResolvedValues(mockGeneration, verification);
    expect(map.get('cases.singular.nominative')?.status).toBe('unresolved');
  });

  it('cross-AI takes priority over L1+L2 agreement', () => {
    const local = {
      fields: [
        {
          field_path: 'cases.singular.nominative',
          status: 'pass' as const,
          checks: [
            {
              check_name: 'spell',
              status: 'pass' as const,
              message: null,
              reference_value: 'η γάτα',
              reference_source: 'lexicon',
            },
          ],
        },
      ],
      tier: 'auto_approve' as const,
      stages_skipped: [],
      summary: '',
    };
    const wiktionaryLocal = {
      fields: [
        {
          field_path: 'cases.singular.nominative',
          status: 'pass' as const,
          checks: [
            {
              check_name: 'spell',
              status: 'pass' as const,
              message: null,
              reference_value: 'η γάτα',
              reference_source: 'wiktionary',
            },
          ],
        },
      ],
      tier: 'auto_approve' as const,
      stages_skipped: [],
      summary: '',
    };
    // cross-AI disagrees on this field
    const crossAI: CrossAIVerificationResult = {
      comparisons: [
        {
          field_path: 'cases.singular.nominative',
          primary_value: 'η γάτα',
          secondary_value: 'γάτα',
          agrees: false,
          weight: 1,
        },
      ],
      overall_agreement: 0,
      secondary_model: 'test-model',
      secondary_generation: null,
      error: null,
    };
    const verification: VerificationSummary = {
      local,
      wiktionary_local: wiktionaryLocal,
      cross_ai: crossAI,
      combined_tier: 'manual_review',
      morphology_source: 'both',
    };
    const map = initializeResolvedValues(mockGeneration, verification);
    // cross-AI disagreement takes priority: should be unresolved (not agreed from L1+L2)
    expect(map.get('cases.singular.nominative')?.status).toBe('unresolved');
  });
});
