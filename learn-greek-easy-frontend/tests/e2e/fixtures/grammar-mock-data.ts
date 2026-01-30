/**
 * Mock Data for Grammar UI E2E Tests
 *
 * These mock cards and deck data are used for deterministic E2E testing
 * via API mocking, avoiding reliance on seeded database data.
 *
 * Extracted from visual tests: tests/visual/grammar-ui.visual.spec.ts
 *
 * Note: Types are defined inline to avoid Vite path alias issues in E2E tests.
 */

// ============================================================================
// INLINE TYPE DEFINITIONS (to avoid path alias issues)
// ============================================================================

interface SpacedRepetitionData {
  cardId: string;
  deckId: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  state: 'new' | 'learning' | 'review' | 'relearning' | 'mastered';
  step: number;
  dueDate: Date | null;
  lastReviewed: Date | null;
  reviewCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
}

interface Example {
  greek: string;
  english?: string;
  russian?: string;
}

interface NounData {
  gender: 'masculine' | 'feminine' | 'neuter';
  nominative_singular: string;
  nominative_plural: string;
  genitive_singular: string;
  genitive_plural: string;
  accusative_singular: string;
  accusative_plural: string;
  vocative_singular: string;
  vocative_plural: string;
}

interface VerbData {
  voice: 'active' | 'passive';
  present_1s?: string;
  present_2s?: string;
  present_3s?: string;
  present_1p?: string;
  present_2p?: string;
  present_3p?: string;
  imperfect_1s?: string;
  imperfect_2s?: string;
  imperfect_3s?: string;
  imperfect_1p?: string;
  imperfect_2p?: string;
  imperfect_3p?: string;
  past_1s?: string;
  past_2s?: string;
  past_3s?: string;
  past_1p?: string;
  past_2p?: string;
  past_3p?: string;
  future_1s?: string;
  future_2s?: string;
  future_3s?: string;
  future_1p?: string;
  future_2p?: string;
  future_3p?: string;
  perfect_1s?: string;
  perfect_2s?: string;
  perfect_3s?: string;
  perfect_1p?: string;
  perfect_2p?: string;
  perfect_3p?: string;
  imperative_2s?: string;
  imperative_2p?: string;
}

interface AdjectiveData {
  masculine_nom_sg: string;
  masculine_gen_sg: string;
  masculine_acc_sg: string;
  masculine_voc_sg: string;
  masculine_nom_pl: string;
  masculine_gen_pl: string;
  masculine_acc_pl: string;
  masculine_voc_pl: string;
  feminine_nom_sg: string;
  feminine_gen_sg: string;
  feminine_acc_sg: string;
  feminine_voc_sg: string;
  feminine_nom_pl: string;
  feminine_gen_pl: string;
  feminine_acc_pl: string;
  feminine_voc_pl: string;
  neuter_nom_sg: string;
  neuter_gen_sg: string;
  neuter_acc_sg: string;
  neuter_voc_sg: string;
  neuter_nom_pl: string;
  neuter_gen_pl: string;
  neuter_acc_pl: string;
  neuter_voc_pl: string;
  comparative?: string;
  superlative?: string;
}

interface AdverbData {
  comparative?: string;
  superlative?: string;
}

export interface MockCard {
  id: string;
  front: string;
  back: string;
  deck_id: string;
  word?: string;
  translation?: string;
  back_text_ru?: string;
  part_of_speech?: 'noun' | 'verb' | 'adjective' | 'adverb';
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  noun_data?: NounData;
  verb_data?: VerbData;
  adjective_data?: AdjectiveData;
  adverb_data?: AdverbData;
  examples?: Example[];
  srData: SpacedRepetitionData;
}

// ============================================================================
// MOCK DECK
// ============================================================================

export const mockDeck = {
  id: 'deck-001',
  name: 'Grammar Test Deck',
  description: 'Test deck for grammar UI E2E tests',
  level: 'A1',
  type: 'vocabulary',
  card_count: 100,
  is_active: true,
  is_premium: false,
  created_at: '2026-01-01T00:00:00Z',
};

// ============================================================================
// BASE SR DATA (shared across cards)
// ============================================================================

const baseSRData: Omit<SpacedRepetitionData, 'cardId' | 'deckId'> = {
  interval: 0,
  easeFactor: 2.5,
  repetitions: 0,
  state: 'new',
  step: 0,
  dueDate: null,
  lastReviewed: null,
  reviewCount: 0,
  successCount: 0,
  failureCount: 0,
  successRate: 0,
};

// ============================================================================
// NOUN CARD
// ============================================================================

export const mockNounCard: MockCard = {
  id: 'noun-card-001',
  front: 'to spiti',
  back: 'the house',
  deck_id: mockDeck.id,
  word: 'to spiti',
  translation: 'the house',
  back_text_ru: 'dom',
  part_of_speech: 'noun',
  level: 'A1',
  noun_data: {
    gender: 'neuter',
    nominative_singular: 'to spiti',
    nominative_plural: 'ta spitia',
    genitive_singular: 'tou spitiou',
    genitive_plural: 'ton spitiou',
    accusative_singular: 'to spiti',
    accusative_plural: 'ta spitia',
    vocative_singular: 'spiti',
    vocative_plural: 'spitia',
  },
  examples: [
    {
      greek: 'To spiti mou einai megalo.',
      english: 'My house is big.',
      russian: 'Moy dom bolshoy.',
    },
  ],
  srData: {
    cardId: 'noun-card-001',
    deckId: mockDeck.id,
    ...baseSRData,
  },
};

// ============================================================================
// VERB CARD - COMPLETE (all 6 tenses)
// ============================================================================

export const mockVerbCardComplete: MockCard = {
  id: 'verb-card-001',
  front: 'grafo',
  back: 'to write',
  deck_id: mockDeck.id,
  word: 'grafo',
  translation: 'to write',
  back_text_ru: 'pisat',
  part_of_speech: 'verb',
  level: 'A1',
  verb_data: {
    voice: 'active',
    // Present tense
    present_1s: 'grafo',
    present_2s: 'grafeis',
    present_3s: 'grafei',
    present_1p: 'grafoume',
    present_2p: 'grafete',
    present_3p: 'grafoun',
    // Imperfect tense
    imperfect_1s: 'egrafa',
    imperfect_2s: 'egrafes',
    imperfect_3s: 'egrafe',
    imperfect_1p: 'grafame',
    imperfect_2p: 'grafate',
    imperfect_3p: 'egrafan',
    // Past (Aorist) tense
    past_1s: 'egrapsa',
    past_2s: 'egrapses',
    past_3s: 'egrapse',
    past_1p: 'grapsame',
    past_2p: 'grapsate',
    past_3p: 'egrapsan',
    // Future tense
    future_1s: 'tha grapso',
    future_2s: 'tha grapseis',
    future_3s: 'tha grapsei',
    future_1p: 'tha grapsoume',
    future_2p: 'tha grapsete',
    future_3p: 'tha grapsoun',
    // Perfect tense
    perfect_1s: 'echo grapsei',
    perfect_2s: 'echeis grapsei',
    perfect_3s: 'echei grapsei',
    perfect_1p: 'echoume grapsei',
    perfect_2p: 'echete grapsei',
    perfect_3p: 'echoun grapsei',
    // Imperative
    imperative_2s: 'grapse',
    imperative_2p: 'grapste',
  },
  examples: [
    {
      greek: 'Grafo ena gramma.',
      english: 'I write a letter.',
      russian: 'Ya pishu pismo.',
    },
    {
      greek: 'Tha grapsoume mazi.',
      english: 'We will write together.',
      russian: 'My napishem vmeste.',
    },
  ],
  srData: {
    cardId: 'verb-card-001',
    deckId: mockDeck.id,
    ...baseSRData,
  },
};

// ============================================================================
// VERB CARD - PARTIAL (only present + imperative, for disabled tabs test)
// ============================================================================

export const mockVerbCardPartial: MockCard = {
  id: 'verb-card-partial',
  front: 'trecho',
  back: 'to run',
  deck_id: mockDeck.id,
  word: 'trecho',
  translation: 'to run',
  back_text_ru: 'bezhat',
  part_of_speech: 'verb',
  level: 'A1',
  verb_data: {
    voice: 'active',
    // Present tense only
    present_1s: 'trecho',
    present_2s: 'trecheis',
    present_3s: 'trechei',
    present_1p: 'trechoume',
    present_2p: 'trechete',
    present_3p: 'trechoun',
    // Imperative only
    imperative_2s: 'trexe',
    imperative_2p: 'trexte',
    // All other tenses are empty/missing
  },
  examples: [
    {
      greek: 'Trecho stin paralia.',
      english: 'I run on the beach.',
      russian: 'Ya begu po plyazhu.',
    },
  ],
  srData: {
    cardId: 'verb-card-partial',
    deckId: mockDeck.id,
    ...baseSRData,
  },
};

// ============================================================================
// ADJECTIVE CARD (all 3 genders)
// ============================================================================

export const mockAdjectiveCard: MockCard = {
  id: 'adjective-card-001',
  front: 'megalos',
  back: 'big, large',
  deck_id: mockDeck.id,
  word: 'megalos',
  translation: 'big, large',
  back_text_ru: 'bolshoy',
  part_of_speech: 'adjective',
  level: 'A1',
  adjective_data: {
    // Masculine forms
    masculine_nom_sg: 'megalos',
    masculine_gen_sg: 'megalou',
    masculine_acc_sg: 'megalo',
    masculine_voc_sg: 'megale',
    masculine_nom_pl: 'megaloi',
    masculine_gen_pl: 'megalon',
    masculine_acc_pl: 'megalous',
    masculine_voc_pl: 'megaloi',
    // Feminine forms
    feminine_nom_sg: 'megali',
    feminine_gen_sg: 'megalis',
    feminine_acc_sg: 'megali',
    feminine_voc_sg: 'megali',
    feminine_nom_pl: 'megales',
    feminine_gen_pl: 'megalon',
    feminine_acc_pl: 'megales',
    feminine_voc_pl: 'megales',
    // Neuter forms
    neuter_nom_sg: 'megalo',
    neuter_gen_sg: 'megalou',
    neuter_acc_sg: 'megalo',
    neuter_voc_sg: 'megalo',
    neuter_nom_pl: 'megala',
    neuter_gen_pl: 'megalon',
    neuter_acc_pl: 'megala',
    neuter_voc_pl: 'megala',
    // Comparison
    comparative: 'megalyteros',
    superlative: 'o megalyteros',
  },
  examples: [
    {
      greek: 'To spiti einai megalo.',
      english: 'The house is big.',
      russian: 'Dom bolshoy.',
    },
  ],
  srData: {
    cardId: 'adjective-card-001',
    deckId: mockDeck.id,
    ...baseSRData,
  },
};

// ============================================================================
// ADVERB CARD
// ============================================================================

export const mockAdverbCard: MockCard = {
  id: 'adverb-card-001',
  front: 'grigora',
  back: 'quickly',
  deck_id: mockDeck.id,
  word: 'grigora',
  translation: 'quickly',
  back_text_ru: 'bystro',
  part_of_speech: 'adverb',
  level: 'A2',
  adverb_data: {
    comparative: 'pio grigora',
    superlative: 'grigorotata',
  },
  examples: [
    {
      greek: 'Trechei poli grigora.',
      english: 'He runs very quickly.',
      russian: 'On bezhit ochen bystro.',
    },
  ],
  srData: {
    cardId: 'adverb-card-001',
    deckId: mockDeck.id,
    ...baseSRData,
  },
};

// ============================================================================
// CARD WITHOUT GRAMMAR DATA
// ============================================================================

export const mockCardNoGrammar: MockCard = {
  id: 'no-grammar-card-001',
  front: 'Kalimera',
  back: 'Good morning',
  deck_id: mockDeck.id,
  word: 'Kalimera',
  translation: 'Good morning',
  back_text_ru: 'Dobroe utro',
  // No part_of_speech set - this is a greeting/phrase
  level: 'A1',
  examples: [],
  srData: {
    cardId: 'no-grammar-card-001',
    deckId: mockDeck.id,
    ...baseSRData,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a study queue response for a given card
 */
export function createStudyQueueResponse(card: MockCard) {
  return {
    deck_id: mockDeck.id,
    cards: [card],
    new_count: 1,
    due_count: 0,
    total_count: 1,
  };
}

/**
 * Create a deck list response
 */
export function createDeckListResponse() {
  return {
    decks: [mockDeck],
    total: 1,
    page: 1,
    page_size: 50,
  };
}

/**
 * Create a deck response
 */
export function createDeckResponse() {
  return mockDeck;
}

/**
 * Create user stats response
 */
export function createUserStatsResponse() {
  return {
    total_cards_learned: 100,
    total_reviews: 500,
    streak_days: 7,
    daily_xp: 50,
  };
}
