// src/components/admin/decks/__tests__/DeckList.test.tsx
//
// Vitest + RTL unit tests for DeckList (ADMIN2-09 / DKDR-04).

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { UnifiedDeckItem } from '@/services/adminAPI';

import { DeckList } from '../DeckList';

const makeDeck = (id: string, overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id,
  name: `Deck ${id}`,
  type: 'vocabulary',
  level: 'A1',
  category: null,
  item_count: 10,
  is_active: true,
  is_premium: false,
  is_system_deck: false,
  created_at: '2026-01-01T00:00:00Z',
  owner_id: null,
  owner_name: null,
  ...overrides,
});

const defaultProps = {
  locale: 'en',
  onOpenDrawer: vi.fn(),
  onDelete: vi.fn(),
};

describe('DeckList', () => {
  it('renders one deck-row per deck when loaded', () => {
    const decks = [makeDeck('a'), makeDeck('b'), makeDeck('c')];
    render(<DeckList decks={decks} isLoading={false} {...defaultProps} />);
    const rows = screen.getAllByTestId('deck-row');
    expect(rows).toHaveLength(3);
  });

  it('renders the deck-list container with data-testid="deck-list"', () => {
    render(<DeckList decks={[makeDeck('x')]} isLoading={false} {...defaultProps} />);
    expect(screen.getByTestId('deck-list')).toBeInTheDocument();
  });

  it('renders empty state when decks is empty and not loading', () => {
    render(<DeckList decks={[]} isLoading={false} {...defaultProps} />);
    // No deck-rows present
    expect(screen.queryAllByTestId('deck-row')).toHaveLength(0);
    // Some text indicating no decks
    expect(screen.getByText(/no decks found/i)).toBeInTheDocument();
  });

  it('renders skeleton rows when isLoading is true', () => {
    render(<DeckList decks={[]} isLoading={true} {...defaultProps} />);
    // No actual deck rows when loading
    expect(screen.queryAllByTestId('deck-row')).toHaveLength(0);
    // Skeleton container has aria-label
    expect(screen.getByLabelText(/loading decks/i)).toBeInTheDocument();
  });

  it('does not render deck-list container when isLoading', () => {
    render(<DeckList decks={[makeDeck('y')]} isLoading={true} {...defaultProps} />);
    expect(screen.queryByTestId('deck-list')).not.toBeInTheDocument();
  });
});
