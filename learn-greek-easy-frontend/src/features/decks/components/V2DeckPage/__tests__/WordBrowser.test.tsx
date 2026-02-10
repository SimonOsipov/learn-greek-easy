/**
 * WordBrowser Component Tests
 *
 * Tests for the WordBrowser component, covering:
 * - Search input with placeholder
 * - 300ms debounced search
 * - Filter pills (All, Learned, Reviewing, New)
 * - Disabled state for Learned/Reviewing pills (V2 decks)
 * - Loading skeleton display
 * - Empty state display
 * - Results counter
 * - Word grid rendering
 */

import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { WordBrowser } from '../WordBrowser';
import i18n from '@/i18n';
import { wordEntryAPI } from '@/services/wordEntryAPI';

// Mock the wordEntryAPI
vi.mock('@/services/wordEntryAPI', () => ({
  wordEntryAPI: {
    getByDeck: vi.fn(),
  },
}));

// Mock word entries data
const mockWordEntries = [
  {
    id: '1',
    deck_id: 'deck-1',
    lemma: 'test',
    part_of_speech: 'NOUN',
    translation_en: 'test english',
    translation_en_plural: null,
    translation_ru: 'test russian',
    translation_ru_plural: null,
    pronunciation: 'tehst',
    grammar_data: null,
    examples: null,
    audio_key: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    deck_id: 'deck-1',
    lemma: 'another',
    part_of_speech: 'VERB',
    translation_en: 'another english',
    translation_en_plural: null,
    translation_ru: null,
    translation_ru_plural: null,
    pronunciation: 'another',
    grammar_data: null,
    examples: null,
    audio_key: 'audio-key',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    deck_id: 'deck-1',
    lemma: 'unique',
    part_of_speech: 'ADJECTIVE',
    translation_en: 'unique english',
    translation_en_plural: null,
    translation_ru: null,
    translation_ru_plural: null,
    pronunciation: null,
    grammar_data: null,
    examples: null,
    audio_key: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Create a wrapper with providers (includes MemoryRouter for WordGrid's useNavigate/useParams)
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        I18nextProvider,
        { i18n },
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/decks/deck-1'] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, { path: '/decks/:id', element: children })
          )
        )
      )
    );
};

describe('WordBrowser Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Search Input', () => {
    it('should render search input with placeholder', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('word-browser-search')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('word-browser-search');
      expect(searchInput).toHaveAttribute('placeholder', 'Search words...');
    });

    it('should have aria-label for accessibility', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 0,
        word_entries: [],
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('word-browser-search')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('word-browser-search');
      expect(searchInput).toHaveAttribute('aria-label', 'Search words...');
    });

    it('should show clear button when search has text', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('word-browser-search')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('word-browser-search');

      // Initially no clear button
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

      // Type in search
      await user.type(searchInput, 'test');

      // Clear button should appear
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });

    it('should clear search when clear button is clicked', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('word-browser-search')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('word-browser-search');
      await user.type(searchInput, 'test');

      const clearButton = screen.getByLabelText('Clear search');
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Search Debounce (300ms)', () => {
    it('should debounce search input by 300ms', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('word-browser-search')).toBeInTheDocument();
      });

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByText(/Showing 3 of 3 words/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('word-browser-search');

      // Type 'unique' (should only match one entry)
      await user.type(searchInput, 'unique');

      // Before debounce, results should still show all entries
      expect(screen.getByText(/Showing 3 of 3 words/i)).toBeInTheDocument();

      // Advance timers by 300ms
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // After debounce, results should be filtered
      await waitFor(() => {
        expect(screen.getByText(/Showing 1 of 3 words/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filter Pills', () => {
    it('should render all four filter pills with counts', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /All \(3\)/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Learned \(0\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reviewing \(0\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New \(3\)/i })).toBeInTheDocument();
    });

    it('should have filter group with proper aria-label', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Filter by status/i })).toBeInTheDocument();
      });
    });

    it('should disable Learned and Reviewing pills when count is 0', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /All \(3\)/i })).toBeInTheDocument();
      });

      const learnedButton = screen.getByRole('button', { name: /Learned \(0\)/i });
      const reviewingButton = screen.getByRole('button', { name: /Reviewing \(0\)/i });

      expect(learnedButton).toBeDisabled();
      expect(reviewingButton).toBeDisabled();
    });

    it('should not disable All and New pills even when they have entries', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /All \(3\)/i })).toBeInTheDocument();
      });

      const allButton = screen.getByRole('button', { name: /All \(3\)/i });
      const newButton = screen.getByRole('button', { name: /New \(3\)/i });

      expect(allButton).not.toBeDisabled();
      expect(newButton).not.toBeDisabled();
    });

    it('should have aria-pressed attribute on filter pills', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /All \(3\)/i })).toBeInTheDocument();
      });

      const allButton = screen.getByRole('button', { name: /All \(3\)/i });
      const newButton = screen.getByRole('button', { name: /New \(3\)/i });

      // All should be active by default
      expect(allButton).toHaveAttribute('aria-pressed', 'true');
      expect(newButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should change active filter when pill is clicked', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /All \(3\)/i })).toBeInTheDocument();
      });

      const newButton = screen.getByRole('button', { name: /New \(3\)/i });
      await user.click(newButton);

      expect(newButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockReturnValue(new Promise(() => {})); // Never resolves

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      expect(screen.getByTestId('word-grid-skeleton')).toBeInTheDocument();
    });

    it('should hide skeleton after data loads', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByTestId('word-grid-skeleton')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no words exist', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 0,
        word_entries: [],
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No words found')).toBeInTheDocument();
      });

      expect(screen.getByText('No words in this category.')).toBeInTheDocument();
    });

    it('should show search-specific empty state when search has no results', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('word-browser-search')).toBeInTheDocument();
      });

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText(/Showing 3 of 3 words/i)).toBeInTheDocument();
      });

      // Search for non-existent word
      const searchInput = screen.getByTestId('word-browser-search');
      await user.type(searchInput, 'nonexistent');

      // Advance debounce timer
      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('No words found')).toBeInTheDocument();
      });

      expect(
        screen.getByText('No words match your search. Try a different term.')
      ).toBeInTheDocument();
    });

    it('should show clear search button in empty state when search has text', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('word-browser-search')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/Showing 3 of 3 words/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('word-browser-search');
      await user.type(searchInput, 'nonexistent');

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('No words found')).toBeInTheDocument();
      });

      // Should have a "Clear search" action button in empty state
      const clearButtons = screen.getAllByRole('button', { name: /Clear search/i });
      expect(clearButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Results Counter', () => {
    it('should display results counter with correct counts', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/Showing 3 of 3 words/i)).toBeInTheDocument();
      });
    });

    it('should update counter when search filters results', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/Showing 3 of 3 words/i)).toBeInTheDocument();
      });

      // Search for 'test' (should match one entry)
      const searchInput = screen.getByTestId('word-browser-search');
      await user.type(searchInput, 'test');

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 of 3 words/i)).toBeInTheDocument();
      });
    });
  });

  describe('Word Grid', () => {
    it('should render word grid with entries', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('word-grid')).toBeInTheDocument();
      });
    });

    it('should render word cards for each entry', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 3,
        word_entries: mockWordEntries,
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        // WordCard now uses data-testid="word-card" for all cards
        const cards = screen.getAllByTestId('word-card');
        expect(cards).toHaveLength(3);
      });
    });
  });

  describe('Error State', () => {
    it('should display error state when API fails', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockRejectedValue(new Error('API Error'));

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Failed to load words')).toBeInTheDocument();
      });

      expect(
        screen.getByText('There was an error loading the word entries. Please try again.')
      ).toBeInTheDocument();
    });
  });

  describe('Test ID', () => {
    it('should have word-browser test id on container', async () => {
      vi.mocked(wordEntryAPI.getByDeck).mockResolvedValue({
        deck_id: 'deck-1',
        total: 0,
        word_entries: [],
      });

      render(<WordBrowser deckId="deck-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('word-browser')).toBeInTheDocument();
      });
    });
  });
});
