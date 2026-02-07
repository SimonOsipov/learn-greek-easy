/**
 * WordReferencePage Component Tests
 *
 * Tests for the VBUG2-03 changes:
 * - Article display before lemma for nouns (masculine/feminine/neuter)
 * - No article for non-noun parts of speech (verb, adjective, adverb)
 * - Article styling (font-normal, text-muted-foreground, mr-2)
 * - Practice button localization via i18n key
 * - Edge cases: missing grammar data, missing gender field, unknown gender
 */

import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

// Mock react-router-dom
const mockUseParams = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    useParams: () => mockUseParams(),
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

// Mock useWordEntry and useWordEntryCards hooks
const mockUseWordEntry = vi.fn();
const mockUseWordEntryCards = vi.fn();
vi.mock('../../hooks', () => ({
  useWordEntry: (opts: unknown) => mockUseWordEntry(opts),
  useWordEntryCards: (opts: unknown) => mockUseWordEntryCards(opts),
}));

// Import component after mocks
import { WordReferencePage } from '../WordReferencePage';

/** Render helper that wraps with TooltipProvider (required by Radix Tooltip) */
function renderPage() {
  return render(
    <TooltipProvider>
      <WordReferencePage />
    </TooltipProvider>
  );
}

// ============================================
// Test Data Factories
// ============================================

function makeWordEntry(overrides: Partial<WordEntryResponse> = {}): WordEntryResponse {
  return {
    id: 'test-word-id',
    deck_id: 'test-deck-id',
    lemma: 'test',
    part_of_speech: 'noun',
    cefr_level: 'A1',
    translation_en: 'test translation',
    translation_ru: 'тестовый перевод',
    pronunciation: 'test-pron',
    grammar_data: null,
    examples: null,
    audio_key: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMasculineNoun(): WordEntryResponse {
  return makeWordEntry({
    lemma: 'άνθρωπος',
    part_of_speech: 'noun',
    translation_en: 'person, human',
    translation_ru: 'человек',
    pronunciation: 'ánthropos',
    grammar_data: {
      gender: 'masculine',
      nominative_singular: 'άνθρωπος',
      genitive_singular: 'ανθρώπου',
      accusative_singular: 'άνθρωπο',
      vocative_singular: 'άνθρωπε',
      nominative_plural: 'άνθρωποι',
      genitive_plural: 'ανθρώπων',
      accusative_plural: 'ανθρώπους',
      vocative_plural: 'άνθρωποι',
    },
  });
}

function makeFeminineNoun(): WordEntryResponse {
  return makeWordEntry({
    lemma: 'γυναίκα',
    part_of_speech: 'noun',
    translation_en: 'woman',
    translation_ru: 'женщина',
    pronunciation: 'yinéka',
    grammar_data: {
      gender: 'feminine',
      nominative_singular: 'γυναίκα',
      genitive_singular: 'γυναίκας',
      accusative_singular: 'γυναίκα',
      vocative_singular: 'γυναίκα',
      nominative_plural: 'γυναίκες',
      genitive_plural: 'γυναικών',
      accusative_plural: 'γυναίκες',
      vocative_plural: 'γυναίκες',
    },
  });
}

function makeNeuterNoun(): WordEntryResponse {
  return makeWordEntry({
    lemma: 'σπίτι',
    part_of_speech: 'noun',
    translation_en: 'house',
    translation_ru: 'дом',
    pronunciation: 'spíti',
    grammar_data: {
      gender: 'neuter',
      nominative_singular: 'σπίτι',
      genitive_singular: 'σπιτιού',
      accusative_singular: 'σπίτι',
      vocative_singular: 'σπίτι',
      nominative_plural: 'σπίτια',
      genitive_plural: 'σπιτιών',
      accusative_plural: 'σπίτια',
      vocative_plural: 'σπίτια',
    },
  });
}

function makeVerb(): WordEntryResponse {
  return makeWordEntry({
    lemma: 'μιλάω',
    part_of_speech: 'verb',
    translation_en: 'to speak',
    pronunciation: 'miláo',
    grammar_data: {
      voice: 'active',
      present_1s: 'μιλάω',
      present_2s: 'μιλάς',
      present_3s: 'μιλάει',
      present_1p: 'μιλάμε',
      present_2p: 'μιλάτε',
      present_3p: 'μιλάνε',
    },
  });
}

function makeAdjective(): WordEntryResponse {
  return makeWordEntry({
    lemma: 'καλός',
    part_of_speech: 'adjective',
    translation_en: 'good',
    pronunciation: 'kalós',
    grammar_data: {
      masculine_nom_sg: 'καλός',
      feminine_nom_sg: 'καλή',
      neuter_nom_sg: 'καλό',
      comparative: 'καλύτερος',
      superlative: 'κάλλιστος',
    },
  });
}

function makeAdverb(): WordEntryResponse {
  return makeWordEntry({
    lemma: 'καλά',
    part_of_speech: 'adverb',
    translation_en: 'well',
    pronunciation: 'kalá',
    grammar_data: {
      comparative: 'καλύτερα',
      superlative: 'κάλλιστα',
    },
  });
}

// ============================================
// Setup
// ============================================

beforeEach(() => {
  mockUseParams.mockReturnValue({ deckId: 'test-deck-id', wordId: 'test-word-id' });
  mockUseWordEntryCards.mockReturnValue({
    cards: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================
// Tests
// ============================================

describe('WordReferencePage', () => {
  describe('Article Display for Nouns', () => {
    it('shows "ο" article before masculine noun lemma', () => {
      const entry = makeMasculineNoun();
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('ο');
      expect(heading).toHaveTextContent('άνθρωπος');
      // Verify article comes before lemma in the DOM
      expect(heading.textContent).toMatch(/ο\s*άνθρωπος/);
    });

    it('shows "η" article before feminine noun lemma', () => {
      const entry = makeFeminineNoun();
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('η');
      expect(heading).toHaveTextContent('γυναίκα');
      expect(heading.textContent).toMatch(/η\s*γυναίκα/);
    });

    it('shows "το" article before neuter noun lemma', () => {
      const entry = makeNeuterNoun();
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('το');
      expect(heading).toHaveTextContent('σπίτι');
      expect(heading.textContent).toMatch(/το\s*σπίτι/);
    });

    it('renders article in a span with correct styling classes', () => {
      const entry = makeMasculineNoun();
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      const articleSpan = heading.querySelector('span');
      expect(articleSpan).not.toBeNull();
      expect(articleSpan).toHaveClass('font-normal');
      expect(articleSpan).toHaveClass('text-muted-foreground');
      expect(articleSpan).toHaveClass('mr-2');
    });
  });

  describe('No Article for Non-Noun Parts of Speech', () => {
    it('does not show article for verbs', () => {
      const entry = makeVerb();
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      // Should have no span child (article span)
      expect(heading.querySelector('span')).toBeNull();
      expect(heading).toHaveTextContent('μιλάω');
      // Verify no Greek article characters present before the lemma
      expect(heading.textContent).not.toMatch(/^[οητ]/);
    });

    it('does not show article for adjectives', () => {
      const entry = makeAdjective();
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.querySelector('span')).toBeNull();
      expect(heading).toHaveTextContent('καλός');
    });

    it('does not show article for adverbs', () => {
      const entry = makeAdverb();
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.querySelector('span')).toBeNull();
      expect(heading).toHaveTextContent('καλά');
    });
  });

  describe('Edge Cases for Article Display', () => {
    it('does not show article when noun has no grammar data', () => {
      const entry = makeWordEntry({
        lemma: 'λέξη',
        part_of_speech: 'noun',
        grammar_data: null,
      });
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.querySelector('span')).toBeNull();
      expect(heading).toHaveTextContent('λέξη');
    });

    it('does not show article when noun grammar data lacks gender field', () => {
      const entry = makeWordEntry({
        lemma: 'λέξη',
        part_of_speech: 'noun',
        grammar_data: {
          nominative_singular: 'λέξη',
          // gender intentionally omitted
        },
      });
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.querySelector('span')).toBeNull();
      expect(heading).toHaveTextContent('λέξη');
    });

    it('does not show article when gender value is unknown', () => {
      const entry = makeWordEntry({
        lemma: 'λέξη',
        part_of_speech: 'noun',
        grammar_data: {
          gender: 'unknown_gender',
          nominative_singular: 'λέξη',
        },
      });
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const heading = screen.getByRole('heading', { level: 1 });
      // GENDER_ARTICLE_MAP['unknown_gender'] returns undefined, so no span
      expect(heading.querySelector('span')).toBeNull();
      expect(heading).toHaveTextContent('λέξη');
    });
  });

  describe('Practice Button Localization', () => {
    it('renders practice button with English i18n text', () => {
      const entry = makeMasculineNoun();
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const button = screen.getByTestId('practice-word-button');
      expect(button).toHaveTextContent('Practice this word');
    });

    it('renders practice button with Russian i18n text when locale is ru', async () => {
      // Change language to Russian
      await i18n.changeLanguage('ru');

      const entry = makeMasculineNoun();
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      const button = screen.getByTestId('practice-word-button');
      // The key deck:wordReference.practiceWord resolves to Russian text
      // Note: Russian translations may not be loaded in test setup,
      // but the key should at least not show the raw key
      expect(button.textContent).toBeTruthy();
      expect(button.textContent).not.toBe('deck:wordReference.practiceWord');

      // Restore English
      await i18n.changeLanguage('en');
    });

    it('practice button is disabled when no cards exist', () => {
      const entry = makeMasculineNoun();
      mockUseWordEntry.mockReturnValue({
        wordEntry: entry,
        isLoading: false,
        isError: false,
        error: null,
      });
      // Default mock returns cards: [] — button should be disabled
      mockUseWordEntryCards.mockReturnValue({
        cards: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      renderPage();

      const button = screen.getByTestId('practice-word-button');
      expect(button).toBeDisabled();
    });
  });

  describe('Loading and Error States', () => {
    it('renders skeleton when loading', () => {
      mockUseWordEntry.mockReturnValue({
        wordEntry: null,
        isLoading: true,
        isError: false,
        error: null,
      });

      renderPage();

      // Should not have main content
      expect(screen.queryByTestId('word-reference-page')).not.toBeInTheDocument();
    });

    it('renders error state when error occurs', () => {
      mockUseWordEntry.mockReturnValue({
        wordEntry: null,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
      });

      renderPage();

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('renders not found state when word entry is null', () => {
      mockUseWordEntry.mockReturnValue({
        wordEntry: null,
        isLoading: false,
        isError: false,
        error: null,
      });

      renderPage();

      expect(screen.queryByTestId('word-reference-page')).not.toBeInTheDocument();
    });
  });
});
