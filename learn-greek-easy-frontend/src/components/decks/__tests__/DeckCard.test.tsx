/**
 * DeckCard Component Tests
 *
 * Tests for the DeckCard component (grid variant — DX gradient cover card):
 * - Status badge per completion percentage (New / In progress / Complete)
 * - Progress bar width and complete state
 * - Meta line: cards/mastered, no UnwiredDot (R9)
 * - progress === undefined → mastered 0 / pct 0 / badge "New" / no throw
 * - Greek subtitle lang="el" and not italic
 * - Active card has .is-active
 * - Locked (isPremium) deck: overlay, non-clickable, showActions still works
 * - Action buttons (edit/delete) for user-owned decks
 * - Accessibility (aria-label, role, tabIndex)
 *
 * Related features:
 * - [DX-04] DeckCard gradient cover card
 * - [PREMBDG] Premium Badge for Decks
 * - [DECKCREAT-08] Deck Card Edit/Delete Buttons
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { DeckCard } from '../DeckCard';
import type { Deck } from '@/types/deck';
import i18n from '@/i18n';

// Mock deck factory
const createMockDeck = (overrides: Partial<Deck> = {}): Deck => ({
  id: 'test-deck-1',
  title: 'Test Deck',
  titleGreek: 'Δοκιμαστική Κολόνα',
  description: 'A test deck for unit tests',
  level: 'A1',
  category: 'vocabulary',
  tags: ['test'],
  cardCount: 50,
  estimatedTime: 30,
  isPremium: false,
  createdBy: 'test-user',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  progress: {
    deckId: 'test-deck-1',
    status: 'in-progress',
    cardsTotal: 50,
    cardsNew: 20,
    cardsLearning: 15,
    cardsReview: 10,
    cardsMastered: 5,
    dueToday: 10,
    streak: 3,
    lastStudied: new Date('2026-01-15'),
    totalTimeSpent: 120,
    accuracy: 75,
  },
  ...overrides,
});

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
};

describe('DeckCard', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Status Badge (DX-04 R1) ──────────────────────────────────────────────
  describe('Status badge per completion percentage', () => {
    it('shows "New" badge when pct === 0', () => {
      const deck = createMockDeck({
        progress: {
          deckId: 'test-deck-1',
          status: 'not-started',
          cardsTotal: 50,
          cardsNew: 50,
          cardsLearning: 0,
          cardsReview: 0,
          cardsMastered: 0,
          dueToday: 0,
          streak: 0,
          totalTimeSpent: 0,
          accuracy: 0,
        },
      });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const badge = screen.getByTestId('deck-card-status-badge');
      expect(badge.textContent?.toLowerCase()).toContain('new');
    });

    it('shows "In progress" badge when 0 < pct < 100', () => {
      // cardsLearning=10, cardsMastered=5 → pct = round(15/50*100) = 30
      const deck = createMockDeck({
        progress: {
          deckId: 'test-deck-1',
          status: 'in-progress',
          cardsTotal: 50,
          cardsNew: 35,
          cardsLearning: 10,
          cardsReview: 0,
          cardsMastered: 5,
          dueToday: 5,
          streak: 1,
          totalTimeSpent: 30,
          accuracy: 70,
        },
      });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const badge = screen.getByTestId('deck-card-status-badge');
      expect(badge.textContent?.toLowerCase()).toContain('progress');
    });

    it('shows "Complete" badge when pct >= 100', () => {
      // cardsLearning=25, cardsMastered=25 → pct = round(50/50*100) = 100
      const deck = createMockDeck({
        progress: {
          deckId: 'test-deck-1',
          status: 'completed',
          cardsTotal: 50,
          cardsNew: 0,
          cardsLearning: 25,
          cardsReview: 0,
          cardsMastered: 25,
          dueToday: 0,
          streak: 10,
          totalTimeSpent: 300,
          accuracy: 90,
        },
      });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const badge = screen.getByTestId('deck-card-status-badge');
      expect(badge.textContent?.toLowerCase()).toContain('complete');
    });
  });

  // ── Progress bar (DX-04 R2) ──────────────────────────────────────────────
  describe('Progress bar', () => {
    it('renders progress bar with correct width when 0 < pct < 100', () => {
      // cardsLearning=15, cardsMastered=10 → pct = round(25/50*100) = 50
      const deck = createMockDeck({
        progress: {
          deckId: 'test-deck-1',
          status: 'in-progress',
          cardsTotal: 50,
          cardsNew: 25,
          cardsLearning: 15,
          cardsReview: 0,
          cardsMastered: 10,
          dueToday: 5,
          streak: 2,
          totalTimeSpent: 60,
          accuracy: 80,
        },
      });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const fill = screen.getByTestId('deck-card-progress-fill');
      expect(fill).toBeInTheDocument();
      expect(fill.style.width).toBe('50%');
    });

    it('does NOT render progress bar when pct >= 100 (shows complete instead)', () => {
      const deck = createMockDeck({
        progress: {
          deckId: 'test-deck-1',
          status: 'completed',
          cardsTotal: 50,
          cardsNew: 0,
          cardsLearning: 25,
          cardsReview: 0,
          cardsMastered: 25,
          dueToday: 0,
          streak: 10,
          totalTimeSpent: 300,
          accuracy: 90,
        },
      });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.queryByTestId('deck-card-progress-bar')).not.toBeInTheDocument();
      expect(screen.getByTestId('deck-card-complete')).toBeInTheDocument();
    });

    it('does NOT render progress bar when pct === 0', () => {
      const deck = createMockDeck({
        progress: {
          deckId: 'test-deck-1',
          status: 'not-started',
          cardsTotal: 50,
          cardsNew: 50,
          cardsLearning: 0,
          cardsReview: 0,
          cardsMastered: 0,
          dueToday: 0,
          streak: 0,
          totalTimeSpent: 0,
          accuracy: 0,
        },
      });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.queryByTestId('deck-card-progress-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('deck-card-complete')).not.toBeInTheDocument();
    });
  });

  // ── Meta line — NO UnwiredDot (DX-04 R3 / R9 resolved) ─────────────────
  describe('Meta line (cards / mastered)', () => {
    it('renders meta with cardCount and cardsMastered', () => {
      const progress = createMockDeck().progress!;
      const deck = createMockDeck({ cardCount: 42, progress: { ...progress, cardsMastered: 7 } });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const meta = screen.getByTestId('deck-card-meta');
      expect(meta.textContent).toContain('42');
      expect(meta.textContent).toContain('7');
    });

    it('does NOT render any UnwiredDot (R9 resolved)', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(document.querySelector('.dx-unwired-dot')).not.toBeInTheDocument();
    });
  });

  // ── progress === undefined → graceful defaults (DX-04 R4) ───────────────
  describe('Undefined progress', () => {
    it('renders without throwing when progress is undefined', () => {
      const deck = createMockDeck({ progress: undefined });
      expect(() => renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />)).not.toThrow();
    });

    it('shows mastered=0 in meta when progress is undefined', () => {
      const deck = createMockDeck({ progress: undefined });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const meta = screen.getByTestId('deck-card-meta');
      expect(meta.textContent).toContain('0');
    });

    it('shows "New" badge when progress is undefined', () => {
      const deck = createMockDeck({ progress: undefined });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const badge = screen.getByTestId('deck-card-status-badge');
      expect(badge.textContent?.toLowerCase()).toContain('new');
    });

    it('does not render progress bar when progress is undefined', () => {
      const deck = createMockDeck({ progress: undefined });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.queryByTestId('deck-card-progress-bar')).not.toBeInTheDocument();
    });
  });

  // ── Greek subtitle (DX-04 R5) ────────────────────────────────────────────
  describe('Greek subtitle', () => {
    it('renders Greek subtitle with lang="el"', () => {
      const deck = createMockDeck({ titleGreek: 'Δοκιμαστική Κολόνα' });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const el = screen.getByTestId('deck-card-greek-subtitle');
      expect(el).toHaveAttribute('lang', 'el');
    });

    it('Greek subtitle uses dx-deck-card-el class (font-style: normal, Noto Serif)', () => {
      const deck = createMockDeck({ titleGreek: 'Δοκιμαστική Κολόνα' });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const el = screen.getByTestId('deck-card-greek-subtitle');
      expect(el.className).toContain('dx-deck-card-el');
    });
  });

  // ── Active state (DX-04 R6) ──────────────────────────────────────────────
  describe('Active state', () => {
    it('applies .is-active class when active=true', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} active={true} />);
      const card = screen.getByTestId('deck-card');
      expect(card.classList.contains('is-active')).toBe(true);
      expect(card.classList.contains('dx-deck-card')).toBe(true);
    });

    it('does NOT apply .is-active when active is omitted', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const card = screen.getByTestId('deck-card');
      expect(card.classList.contains('is-active')).toBe(false);
      expect(card.classList.contains('dx-deck-card')).toBe(true);
    });
  });

  // ── Cover image ──────────────────────────────────────────────────────────
  describe('Cover image', () => {
    const coverUrl = 'https://example.com/deck-cover.png';

    it('renders the cover image layer when coverImageUrl is set', () => {
      const deck = createMockDeck({ coverImageUrl: coverUrl });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const img = screen.getByTestId('dx-cover-img');
      expect(img.getAttribute('style') ?? '').toContain(`url("${coverUrl}")`);
    });

    it('falls back to the gradient (no image layer) when coverImageUrl is absent', () => {
      const deck = createMockDeck({ coverImageUrl: undefined });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.queryByTestId('dx-cover-img')).toBeNull();
    });
  });

  // ── Locked/premium state (DX-04 R7) ─────────────────────────────────────
  describe('Locked (isPremium) deck', () => {
    it('shows crown icon when deck is premium', () => {
      const deck = createMockDeck({ isPremium: true });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.getByLabelText(/premium content/i)).toBeInTheDocument();
    });

    it('does not show crown icon when deck is not premium', () => {
      const deck = createMockDeck({ isPremium: false });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.queryByLabelText(/premium content/i)).not.toBeInTheDocument();
    });

    it('renders locked overlay when deck is premium', () => {
      const deck = createMockDeck({ isPremium: true });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const overlay = screen.getByTestId('deck-card-locked-overlay');
      expect(overlay).toBeInTheDocument();
      expect(overlay.className).toContain('backdrop-blur-sm');
      expect(overlay.className).toContain('pointer-events-none');
    });

    it('does not render locked overlay when deck is not premium', () => {
      const deck = createMockDeck({ isPremium: false });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.queryByTestId('deck-card-locked-overlay')).not.toBeInTheDocument();
    });

    it('is NOT clickable when deck is locked', async () => {
      const deck = createMockDeck({ isPremium: true });
      const onClick = vi.fn();
      renderWithI18n(<DeckCard deck={deck} onClick={onClick} />);
      await userEvent.setup().click(screen.getByTestId('deck-card'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('is clickable when deck is not locked', async () => {
      const deck = createMockDeck({ isPremium: false });
      const onClick = vi.fn();
      renderWithI18n(<DeckCard deck={deck} onClick={onClick} />);
      await userEvent.setup().click(screen.getByTestId('deck-card'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('renders action buttons even when deck is locked (showActions=true)', () => {
      const deck = createMockDeck({ isPremium: true });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);
      expect(screen.getByTestId('deck-card-actions')).toBeInTheDocument();
    });
  });

  // ── Action buttons (DX-04 / DECKCREAT-08) ───────────────────────────────
  describe('Action Buttons (Edit/Delete)', () => {
    it('does not render action buttons when showActions is false', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={false} />);
      expect(screen.queryByTestId('deck-card-actions')).not.toBeInTheDocument();
    });

    it('does not render action buttons when showActions is not provided', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.queryByTestId('deck-card-actions')).not.toBeInTheDocument();
    });

    it('renders action buttons when showActions is true', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);
      expect(screen.getByTestId('deck-card-actions')).toBeInTheDocument();
    });

    it('renders edit button with correct data-testid', () => {
      const deck = createMockDeck({ id: 'my-deck-123' });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);
      expect(screen.getByTestId('edit-deck-my-deck-123')).toBeInTheDocument();
    });

    it('renders delete button with correct data-testid', () => {
      const deck = createMockDeck({ id: 'my-deck-123' });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);
      expect(screen.getByTestId('delete-deck-my-deck-123')).toBeInTheDocument();
    });

    it('calls onEditClick when edit button is clicked', async () => {
      const deck = createMockDeck();
      const onEditClick = vi.fn();
      renderWithI18n(
        <DeckCard deck={deck} onClick={mockOnClick} showActions={true} onEditClick={onEditClick} />
      );
      await userEvent.setup().click(screen.getByTestId(`edit-deck-${deck.id}`));
      expect(onEditClick).toHaveBeenCalledTimes(1);
    });

    it('calls onDeleteClick when delete button is clicked', async () => {
      const deck = createMockDeck();
      const onDeleteClick = vi.fn();
      renderWithI18n(
        <DeckCard
          deck={deck}
          onClick={mockOnClick}
          showActions={true}
          onDeleteClick={onDeleteClick}
        />
      );
      await userEvent.setup().click(screen.getByTestId(`delete-deck-${deck.id}`));
      expect(onDeleteClick).toHaveBeenCalledTimes(1);
    });

    it('does NOT trigger card onClick when edit button is clicked (stopPropagation)', async () => {
      const deck = createMockDeck();
      const onCardClick = vi.fn();
      const onEditClick = vi.fn();
      renderWithI18n(
        <DeckCard deck={deck} onClick={onCardClick} showActions={true} onEditClick={onEditClick} />
      );
      await userEvent.setup().click(screen.getByTestId(`edit-deck-${deck.id}`));
      expect(onEditClick).toHaveBeenCalledTimes(1);
      expect(onCardClick).not.toHaveBeenCalled();
    });

    it('does NOT trigger card onClick when delete button is clicked (stopPropagation)', async () => {
      const deck = createMockDeck();
      const onCardClick = vi.fn();
      const onDeleteClick = vi.fn();
      renderWithI18n(
        <DeckCard
          deck={deck}
          onClick={onCardClick}
          showActions={true}
          onDeleteClick={onDeleteClick}
        />
      );
      await userEvent.setup().click(screen.getByTestId(`delete-deck-${deck.id}`));
      expect(onDeleteClick).toHaveBeenCalledTimes(1);
      expect(onCardClick).not.toHaveBeenCalled();
    });

    it('positions action buttons in top-right corner', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);
      const container = screen.getByTestId('deck-card-actions');
      expect(container.className).toContain('absolute');
      expect(container.className).toContain('right-2');
      expect(container.className).toContain('top-2');
    });

    it('action buttons have opacity-0 default and group-hover:opacity-100', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);
      const container = screen.getByTestId('deck-card-actions');
      expect(container.className).toContain('opacity-0');
      expect(container.className).toContain('group-hover:opacity-100');
    });

    it('action buttons container has z-30', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);
      expect(screen.getByTestId('deck-card-actions').className).toContain('z-30');
    });

    it('action buttons have aria-labels', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);
      expect(screen.getByTestId(`edit-deck-${deck.id}`)).toHaveAttribute('aria-label');
      expect(screen.getByTestId(`delete-deck-${deck.id}`)).toHaveAttribute('aria-label');
    });

    it('delete button has destructive text color', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);
      expect(screen.getByTestId(`delete-deck-${deck.id}`).className).toContain('text-destructive');
    });
  });

  // ── Accessibility ────────────────────────────────────────────────────────
  describe('Accessibility', () => {
    it('has aria-label including "locked" for premium decks', () => {
      const deck = createMockDeck({ isPremium: true });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.getByTestId('deck-card').getAttribute('aria-label')).toContain('locked');
    });

    it('has aria-label without "locked" for free decks', () => {
      const deck = createMockDeck({ isPremium: false });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.getByTestId('deck-card').getAttribute('aria-label')).not.toContain('locked');
    });

    it('has role="article" for locked cards (non-interactive)', () => {
      const deck = createMockDeck({ isPremium: true });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.getByTestId('deck-card')).toHaveAttribute('role', 'article');
    });

    it('has role="button" for clickable cards', () => {
      const deck = createMockDeck({ isPremium: false });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.getByTestId('deck-card')).toHaveAttribute('role', 'button');
    });

    it('has tabIndex=0 when not locked', () => {
      const deck = createMockDeck({ isPremium: false });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.getByTestId('deck-card')).toHaveAttribute('tabIndex', '0');
    });

    it('does not have tabIndex when locked', () => {
      const deck = createMockDeck({ isPremium: true });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.getByTestId('deck-card')).not.toHaveAttribute('tabIndex');
    });

    it('is keyboard accessible via Enter when not locked', async () => {
      const deck = createMockDeck({ isPremium: false });
      const onClick = vi.fn();
      renderWithI18n(<DeckCard deck={deck} onClick={onClick} />);
      screen.getByTestId('deck-card').focus();
      await userEvent.setup().keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  // ── Premium badge ────────────────────────────────────────────────────────
  describe('Premium Badge Rendering', () => {
    it('renders premium badge text when isPremium is true', () => {
      const deck = createMockDeck({ isPremium: true });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.queryByText(/premium/i)).toBeInTheDocument();
    });

    it('does not render premium badge text when isPremium is false', () => {
      const deck = createMockDeck({ isPremium: false });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.queryByText(/premium/i)).not.toBeInTheDocument();
    });
  });

  // ── Title ────────────────────────────────────────────────────────────────
  describe('Title', () => {
    it('renders the localized deck title', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.getByTestId('deck-card-title')).toBeInTheDocument();
    });
  });
});
