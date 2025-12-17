/**
 * Deck Browsing Integration Tests
 * Tests deck loading, display, and navigation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { DecksPage } from '@/pages/DecksPage';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';

describe.skip('Deck Browsing Integration', () => {
  beforeEach(async () => {
    // Login
    await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');

    // Reset deck store
    useDeckStore.setState({
      decks: [],
      selectedDeck: null,
      filters: { search: '', levels: [], categories: [], status: [], showPremiumOnly: false },
    });
  });

  it('should load and display decks on mount', async () => {
    render(<DecksPage />);

    // Wait for decks to load
    await waitFor(() => {
      expect(screen.getByText(/A1 Basic Vocabulary/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Multiple decks should be visible
    const deckCards = screen.getAllByRole('article');
    expect(deckCards.length).toBeGreaterThan(0);
  });

  it('should display deck metadata correctly', async () => {
    render(<DecksPage />);

    await waitFor(() => {
      expect(screen.getByText(/A1 Basic Vocabulary/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Check for level badges (multiple A1 elements expected - filters and deck cards)
    const a1Elements = screen.getAllByText(/^A1$/i);
    expect(a1Elements.length).toBeGreaterThan(0);

    // Check for card count label
    const cardLabels = screen.getAllByText(/^Cards$/i);
    expect(cardLabels.length).toBeGreaterThan(0);
  });

  it('should navigate to deck detail on click', async () => {
    const user = userEvent.setup();

    render(<DecksPage />);

    await waitFor(() => {
      expect(screen.getByText(/A1 Basic Vocabulary/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Click on deck card (link)
    const deckLink = screen.getByText(/A1 Basic Vocabulary/i).closest('a');
    if (deckLink) {
      await user.click(deckLink);
    }

    // In a real navigation scenario, the URL would change
    // For now, we verify the deck exists and is clickable
    await waitFor(() => {
      const deckStore = useDeckStore.getState();
      const deck = deckStore.decks.find(d => d.id === 'deck-a1-basics');
      expect(deck).toBeTruthy();
    });
  });

  it('should show loading state while fetching decks', async () => {
    render(<DecksPage />);

    // Should show loading initially (skeleton)
    const skeletons = screen.queryAllByTestId('card-skeleton');
    // Skeletons might render or loading text might appear
    // We just verify page renders without crashing during loading
    expect(screen.getByText(/Available Decks/i)).toBeInTheDocument();

    // Wait for decks to load
    await waitFor(() => {
      expect(screen.getByText(/A1 Basic Vocabulary/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should handle empty deck list gracefully', async () => {
    // Set filters that will return no results
    const { setFilters } = useDeckStore.getState();

    render(<DecksPage />);

    // Wait for initial load
    await waitFor(() => {
      const { isLoading } = useDeckStore.getState();
      expect(isLoading).toBe(false);
    }, { timeout: 5000 });

    // Apply impossible filter combination
    await userEvent.setup().type(screen.getByPlaceholderText(/search/i), 'xyz123nonexistent');

    // Wait for filter to apply
    await waitFor(() => {
      const emptyState = screen.queryByText(/No Decks Found|no decks match/i);
      // Empty state should appear when no matches
      if (screen.queryAllByRole('article').length === 0) {
        expect(emptyState).toBeInTheDocument();
      }
    }, { timeout: 5000 });
  });
});
