/**
 * V2DeckHeader Component Tests
 *
 * Covers:
 * - Filter pill selection (default "All", single-select) — now in DxActionPanel
 * - Study Now navigation without card type filter
 * - Study Now navigation with card type filter (Translation -> meaning)
 * - DX-07: DxActionPanel is rendered (delegates progress + practice to DxActionPanel)
 * - DX-06: DxMetricStrip is rendered
 * - DX-12: statistics.total_study_time_seconds flows into Time metric (not hardcoded 0)
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
import type { Deck } from '@/types/deck';

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
    // 4 mastered words out of 8 total → progressPct = 50% (1.0 * 4 / 8)
    getWordMastery: vi.fn().mockResolvedValue({
      deck_id: 'deck-abc',
      items: [
        // 4 mastered (mastered_count === total_count)
        {
          word_entry_id: 'w1',
          total_count: 3,
          mastered_count: 3,
          studied_count: 3,
          type_progress: [],
        },
        {
          word_entry_id: 'w2',
          total_count: 3,
          mastered_count: 3,
          studied_count: 3,
          type_progress: [],
        },
        {
          word_entry_id: 'w3',
          total_count: 3,
          mastered_count: 3,
          studied_count: 3,
          type_progress: [],
        },
        {
          word_entry_id: 'w4',
          total_count: 3,
          mastered_count: 3,
          studied_count: 3,
          type_progress: [],
        },
        // 4 new (studied_count === 0)
        {
          word_entry_id: 'w5',
          total_count: 3,
          mastered_count: 0,
          studied_count: 0,
          type_progress: [],
        },
        {
          word_entry_id: 'w6',
          total_count: 3,
          mastered_count: 0,
          studied_count: 0,
          type_progress: [],
        },
        {
          word_entry_id: 'w7',
          total_count: 3,
          mastered_count: 0,
          studied_count: 0,
          type_progress: [],
        },
        {
          word_entry_id: 'w8',
          total_count: 3,
          mastered_count: 0,
          studied_count: 0,
          type_progress: [],
        },
      ],
    }),
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
  });

  it('renders Start Review button with correct data-testid', () => {
    renderV2DeckHeader();
    expect(screen.getByTestId('start-review-button')).toBeInTheDocument();
  });

  it('renders all five filter pills', () => {
    renderV2DeckHeader();
    const allPressedButtons = screen.getAllByRole('button');
    const pills = allPressedButtons.filter((btn) => btn.getAttribute('aria-pressed') !== null);
    expect(pills.length).toBe(5);
  });

  it('has "All" selected by default', () => {
    renderV2DeckHeader();
    const pressedPills = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') === 'true');
    expect(pressedPills.length).toBe(1);
    expect(pressedPills[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('selects a pill on click and deselects previous', async () => {
    const user = userEvent.setup();
    renderV2DeckHeader();

    const buttons = screen.getAllByRole('button');
    const pills = buttons.filter((btn) => btn.getAttribute('aria-pressed') !== null);

    // Initially "All" (first pill) is selected
    expect(pills[0]).toHaveAttribute('aria-pressed', 'true');
    expect(pills[1]).toHaveAttribute('aria-pressed', 'false');

    // Click second pill (Translation)
    await user.click(pills[1]);

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

    const buttons = screen.getAllByRole('button');
    const pills = buttons.filter((btn) => btn.getAttribute('aria-pressed') !== null);
    await user.click(pills[1]); // Translation pill

    await user.click(screen.getByTestId('start-review-button'));

    expect(mockNavigate).toHaveBeenCalledWith('/decks/deck-abc/practice?cardType=meaning');
  });

  it('renders word-level completion percentage from getWordMastery in action panel bar', async () => {
    // getWordMastery mock (module-level) returns 4 mastered + 4 new out of 8 total
    // progressPct = round(1.0 * 4 / 8 * 100) = 50%
    renderV2DeckHeader();
    await waitFor(() => {
      const barFill = screen.getByTestId('dx-action-bar-fill');
      expect(barFill).toHaveStyle({ width: '50%' });
    });
  });

  it('renders DxActionPanel (dx-action-panel testid present)', () => {
    renderV2DeckHeader();
    expect(screen.getByTestId('dx-action-panel')).toBeInTheDocument();
  });

  // ── DX-06: DxMetricStrip ────────────────────────────────────────────────

  it('renders DxMetricStrip (dx-metric-strip testid present)', () => {
    renderV2DeckHeader();
    expect(screen.getByTestId('dx-metric-strip')).toBeInTheDocument();
  });

  // ── DX-12: total_study_time_seconds flows into Time metric ───────────────

  it('DX-12: Time metric shows 60 min when total_study_time_seconds=3600', async () => {
    (progressAPI.getDeckProgressDetail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      progress: {
        total_cards: 20,
        cards_mastered: 5,
        cards_new: 5,
        cards_learning: 5,
        cards_review: 5,
        cards_due: 3,
        cards_studied: 10,
        mastery_percentage: 25,
        completion_percentage: 50,
      },
      statistics: {
        total_reviews: 80,
        total_study_time_seconds: 3600,
        average_quality: 3.2,
        average_easiness_factor: 2.5,
        average_interval_days: 5,
      },
    });
    renderV2DeckHeader();
    await waitFor(() => {
      const timeValue = screen.getByTestId('dx-metric-time-value');
      expect(timeValue.textContent).toContain('60');
    });
  });
});
