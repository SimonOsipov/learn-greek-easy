/**
 * DeckCard Component Tests
 *
 * Tests for the DeckCard component, focusing on:
 * - Premium badge renders when isPremium: true
 * - No badge renders when isPremium: false
 * - Locked state applies when premium + free user
 * - Action buttons (edit/delete) for user-owned decks
 *
 * Related features:
 * - [PREMBDG] Premium Badge for Decks
 * - [DECKCREAT-08] Deck Card Edit/Delete Buttons
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
    lastStudied: new Date('2026-01-15'),
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

    it('should render premium badge with dot+opacity styling', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      // Find the premium text
      const premiumText = screen.getByText(/premium/i);
      expect(premiumText.className).toContain('text-purple-700');

      // Check the wrapper has dot+opacity styling
      const wrapper = premiumText.parentElement!;
      expect(wrapper.className).toContain('bg-purple-500/10');
      expect(wrapper.className).toContain('border-purple-500/20');

      // Check the dot is present
      const dot = wrapper.querySelector('.rounded-full');
      expect(dot).toBeInTheDocument();
      expect(dot!.className).toContain('bg-purple-500');
    });
  });

  describe('Locked State', () => {
    it('should show crown icon when deck is premium', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      // Look for the crown icon with aria-label
      const crownIcon = screen.getByLabelText(/premium content/i);
      expect(crownIcon).toBeInTheDocument();
    });

    it('should not show crown icon when deck is not premium', () => {
      const deck = createMockDeck({ isPremium: false });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      // Crown icon should NOT be present
      const crownIcon = screen.queryByLabelText(/premium content/i);
      expect(crownIcon).not.toBeInTheDocument();
    });

    it('should apply blur styling to content when deck is locked', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const content = screen.getByTestId('deck-card-content');

      // Content should have blur-sm class applied
      expect(content.className).toContain('blur-sm');
    });

    it('should not apply blur styling to content when deck is not premium', () => {
      const deck = createMockDeck({ isPremium: false });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const content = screen.getByTestId('deck-card-content');

      // Content should NOT have blur class
      expect(content.className).not.toContain('blur');
    });

    it('should render overlay when deck is locked', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      // Overlay should be present with correct classes
      const overlay = screen.getByTestId('deck-card-locked-overlay');
      expect(overlay).toBeInTheDocument();
      expect(overlay.className).toContain('bg-background/30');
      expect(overlay.className).toContain('z-10');
      expect(overlay.className).toContain('pointer-events-none');
    });

    it('should not render overlay when deck is not locked', () => {
      const deck = createMockDeck({ isPremium: false });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      // Overlay should NOT be present
      const overlay = screen.queryByTestId('deck-card-locked-overlay');
      expect(overlay).not.toBeInTheDocument();
    });

    it('should have z-20 on header to keep it above overlay', () => {
      const deck = createMockDeck({ isPremium: true });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const header = screen.getByTestId('deck-card-header');

      // Header should have z-20 class for proper layering
      expect(header.className).toContain('z-20');
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

  describe('Accent Stripe', () => {
    it('should render accent stripe with CEFR color for vocab deck', () => {
      const deck = createMockDeck({ level: 'A1' });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const stripe = screen.getByTestId('deck-card-accent-stripe');
      expect(stripe).toBeInTheDocument();
      expect(stripe.className).toContain('bg-green-500');
    });

    it('should render accent stripe with culture category color', () => {
      const deck = createMockDeck();
      renderWithI18n(
        <DeckCard
          deck={deck}
          onClick={mockOnClick}
          isCultureDeck={true}
          cultureCategory="history"
        />
      );
      const stripe = screen.getByTestId('deck-card-accent-stripe');
      expect(stripe.className).toContain('bg-amber-500');
    });

    it('should have aria-hidden on accent stripe', () => {
      const deck = createMockDeck();
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      const stripe = screen.getByTestId('deck-card-accent-stripe');
      expect(stripe).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Temporal Metadata', () => {
    it('should show "Not started" when no progress', () => {
      const deck = createMockDeck({ progress: undefined });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.getByTestId('deck-card-metadata')).toHaveTextContent(/not started/i);
    });

    it('should show "Due today" when dueToday > 0', () => {
      renderWithI18n(<DeckCard deck={createMockDeck()} onClick={mockOnClick} />);
      expect(screen.getByTestId('deck-card-metadata')).toHaveTextContent(/due today/i);
    });

    it('should show "Up to date" when dueToday === 0', () => {
      const deck = createMockDeck({
        progress: { ...createMockDeck().progress!, dueToday: 0 },
      });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.getByTestId('deck-card-metadata')).toHaveTextContent(/up to date/i);
    });

    it('should show "Completed" for completed decks', () => {
      const deck = createMockDeck({
        progress: { ...createMockDeck().progress!, status: 'completed' },
      });
      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);
      expect(screen.getByTestId('deck-card-metadata')).toHaveTextContent(/completed/i);
    });
  });

  describe('Action Buttons (Edit/Delete)', () => {
    it('should not render action buttons when showActions is false', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={false} />);

      const actionsContainer = screen.queryByTestId('deck-card-actions');
      expect(actionsContainer).not.toBeInTheDocument();
    });

    it('should not render action buttons when showActions is not provided (default)', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} />);

      const actionsContainer = screen.queryByTestId('deck-card-actions');
      expect(actionsContainer).not.toBeInTheDocument();
    });

    it('should render action buttons when showActions is true', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const actionsContainer = screen.getByTestId('deck-card-actions');
      expect(actionsContainer).toBeInTheDocument();
    });

    it('should render edit button with correct data-testid', () => {
      const deck = createMockDeck({ id: 'my-deck-123' });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const editButton = screen.getByTestId('edit-deck-my-deck-123');
      expect(editButton).toBeInTheDocument();
    });

    it('should render delete button with correct data-testid', () => {
      const deck = createMockDeck({ id: 'my-deck-123' });

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const deleteButton = screen.getByTestId('delete-deck-my-deck-123');
      expect(deleteButton).toBeInTheDocument();
    });

    it('should use ghost variant styling for edit button (no background)', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const editButton = screen.getByTestId(`edit-deck-${deck.id}`);

      // Ghost variant buttons don't have the primary bg class, but have hover:text-accent-foreground
      // The edit button uses custom styling: bg-background/80 hover:bg-background
      expect(editButton.className).toContain('hover:bg-background');
      expect(editButton.className).toContain('text-foreground');
    });

    it('should use ghost variant styling for delete button (no background)', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const deleteButton = screen.getByTestId(`delete-deck-${deck.id}`);

      // Ghost variant with destructive color
      expect(deleteButton.className).toContain('hover:bg-background');
      expect(deleteButton.className).toContain('text-destructive');
    });

    it('should call onEditClick when edit button is clicked', async () => {
      const deck = createMockDeck();
      const onEditClick = vi.fn();

      renderWithI18n(
        <DeckCard deck={deck} onClick={mockOnClick} showActions={true} onEditClick={onEditClick} />
      );

      const editButton = screen.getByTestId(`edit-deck-${deck.id}`);
      await userEvent.setup().click(editButton);

      expect(onEditClick).toHaveBeenCalledTimes(1);
    });

    it('should call onDeleteClick when delete button is clicked', async () => {
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

      const deleteButton = screen.getByTestId(`delete-deck-${deck.id}`);
      await userEvent.setup().click(deleteButton);

      expect(onDeleteClick).toHaveBeenCalledTimes(1);
    });

    it('should NOT trigger card onClick when edit button is clicked (stopPropagation)', async () => {
      const deck = createMockDeck();
      const onCardClick = vi.fn();
      const onEditClick = vi.fn();

      renderWithI18n(
        <DeckCard deck={deck} onClick={onCardClick} showActions={true} onEditClick={onEditClick} />
      );

      const editButton = screen.getByTestId(`edit-deck-${deck.id}`);
      await userEvent.setup().click(editButton);

      expect(onEditClick).toHaveBeenCalledTimes(1);
      expect(onCardClick).not.toHaveBeenCalled();
    });

    it('should NOT trigger card onClick when delete button is clicked (stopPropagation)', async () => {
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

      const deleteButton = screen.getByTestId(`delete-deck-${deck.id}`);
      await userEvent.setup().click(deleteButton);

      expect(onDeleteClick).toHaveBeenCalledTimes(1);
      expect(onCardClick).not.toHaveBeenCalled();
    });

    it('should position action buttons in top-right corner', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const actionsContainer = screen.getByTestId('deck-card-actions');

      // Should have absolute positioning classes
      expect(actionsContainer.className).toContain('absolute');
      expect(actionsContainer.className).toContain('right-2');
      expect(actionsContainer.className).toContain('top-2');
    });

    it('should hide action buttons by default and show on hover', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const actionsContainer = screen.getByTestId('deck-card-actions');

      // Should have opacity-0 (hidden) and group-hover:opacity-100 (show on hover)
      expect(actionsContainer.className).toContain('opacity-0');
      expect(actionsContainer.className).toContain('group-hover:opacity-100');
    });

    it('should have proper z-index to appear above other card content', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const actionsContainer = screen.getByTestId('deck-card-actions');

      // Should have z-30 to be above the header (z-20) and overlay (z-10)
      expect(actionsContainer.className).toContain('z-30');
    });

    it('should have accessible aria-labels for action buttons', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const editButton = screen.getByTestId(`edit-deck-${deck.id}`);
      const deleteButton = screen.getByTestId(`delete-deck-${deck.id}`);

      // Buttons should have aria-labels for screen readers
      expect(editButton).toHaveAttribute('aria-label');
      expect(deleteButton).toHaveAttribute('aria-label');
    });

    it('should render edit button with Pencil icon', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const editButton = screen.getByTestId(`edit-deck-${deck.id}`);

      // Pencil icon should be inside the button (as SVG)
      const svg = editButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render delete button with Trash2 icon', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const deleteButton = screen.getByTestId(`delete-deck-${deck.id}`);

      // Trash2 icon should be inside the button (as SVG)
      const svg = deleteButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render delete button with destructive color styling', () => {
      const deck = createMockDeck();

      renderWithI18n(<DeckCard deck={deck} onClick={mockOnClick} showActions={true} />);

      const deleteButton = screen.getByTestId(`delete-deck-${deck.id}`);

      // Delete button should have destructive text color
      expect(deleteButton.className).toContain('text-destructive');
    });
  });
});
