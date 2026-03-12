import type { SelectionSource } from '@/components/admin/UnifiedVerificationTable';
import type {
  GeneratedNounData,
  CrossAIVerificationResult,
  LocalVerificationResult,
} from '@/services/adminAPI';
import type { WordEntryInput, WordEntryExampleSentence } from '@/services/wordEntryAPI';

export interface EditableTranslations {
  en: string;
  en_plural: string;
  ru: string;
  ru_plural: string;
}

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

/**
 * Resolves the value of a field by checking the selectionMap first, then falling back to cross-AI primary.
 * Returns null if no value can be determined.
 */
export function resolveFieldValue(
  fieldPath: string,
  selectionMap: Map<string, SelectionSource>,
  verification: {
    local: LocalVerificationResult | null;
    cross_ai: CrossAIVerificationResult | null;
  } | null
): string | null {
  const source = selectionMap.get(fieldPath);
  if (source) {
    if (source === 'local' && verification?.local) {
      const field = verification.local.fields.find((f) => f.field_path === fieldPath);
      if (field) {
        const check = field.checks.find((c) => c.reference_value != null);
        return check?.reference_value ?? null;
      }
    }
    if (source === 'primary' || source === 'secondary') {
      const comparison = verification?.cross_ai?.comparisons.find(
        (c) => c.field_path === fieldPath
      );
      if (comparison) {
        return source === 'primary' ? comparison.primary_value : comparison.secondary_value;
      }
    }
    return null;
  }
  // Default fallback: use primary_value from cross-AI if available
  const comparison = verification?.cross_ai?.comparisons.find((c) => c.field_path === fieldPath);
  return comparison?.primary_value ?? null;
}

export interface BuildPayloadParams {
  generation: GeneratedNounData;
  editableTranslations: EditableTranslations;
  editablePronunciation: string;
  editableExamples: EditableExample[];
  selectionMap: Map<string, SelectionSource>;
  verification: {
    local: LocalVerificationResult | null;
    cross_ai: CrossAIVerificationResult | null;
  } | null;
}

/**
 * Builds a WordEntryInput payload from generated noun data and admin edits.
 */
export function buildWordEntryPayload(params: BuildPayloadParams): WordEntryInput {
  const {
    generation,
    editableTranslations,
    editablePronunciation,
    editableExamples,
    selectionMap,
    verification,
  } = params;

  const cases = generation.grammar_data.cases;

  // Resolve grammar fields via verification/selection, falling back to generated data
  const resolveCase = (fieldPath: string, fallback: string | null): string | null =>
    resolveFieldValue(fieldPath, selectionMap, verification) ?? fallback;

  const grammar_data: Record<string, unknown> = {
    gender:
      resolveFieldValue('grammar_data.gender', selectionMap, verification) ??
      generation.grammar_data.gender,
    declension_group:
      resolveFieldValue('grammar_data.declension_group', selectionMap, verification) ??
      generation.grammar_data.declension_group,
    nominative_singular: resolveCase('cases.singular.nominative', cases.singular.nominative),
    genitive_singular: resolveCase('cases.singular.genitive', cases.singular.genitive),
    accusative_singular: resolveCase('cases.singular.accusative', cases.singular.accusative),
    vocative_singular: resolveCase('cases.singular.vocative', cases.singular.vocative),
    nominative_plural: resolveCase('cases.plural.nominative', cases.plural.nominative),
    genitive_plural: resolveCase('cases.plural.genitive', cases.plural.genitive),
    accusative_plural: resolveCase('cases.plural.accusative', cases.plural.accusative),
    vocative_plural: resolveCase('cases.plural.vocative', cases.plural.vocative),
  };

  // Pronunciation: use verification selection if present, else editablePronunciation
  const resolvedPronunciation = resolveFieldValue('pronunciation', selectionMap, verification);
  const pronunciation =
    resolvedPronunciation !== null ? resolvedPronunciation || null : editablePronunciation || null;

  const asciiLemma = toAsciiLemma(generation.lemma);
  const examples: WordEntryExampleSentence[] = editableExamples.map((ex, i) => ({
    id: `ex_${asciiLemma}${i}`,
    greek: ex.greek,
    english: ex.english || undefined,
    russian: ex.russian || undefined,
  }));

  return {
    lemma: generation.lemma,
    part_of_speech: 'noun',
    translation_en: editableTranslations.en,
    translation_en_plural: editableTranslations.en_plural || null,
    translation_ru: editableTranslations.ru || null,
    translation_ru_plural: editableTranslations.ru_plural || null,
    pronunciation,
    grammar_data,
    examples,
  };
}
