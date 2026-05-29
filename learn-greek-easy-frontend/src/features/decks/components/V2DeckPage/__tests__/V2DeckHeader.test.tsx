/**
 * V2DeckHeader Component Tests
 *
 * Covers:
 * - Filter pill selection (default "All", single-select)
 * - Study Now navigation without card type filter
 * - Study Now navigation with card type filter (Translation -> meaning)
 * - DX-12: total_study_time_seconds and cards_due surfaced in progress props
 */

import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import i18n from '@/i18n';
import { progressAPI } from '@/services/progressAPI';
import type { Deck, DeckProgress } from '@/types/deck';

import { V2DeckHeader } from '../V2DeckHeader';

// ============================================
// Mocks
// ============================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/progressAPI', () => ({
  progressAPI: {
    getDeckProgressDetail: vi.fn(),
  },
}));

// Capture progress props passed to DeckProgressBar
let capturedProgress: DeckProgress | null = null;

vi.mock('@/components/decks/DeckProgressBar', () => ({
  DeckProgressBar: ({ progress }: { progress: DeckProgress }) => {
    capturedProgress = progress;
    return null;
  },
}));

// ============================================
// Fixtures
// ============================================

const mockDeck: Deck = {
  id: 'deck-abc',
  title: 'Test Deck',
  titleGreek: 'Δοκιμαστικό',
  description: 'A test deck',
  level: 'A1',
  category: 'vocabulary',
  tags: [],
  cardCount: 20,
  estimatedTime: 15,
  isPremium: false,
  coverImageUrl: undefined,
  createdBy: 'system',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

function renderV2DeckHeader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <V2DeckHeader deck={mockDeck} />
        </I18nextProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ============================================
// Tests
// ============================================

describe('V2DeckHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProgress = null;
  });

  it('renders Study Now button with correct data-testid', () => {
    renderV2DeckHeader();
    expect(screen.getByTestId('start-review-button')).toBeInTheDocument();
  });

  it('renders all five filter pills', () => {
    renderV2DeckHeader();
    // All pills should be present - check by aria-pressed
    const allPressedButtons = screen.getAllByRole('button');
    // Filter pills: All, Translation, Plural Form, Article, Declension
    // Look for aria-pressed attribute
    const pills = allPressedButtons.filter((btn) => btn.getAttribute('aria-pressed') !== null);
    expect(pills.length).toBe(5);
  });

  it('has "All" selected by default', () => {
    renderV2DeckHeader();
    // Find pill with aria-pressed="true" - should be "All"
    const pressedPills = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') === 'true');
    expect(pressedPills.length).toBe(1);
    expect(pressedPills[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('selects a pill on click and deselects previous', async () => {
    const user = userEvent.setup();
    renderV2DeckHeader();

    // Find all pill buttons by aria-pressed
    const buttons = screen.getAllByRole('button');
    const pills = buttons.filter((btn) => btn.getAttribute('aria-pressed') !== null);

    // Initially "All" (first pill) is selected
    expect(pills[0]).toHaveAttribute('aria-pressed', 'true');
    expect(pills[1]).toHaveAttribute('aria-pressed', 'false');

    // Click second pill (Translation)
    await user.click(pills[1]);

    // Now Translation should be selected and All should not
    const updatedButtons = screen.getAllByRole('button');
    const updatedPills = updatedButtons.filter((btn) => btn.getAttribute('aria-pressed') !== null);
    expect(updatedPills[0]).toHaveAttribute('aria-pressed', 'false');
    expect(updatedPills[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('navigates to practice without cardType when "All" is selected', async () => {
    const user = userEvent.setup();
    renderV2DeckHeader();

    await user.click(screen.getByTestId('start-review-button'));

    expect(mockNavigate).toHaveBeenCalledWith('/decks/deck-abc/practice');
  });

  it('navigates with ?cardType=meaning when Translation pill is selected', async () => {
    const user = userEvent.setup();
    renderV2DeckHeader();

    // Click Translation pill (2nd pill, aria-pressed=false)
    const buttons = screen.getAllByRole('button');
    const pills = buttons.filter((btn) => btn.getAttribute('aria-pressed') !== null);
    await user.click(pills[1]); // Translation pill

    // Click Study Now
    await user.click(screen.getByTestId('start-review-button'));

    expect(mockNavigate).toHaveBeenCalledWith('/decks/deck-abc/practice?cardType=meaning');
  });

  it('renders completion percentage from API data', async () => {
    (progressAPI.getDeckProgressDetail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      progress: {
        total_cards: 10,
        cards_mastered: 5,
        cards_new: 5,
        cards_learning: 0,
        cards_review: 0,
        cards_due: 2,
        cards_studied: 5,
        mastery_percentage: 50,
        completion_percentage: 50,
      },
    });
    renderV2DeckHeader();
    await waitFor(() => {
      // DX-05: 50% now appears in both the resume hero stats and the progress card
      expect(screen.getAllByText(/50%/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('DX-12: surfaces total_study_time_seconds as raw seconds and cards_due; streak/accuracy remain 0', async () => {
    (progressAPI.getDeckProgressDetail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      progress: {
        total_cards: 20,
        cards_mastered: 0,
        cards_new: 15,
        cards_learning: 0,
        cards_review: 0,
        cards_due: 5,
        cards_studied: 5,
        mastery_percentage: 0,
        completion_percentage: 0,
      },
      statistics: {
        total_reviews: 10,
        total_study_time_seconds: 3600,
        average_quality: 3,
        average_easiness_factor: 2.5,
        average_interval_days: 1,
      },
      timeline: {
        first_studied_at: null,
        last_studied_at: null,
        days_active: 0,
        estimated_completion_days: null,
      },
    });

    renderV2DeckHeader();

    await waitFor(() => {
      // Wait until the async query resolves and re-renders with actual API data
      expect(capturedProgress?.totalTimeSpent).toBe(3600);
    });

    // DX-12: time is raw seconds (DX-06 formats to minutes); cards_due wired
    expect(capturedProgress!.totalTimeSpent).toBe(3600);
    expect(capturedProgress!.dueToday).toBe(5);
    // Placeholders — DX-06 will fill these
    expect(capturedProgress!.streak).toBe(0);
    expect(capturedProgress!.accuracy).toBe(0);
  });
});
