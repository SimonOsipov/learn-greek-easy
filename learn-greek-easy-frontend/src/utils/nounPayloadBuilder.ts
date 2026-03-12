import type { PillState } from '@/components/admin/UnifiedVerificationTable';
import type {
  FieldComparisonResult,
  GeneratedNounData,
  VerificationSummary,
} from '@/services/adminAPI';
import type { WordEntryExampleSentence, WordEntryInput } from '@/services/wordEntryAPI';

export interface EditableExample {
  greek: string;
  english: string;
  russian: string;
}

/**
 * Converts a Greek lemma to an ASCII representation for use in IDs.
 * Uses NFD normalization, strips combining diacritics, and maps Greek chars to Latin.
 */
export function toAsciiLemma(greekLemma: string): string {
  const GREEK_TO_LATIN: Record<string, string> = {
    α: 'a',
    β: 'b',
    γ: 'g',
    δ: 'd',
    ε: 'e',
    ζ: 'z',
    η: 'i',
    θ: 'th',
    ι: 'i',
    κ: 'k',
    λ: 'l',
    μ: 'm',
    ν: 'n',
    ξ: 'x',
    ο: 'o',
    π: 'p',
    ρ: 'r',
    σ: 's',
    ς: 's',
    τ: 't',
    υ: 'u',
    φ: 'f',
    χ: 'ch',
    ψ: 'ps',
    ω: 'o',
  };
  // NFD normalize, strip combining diacritics (U+0300–U+036F)
  const normalized = greekLemma.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Map each character: Greek → Latin, else keep if alphanumeric
  return normalized
    .toLowerCase()
    .split('')
    .map((c) => GREEK_TO_LATIN[c] ?? (/[a-z0-9]/.test(c) ? c : ''))
    .join('');
}

export interface BuildPayloadParams {
  generation: GeneratedNounData;
  resolvedValues: Map<string, PillState>;
  editableExamples: EditableExample[];
}

/**
 * Builds a WordEntryInput payload from generated noun data and resolved pill values.
 */
export function buildWordEntryPayload(params: BuildPayloadParams): WordEntryInput {
  const { generation, resolvedValues, editableExamples } = params;

  const cases = generation.grammar_data.cases;

  const resolveField = (key: string, fallback: string | null): string | null =>
    resolvedValues.get(key)?.value ?? fallback;

  const grammar_data: Record<string, unknown> = {
    gender: resolveField('gender', generation.grammar_data.gender),
    declension_group: resolveField('declension_group', generation.grammar_data.declension_group),
    nominative_singular: resolveField('nominative_singular', cases.singular.nominative),
    genitive_singular: resolveField('genitive_singular', cases.singular.genitive),
    accusative_singular: resolveField('accusative_singular', cases.singular.accusative),
    vocative_singular: resolveField('vocative_singular', cases.singular.vocative),
    nominative_plural: resolveField('nominative_plural', cases.plural.nominative),
    genitive_plural: resolveField('genitive_plural', cases.plural.genitive),
    accusative_plural: resolveField('accusative_plural', cases.plural.accusative),
    vocative_plural: resolveField('vocative_plural', cases.plural.vocative),
  };

  const pronunciationValue = resolveField('pronunciation', generation.pronunciation);
  const pronunciation = pronunciationValue || null;

  const asciiLemma = toAsciiLemma(generation.lemma);
  const examples: WordEntryExampleSentence[] = editableExamples.map((ex, i) => ({
    id: `ex_${asciiLemma}${i}`,
    greek: ex.greek,
    english: ex.english || undefined,
    russian: ex.russian || undefined,
  }));

  const translation_en = resolvedValues.get('translation_en')?.value ?? generation.translation_en;
  const translation_en_plural =
    (resolvedValues.get('translation_en_plural')?.value ??
      generation.translation_en_plural ??
      '') ||
    null;
  const translation_ru =
    (resolvedValues.get('translation_ru')?.value ?? generation.translation_ru ?? '') || null;
  const translation_ru_plural =
    (resolvedValues.get('translation_ru_plural')?.value ??
      generation.translation_ru_plural ??
      '') ||
    null;

  return {
    lemma: generation.lemma,
    part_of_speech: 'noun',
    translation_en,
    translation_en_plural,
    translation_ru,
    translation_ru_plural,
    pronunciation,
    grammar_data,
    examples,
  };
}

export const EDITABLE_FIELDS = new Set([
  'translation_en',
  'translation_en_plural',
  'translation_ru',
  'translation_ru_plural',
  'pronunciation',
]);

export function initializeResolvedValues(
  generation: GeneratedNounData | null,
  verification: VerificationSummary | null
): Map<string, PillState> {
  const map = new Map<string, PillState>();
  if (!generation) return map;

  // Build generation values map (flat keys)
  const genValues = new Map<string, string>();
  genValues.set('translation_en', generation.translation_en);
  genValues.set('translation_en_plural', generation.translation_en_plural ?? '');
  genValues.set('translation_ru', generation.translation_ru);
  genValues.set('translation_ru_plural', generation.translation_ru_plural ?? '');
  genValues.set('pronunciation', generation.pronunciation);
  genValues.set('gender', generation.grammar_data.gender);
  genValues.set('declension_group', generation.grammar_data.declension_group);
  const { cases } = generation.grammar_data;
  for (const numKey of ['singular', 'plural'] as const) {
    const caseGroup = cases[numKey];
    if (caseGroup) {
      for (const [caseName, value] of Object.entries(caseGroup)) {
        if (value != null) {
          genValues.set(`${caseName}_${numKey}`, value);
        }
      }
    }
  }

  // Build cross-AI lookup (normalize nested field_path to flat key for lookup)
  const toFlatKey = (path: string): string => {
    if (path.startsWith('cases.')) {
      const parts = path.split('.');
      // 'cases.singular.nominative' -> 'nominative_singular'
      return `${parts[2]}_${parts[1]}`;
    }
    if (path === 'grammar_data.gender') return 'gender';
    if (path === 'grammar_data.declension_group') return 'declension_group';
    return path;
  };

  const crossAIMap = new Map<string, FieldComparisonResult>();
  if (verification?.cross_ai?.comparisons) {
    for (const comp of verification.cross_ai.comparisons) {
      crossAIMap.set(toFlatKey(comp.field_path), comp);
    }
  }

  // Initialize pill states
  for (const [field, genValue] of genValues) {
    const comp = crossAIMap.get(field);
    if (comp) {
      if (comp.agrees) {
        map.set(field, { value: comp.primary_value, source: 'auto', status: 'agreed' });
      } else {
        map.set(field, { value: comp.primary_value, source: 'auto', status: 'unresolved' });
      }
    } else if (EDITABLE_FIELDS.has(field)) {
      map.set(field, { value: genValue, source: 'auto', status: 'editable' });
    } else {
      map.set(field, { value: genValue, source: 'auto', status: 'agreed' });
    }
  }

  return map;
}
