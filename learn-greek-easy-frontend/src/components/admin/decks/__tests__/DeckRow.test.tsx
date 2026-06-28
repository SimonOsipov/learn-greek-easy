// src/components/admin/decks/__tests__/DeckRow.test.tsx
//
// Vitest + RTL unit tests for DeckRow (ADMIN2-09 / DKDR-04 / DADM-05).

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { UnifiedDeckItem } from '@/services/adminAPI';

import { DeckRow } from '../DeckRow';

const makeDeck = (overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id: 'deck-abc',
  name: 'Test Deck',
  type: 'vocabulary',
  level: 'A1',
  category: null,
  item_count: 42,
  is_active: true,
  is_premium: false,
  is_system_deck: false,
  created_at: '2026-01-01T00:00:00Z',
  owner_id: 'user-1',
  owner_name: 'Alice',
  ...overrides,
});

/** Render DeckRow directly — it is now a grid <div>, no table wrapper needed. */
function renderRow(props: React.ComponentProps<typeof DeckRow>) {
  return render(<DeckRow {...props} />);
}

describe('DeckRow', () => {
  // ── testid presence ──────────────────────────────────────────────────────

  it('renders data-testid="deck-row" on the row element', () => {
    renderRow({ deck: makeDeck(), locale: 'en', onOpenDrawer: vi.fn(), onDelete: vi.fn() });
    expect(screen.getByTestId('deck-row')).toBeInTheDocument();
  });

  it('renders data-testid="deck-row-mark" for the DeckMark slot', () => {
    renderRow({ deck: makeDeck(), locale: 'en', onOpenDrawer: vi.fn(), onDelete: vi.fn() });
    expect(screen.getByTestId('deck-row-mark')).toBeInTheDocument();
  });

  it('renders data-testid="deck-row-actions" for the hover actions group', () => {
    renderRow({ deck: makeDeck(), locale: 'en', onOpenDrawer: vi.fn(), onDelete: vi.fn() });
    expect(screen.getByTestId('deck-row-actions')).toBeInTheDocument();
  });

  // ── click semantics ──────────────────────────────────────────────────────

  it('row body click calls onOpenDrawer(deck)', () => {
    const deck = makeDeck();
    const onOpenDrawer = vi.fn();
    renderRow({ deck, locale: 'en', onOpenDrawer, onDelete: vi.fn() });
    fireEvent.click(screen.getByTestId('deck-row'));
    expect(onOpenDrawer).toHaveBeenCalledTimes(1);
    expect(onOpenDrawer).toHaveBeenCalledWith(deck);
  });

  it('pencil click calls onOpenDrawer(deck) and does NOT trigger extra calls from row', () => {
    const deck = makeDeck();
    const onOpenDrawer = vi.fn();
    renderRow({ deck, locale: 'en', onOpenDrawer, onDelete: vi.fn() });
    const pencilBtn = screen.getByRole('button', { name: /edit deck/i });
    fireEvent.click(pencilBtn);
    // stopPropagation prevents the row onClick from firing a second time
    expect(onOpenDrawer).toHaveBeenCalledTimes(1);
    expect(onOpenDrawer).toHaveBeenCalledWith(deck);
  });

  it('trash click calls onDelete(deck) and does NOT call onOpenDrawer', () => {
    const deck = makeDeck();
    const onOpenDrawer = vi.fn();
    const onDelete = vi.fn();
    renderRow({ deck, locale: 'en', onOpenDrawer, onDelete });
    const trashBtn = screen.getByRole('button', { name: /delete deck/i });
    fireEvent.click(trashBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(deck);
    expect(onOpenDrawer).not.toHaveBeenCalled();
  });

  // ── owner label ─────────────────────────────────────────────────────────

  it('displays "System" when is_system_deck === true', () => {
    renderRow({
      deck: makeDeck({ is_system_deck: true, owner_name: 'Someone' }),
      locale: 'en',
      onOpenDrawer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('displays owner_name when is_system_deck is false', () => {
    renderRow({
      deck: makeDeck({ is_system_deck: false, owner_name: 'Bob' }),
      locale: 'en',
      onOpenDrawer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays "—" when owner_name is null and not a system deck', () => {
    renderRow({
      deck: makeDeck({ is_system_deck: false, owner_name: null }),
      locale: 'en',
      onOpenDrawer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  // ── absolute date format ─────────────────────────────────────────────────

  it('renders created_at in absolute date format (e.g. "Jan 15, 2026")', () => {
    renderRow({
      deck: makeDeck({ created_at: '2026-01-15T00:00:00Z' }),
      locale: 'en',
      onOpenDrawer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(screen.getByText('Jan 15, 2026')).toBeInTheDocument();
  });

  // ── deck type meta line ──────────────────────────────────────────────────

  it('renders "vocabulary" meta line for vocabulary deck type', () => {
    renderRow({
      deck: makeDeck({ type: 'vocabulary' }),
      locale: 'en',
      onOpenDrawer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(screen.getByText('vocabulary')).toBeInTheDocument();
  });

  it('renders "culture" meta line for culture deck type', () => {
    renderRow({
      deck: makeDeck({ type: 'culture' }),
      locale: 'en',
      onOpenDrawer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(screen.getByText('culture')).toBeInTheDocument();
  });

  // ── hover-reveal actions class ───────────────────────────────────────────

  it('actions container uses Mechanism-A reveal class (deck-row-actions) and has no Tailwind group-hover utilities', () => {
    renderRow({ deck: makeDeck(), locale: 'en', onOpenDrawer: vi.fn(), onDelete: vi.fn() });
    const actions = screen.getByTestId('deck-row-actions');
    expect(actions.className).toContain('deck-row-actions');
    expect(actions.className).not.toContain('group-hover:opacity-100');
    expect(actions.className).not.toContain('opacity-0');
  });

  // ── D6 inactive affordance (ADMIN2-47-03) ────────────────────────────────
  // Active rows show NO deck-row-status tag; only deactivated rows show the
  // muted .deck-inactive-tag near the name.

  // TEST SPEC: row_shows_active_badge (updated D6 semantics)
  // AC: deck.is_active === true → no deck-row-status element present
  it('row_shows_active_badge: is_active:true renders no deck-row-status element', () => {
    renderRow({
      deck: makeDeck({ is_active: true }),
      locale: 'en',
      onOpenDrawer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(screen.queryByTestId('deck-row-status')).not.toBeInTheDocument();
  });

  // TEST SPEC: row_shows_deactivated_badge (updated D6 semantics)
  // AC: deck.is_active === false → deck-row-status contains "Deactivated"
  it('row_shows_deactivated_badge: is_active:false renders deck-row-status containing "Deactivated"', () => {
    renderRow({
      deck: makeDeck({ is_active: false }),
      locale: 'en',
      onOpenDrawer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(screen.getByTestId('deck-row-status')).toHaveTextContent('Deactivated');
  });

  // ── ADVERSARIAL: culture deck inactive affordance ─────────────────────────
  // Guards against an accidental type guard that would hide the tag for non-vocabulary rows.
  it('culture_deck_shows_active_badge: culture deck with is_active:true renders no deck-row-status', () => {
    renderRow({
      deck: makeDeck({ type: 'culture', is_active: true }),
      locale: 'en',
      onOpenDrawer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(screen.queryByTestId('deck-row-status')).not.toBeInTheDocument();
  });

  it('culture_deck_shows_deactivated_badge: culture deck with is_active:false renders deck-row-status containing "Deactivated"', () => {
    renderRow({
      deck: makeDeck({ type: 'culture', is_active: false }),
      locale: 'en',
      onOpenDrawer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(screen.getByTestId('deck-row-status')).toHaveTextContent('Deactivated');
  });
});
