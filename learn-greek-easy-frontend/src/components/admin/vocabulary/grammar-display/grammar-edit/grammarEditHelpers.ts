// src/components/admin/vocabulary/grammar-display/grammar-edit/grammarEditHelpers.ts

import { normalizeGrammarData } from '../grammarNormalizer';

// --- Noun: 9 fields ---
export const NOUN_FIELDS = [
  'gender',
  'nominative_singular',
  'nominative_plural',
  'genitive_singular',
  'genitive_plural',
  'accusative_singular',
  'accusative_plural',
  'vocative_singular',
  'vocative_plural',
] as const;

// --- Verb: 33 fields ---
const TENSES = ['present', 'imperfect', 'past', 'future', 'perfect'] as const;
const PERSONS = ['1s', '2s', '3s', '1p', '2p', '3p'] as const;
export const VERB_FIELDS: readonly string[] = [
  'voice',
  ...TENSES.flatMap((t) => PERSONS.map((p) => `${t}_${p}`)),
  'imperative_2s',
  'imperative_2p',
];

// --- Adjective: 26 fields ---
const GENDERS = ['masculine', 'feminine', 'neuter'] as const;
const CASES = ['nom', 'gen', 'acc', 'voc'] as const;
const NUMBERS = ['sg', 'pl'] as const;
export const ADJECTIVE_FIELDS: readonly string[] = [
  ...GENDERS.flatMap((g) => CASES.flatMap((c) => NUMBERS.map((n) => `${g}_${c}_${n}`))),
  'comparative',
  'superlative',
];

// --- Adverb: 2 fields ---
export const ADVERB_FIELDS = ['comparative', 'superlative'] as const;

export function getFieldKeysForPOS(pos: string): readonly string[] {
  switch (pos) {
    case 'noun':
      return NOUN_FIELDS;
    case 'verb':
      return VERB_FIELDS;
    case 'adjective':
      return ADJECTIVE_FIELDS;
    case 'adverb':
      return ADVERB_FIELDS;
    default:
      return [];
  }
}

export function buildFormState(
  grammarData: Record<string, unknown> | null,
  pos: string
): Record<string, string> {
  const keys = getFieldKeysForPOS(pos);
  const normalized = normalizeGrammarData(grammarData, pos);
  const state: Record<string, string> = {};
  for (const key of keys) {
    state[key] = (normalized[key] as string | null | undefined) ?? '';
  }
  return state;
}

export function buildGrammarPayload(
  formState: Record<string, string>
): Record<string, string | null> {
  const payload: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(formState)) {
    payload[key] = value.trim() === '' ? null : value.trim();
  }
  return payload;
}

export function hasFormChanges(
  current: Record<string, string>,
  original: Record<string, string>
): boolean {
  const allKeys = new Set([...Object.keys(current), ...Object.keys(original)]);
  for (const key of allKeys) {
    if ((current[key] ?? '') !== (original[key] ?? '')) {
      return true;
    }
  }
  return false;
}
