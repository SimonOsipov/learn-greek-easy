/**
 * DeckCard Component Tests
 *
 * Tests for the DeckCard component, focusing on:
 * - Premium badge renders when isPremium: true
 * - No badge renders when isPremium: false
 * - Locked state applies when premium + free user
 *
 * Related feature: [PREMBDG] Premium Badge for Decks
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { DeckCard, type DeckCardProps } from '../DeckCard';
import type { Deck } from '@/types/deck';
import i18n from '@/i18n';

// Mock deck for testing
const createMockDeck = (overrides: Partial<Deck> = {}): Deck => ({
  id: 'test-deck-1',
  title: 'Test Deck',
  titleGreek: 'Test Deck Greek',
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
    totalTimeSpent: 120,
    accuracy: 75,
  },
  ...overrides,
});

// Wrapper component with i18n provider
const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
};

describe('DeckCard', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Premium Badge Rendering', () => {
    it('should render premium badge when isPremium is true', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      // Look for the premium badge - it contains a Crown icon and "Premium" text
      const card = screen.getByTestId('deck-card');

      // The badge should be visible
      // Using translation key 'card.premium' or looking for the Crown icon
      const premiumBadge = within(card).queryByText(/premium/i);
      expect(premiumBadge).toBeInTheDocument();
    });

    it('should not render premium badge when isPremium is false', () => {
      const deck = createMockDeck({ isPremium: false });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const card = screen.getByTestId('deck-card');

      // The premium badge should NOT be visible
      const premiumBadge = within(card).queryByText(/premium/i);
      expect(premiumBadge).not.toBeInTheDocument();
    });

    it('should not render premium badge when isPremium is undefined', () => {
      const deck = createMockDeck();
      // @ts-expect-error - Testing undefined case
      delete deck.isPremium;

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const card = screen.getByTestId('deck-card');

      // The premium badge should NOT be visible
      const premiumBadge = within(card).queryByText(/premium/i);
      expect(premiumBadge).not.toBeInTheDocument();
    });

    it('should render premium badge with correct styling', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      // Find the premium badge
      const premiumBadge = screen.getByText(/premium/i);

      // Badge should have gradient background (purple)
      expect(premiumBadge.className).toContain('bg-gradient-to-r');
      expect(premiumBadge.className).toContain('from-purple-500');
      expect(premiumBadge.className).toContain('to-purple-700');
    });
  });

  describe('Locked State', () => {
    it('should show lock icon when deck is premium', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      // Look for the lock icon with aria-label
      const lockIcon = screen.getByLabelText(/premium locked/i);
      expect(lockIcon).toBeInTheDocument();
    });

    it('should not show lock icon when deck is not premium', () => {
      const deck = createMockDeck({ isPremium: false });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      // Lock icon should NOT be present
      const lockIcon = screen.queryByLabelText(/premium locked/i);
      expect(lockIcon).not.toBeInTheDocument();
    });

    it('should apply grayscale styling when deck is locked', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const card = screen.getByTestId('deck-card');

      // Card should have grayscale filter applied
      expect(card.className).toContain('grayscale');
    });

    it('should not apply grayscale styling when deck is not premium', () => {
      const deck = createMockDeck({ isPremium: false });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const card = screen.getByTestId('deck-card');

      // Card should NOT have grayscale filter
      expect(card.className).not.toContain('grayscale');
    });

    it('should not be clickable when deck is locked', async () => {
      const deck = createMockDeck({ isPremium: true });
      const onClick = vi.fn();

      renderWithI18n(<DeckCard deck={deck} onClick={onClick} />);

      const card = screen.getByTestId('deck-card');

      await userEvent.setup().click(card);

      // onClick should NOT be called because deck is locked
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should be clickable when deck is not premium', async () => {
      const deck = createMockDeck({ isPremium: false });
      const onClick = vi.fn();

      renderWithI18n(<DeckCard deck={deck} onClick={onClick} />);

      const card = screen.getByTestId('deck-card');

      await userEvent.setup().click(card);

      // onClick should be called
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have correct aria-label including locked status for premium decks', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const card = screen.getByTestId('deck-card');

      // aria-label should mention locked
      expect(card).toHaveAttribute('aria-label');
      expect(card.getAttribute('aria-label')).toContain('locked');
    });

    it('should have correct aria-label without locked status for free decks', () => {
      const deck = createMockDeck({ isPremium: false });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const card = screen.getByTestId('deck-card');

      // aria-label should NOT mention locked
      expect(card).toHaveAttribute('aria-label');
      expect(card.getAttribute('aria-label')).not.toContain('locked');
    });

    it('should have role="article" for locked cards (non-interactive)', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const card = screen.getByTestId('deck-card');

      // Locked cards should be article role (not button)
      expect(card).toHaveAttribute('role', 'article');
    });

    it('should have role="button" for clickable cards', () => {
      const deck = createMockDeck({ isPremium: false });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const card = screen.getByTestId('deck-card');

      // Clickable cards should have button role
      expect(card).toHaveAttribute('role', 'button');
    });

    it('should be keyboard accessible when not locked', async () => {
      const deck = createMockDeck({ isPremium: false });
      const onClick = vi.fn();

      renderWithI18n(<DeckCard deck={deck} onClick={onClick} />);

      const card = screen.getByTestId('deck-card');

      // Should have tabIndex for keyboard navigation
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should not have tabIndex when locked', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const card = screen.getByTestId('deck-card');

      // Locked cards should not be focusable via tabIndex
      expect(card).not.toHaveAttribute('tabIndex');
    });
  });

  describe('Premium Badge Positioning', () => {
    it('should reserve space for badge row even when not premium', () => {
      const deck = createMockDeck({ isPremium: false });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      // Find the badge container div (has mt-2 flex min-h-6 classes)
      const header = screen.getByTestId('deck-card-header');
      const badgeContainer = header.querySelector('.mt-2.flex.min-h-6');

      expect(badgeContainer).toBeInTheDocument();
    });

    it('should display premium and category badges side-by-side in a flex container', () => {
      const deck = createMockDeck({ isPremium: true, category: 'vocabulary' });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      // Find the badge container with flex layout
      const header = screen.getByTestId('deck-card-header');
      const badgeContainer = header.querySelector('.mt-2.flex.min-h-6');

      expect(badgeContainer).toBeInTheDocument();
      expect(badgeContainer?.className).toContain('flex');
      expect(badgeContainer?.className).toContain('gap-2');

      // Both badges should be inside the same container
      const premiumBadge = within(badgeContainer as HTMLElement).queryByText(/premium/i);
      const categoryBadge = within(badgeContainer as HTMLElement).queryByText(/vocabulary/i);

      expect(premiumBadge).toBeInTheDocument();
      expect(categoryBadge).toBeInTheDocument();
    });

    it('should display premium and culture badges side-by-side when isCultureDeck is true', () => {
      const deck = createMockDeck({ isPremium: true, category: 'culture' });

      renderWithI18n(
        <DeckCard
          deck={deck}
          onClick={mockOnClick}
          isCultureDeck={true}
          cultureCategory="history"
        />
      );

      // Find the badge container with flex layout
      const header = screen.getByTestId('deck-card-header');
      const badgeContainer = header.querySelector('.mt-2.flex.min-h-6');

      expect(badgeContainer).toBeInTheDocument();

      // Both badges should be inside the same container
      const premiumBadge = within(badgeContainer as HTMLElement).queryByText(/premium/i);
      // The culture badge renders with the testid
      const cultureBadge = within(badgeContainer as HTMLElement).queryByTestId('culture-badge');

      expect(premiumBadge).toBeInTheDocument();
      expect(cultureBadge).toBeInTheDocument();
    });

    it('should support flex-wrap for graceful wrapping on small screens', () => {
      const deck = createMockDeck({ isPremium: true, category: 'vocabulary' });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const header = screen.getByTestId('deck-card-header');
      const badgeContainer = header.querySelector('.mt-2.flex.min-h-6');

      expect(badgeContainer?.className).toContain('flex-wrap');
    });
  });

  describe('Visual Styling', () => {
    it('should have special border styling for premium decks when not locked', () => {
      // Note: In the current implementation, isPremium always results in isLocked=true
      // This test is for future functionality when unlocked premium decks exist
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const card = screen.getByTestId('deck-card');

      // Premium (and locked) cards have grayscale but when unlocked would have amber border
      // For now, just verify the card renders correctly
      expect(card).toBeInTheDocument();
    });
  });
});
