// src/types/grammar.ts

/**
 * Grammar data types for vocabulary cards.
 * These types match the backend Pydantic schemas in src/schemas/card.py.
 * All field names use snake_case to match API responses.
 */

// ============================================================================
// Part of Speech
// ============================================================================

/**
 * Part of speech classification for vocabulary words.
 */
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb';

// ============================================================================
// CEFR Levels
// ============================================================================

/**
 * CEFR language proficiency levels (A1-C2).
 */
export type DeckLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// ============================================================================
// Noun Types
// ============================================================================

/**
 * Greek grammatical gender for nouns.
 */
export type NounGender = 'masculine' | 'feminine' | 'neuter';

/**
 * Noun grammar data with gender and all case forms (singular and plural).
 * Greek has 4 cases: nominative, genitive, accusative, vocative.
 */
export interface NounData {
  gender: NounGender;
  nominative_singular: string;
  genitive_singular: string;
  accusative_singular: string;
  vocative_singular: string;
  nominative_plural: string;
  genitive_plural: string;
  accusative_plural: string;
  vocative_plural: string;
}

/** V2 nested case structure for nouns */
interface NounCaseForms {
  nominative?: string;
  genitive?: string;
  accusative?: string;
  vocative?: string;
}

interface NounCasesV2 {
  singular?: NounCaseForms;
  plural?: NounCaseForms;
}

/** V2 noun grammar data with nested cases */
export interface NounDataV2 {
  gender: NounGender;
  declension_group?: string;
  cases: NounCasesV2;
}

/** Union type accepting either V1 flat or V2 nested format */
export type NounDataAny = NounData | NounDataV2;

// ============================================================================
// Verb Types
// ============================================================================

/**
 * Greek verb voice (active or passive).
 */
export type VerbVoice = 'active' | 'passive';

/**
 * Verb grammar data with voice and full conjugation forms.
 * Contains 32 forms: 6 persons x 5 tenses + 2 imperative forms.
 *
 * Tenses:
 * - Present (6 forms: 1s, 2s, 3s, 1p, 2p, 3p)
 * - Imperfect (6 forms)
 * - Past/Aorist (6 forms)
 * - Future (6 forms)
 * - Perfect (6 forms)
 * - Imperative (2 forms: 2s, 2p)
 */
export interface VerbData {
  voice: VerbVoice;
  // Present tense
  present_1s: string;
  present_2s: string;
  present_3s: string;
  present_1p: string;
  present_2p: string;
  present_3p: string;
  // Imperfect tense
  imperfect_1s: string;
  imperfect_2s: string;
  imperfect_3s: string;
  imperfect_1p: string;
  imperfect_2p: string;
  imperfect_3p: string;
  // Past (aorist) tense
  past_1s: string;
  past_2s: string;
  past_3s: string;
  past_1p: string;
  past_2p: string;
  past_3p: string;
  // Future tense
  future_1s: string;
  future_2s: string;
  future_3s: string;
  future_1p: string;
  future_2p: string;
  future_3p: string;
  // Perfect tense
  perfect_1s: string;
  perfect_2s: string;
  perfect_3s: string;
  perfect_1p: string;
  perfect_2p: string;
  perfect_3p: string;
  // Imperative
  imperative_2s: string;
  imperative_2p: string;
}

// ============================================================================
// Adjective Types
// ============================================================================

/**
 * Adjective grammar data with declensions for all genders and comparison forms.
 * Contains 24 declension forms (8 per gender) + 2 comparison forms.
 *
 * Each gender has 8 forms:
 * - 4 cases (nominative, genitive, accusative, vocative)
 * - 2 numbers (singular, plural)
 */
export interface AdjectiveData {
  // Masculine forms
  masculine_nom_sg: string;
  masculine_gen_sg: string;
  masculine_acc_sg: string;
  masculine_voc_sg: string;
  masculine_nom_pl: string;
  masculine_gen_pl: string;
  masculine_acc_pl: string;
  masculine_voc_pl: string;
  // Feminine forms
  feminine_nom_sg: string;
  feminine_gen_sg: string;
  feminine_acc_sg: string;
  feminine_voc_sg: string;
  feminine_nom_pl: string;
  feminine_gen_pl: string;
  feminine_acc_pl: string;
  feminine_voc_pl: string;
  // Neuter forms
  neuter_nom_sg: string;
  neuter_gen_sg: string;
  neuter_acc_sg: string;
  neuter_voc_sg: string;
  neuter_nom_pl: string;
  neuter_gen_pl: string;
  neuter_acc_pl: string;
  neuter_voc_pl: string;
  // Comparison forms
  comparative: string;
  superlative: string;
}

// ============================================================================
// Adverb Types
// ============================================================================

/**
 * Adverb grammar data with comparison forms.
 */
export interface AdverbData {
  comparative: string;
  superlative: string;
}

// ============================================================================
// Example Types
// ============================================================================

/**
 * Structured example sentence with trilingual translations.
 * Used for showing vocabulary in context.
 */
export interface Example {
  greek: string;
  english: string;
  russian: string;
  tense?: string | null;
  id?: string;
  audio_url?: string | null;
}
