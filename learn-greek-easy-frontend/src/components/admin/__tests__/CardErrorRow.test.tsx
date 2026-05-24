// Convergence subtask. Sibling specs (CER-48/49/50/51) live alongside this
// file. If any sibling file is missing when this lands, the test suite must
// fail loudly via the watcher's "no tests found" output — do not silence it.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';
import type { AdminCardErrorResponse } from '@/types/cardError';

import { AdminCardErrorCard } from '../AdminCardErrorCard';

// ── Factory ───────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<AdminCardErrorResponse> = {}): AdminCardErrorResponse {
  return {
    id: 'abcdef12-3456-7890-abcd-ef1234567890',
    card_id: 'card-uuid-001',
    card_type: 'WORD',
    user_id: 'user-uuid-001',
    description: 'Something looks wrong here.',
    status: 'PENDING',
    admin_notes: null,
    resolved_by: null,
    resolved_at: null,
    reporter: { id: 'user-uuid-001', full_name: 'Maria Papadopoulos' },
    resolver: null,
    card: {
      word: 'αδερφή',
      article: 'η',
      translation_en: 'sister',
      translation_ru: 'сестра',
      plural: 'αδερφές',
      ipa: '/aˈðeɾfi/',
      gender: 'f',
    },
    deck: { id: 'deck-001', name: 'A1 Basics' },
    created_at: '2026-05-20T10:00:00Z',
    updated_at: '2026-05-20T10:00:00Z',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminCardErrorCard (CER-53)', () => {
  // AC #1: renders deck chip, card peek, ID stub, respond action
  it('renders deck chip, card peek, ID stub, and respond button for PENDING row', () => {
    const row = makeRow();
    renderWithProviders(<AdminCardErrorCard errorReport={row} onRespond={vi.fn()} />);

    // Deck chip
    expect(screen.getByTestId('card-error-deck-chip')).toBeInTheDocument();
    expect(screen.getByTestId('card-error-deck-chip')).toHaveTextContent('A1 Basics');

    // Card peek: word + translation
    expect(screen.getByText('αδερφή')).toBeInTheDocument();
    expect(screen.getByText('sister')).toBeInTheDocument();

    // ID stub (first 8 chars of card_id — the component shows card_id stub, not report id)
    expect(screen.getByTitle(row.card_id)).toBeInTheDocument();
    // card_id is 'card-uuid-001', first 8 chars = 'card-uui'
    expect(screen.getByTitle(row.card_id)).toHaveTextContent('card-uui');

    // Respond action button
    expect(screen.getByTestId('card-error-respond-button')).toBeInTheDocument();
  });

  // AC #2a: body click invokes drawer-open handler
  it('body click invokes onRespond handler', () => {
    const onRespond = vi.fn();
    const row = makeRow();
    renderWithProviders(<AdminCardErrorCard errorReport={row} onRespond={onRespond} />);

    const card = screen.getByTestId('admin-card-error-card');
    fireEvent.click(card);
    expect(onRespond).toHaveBeenCalledTimes(1);
    expect(onRespond).toHaveBeenCalledWith(row);
  });

  // AC #2b: action button click does NOT bubble to parent onRespond
  it('action button click does not bubble to parent (stopPropagation)', () => {
    const onRespond = vi.fn();
    const row = makeRow();
    renderWithProviders(<AdminCardErrorCard errorReport={row} onRespond={onRespond} />);

    // Click the respond action button
    fireEvent.click(screen.getByTestId('card-error-respond-button'));
    // The button itself calls onRespond, but the container should not receive an
    // extra propagated event. We get exactly 1 call (from the button handler),
    // not 2 (button + propagated to card root).
    expect(onRespond).toHaveBeenCalledTimes(1);
  });

  // AC #3: inline reply present when admin_notes is non-empty; omitted when null
  it('renders inline reply preview when admin_notes is non-empty', () => {
    const rowWithNotes = makeRow({ admin_notes: 'Fixed in v2' });
    renderWithProviders(<AdminCardErrorCard errorReport={rowWithNotes} onRespond={vi.fn()} />);
    expect(screen.getByTestId('card-error-admin-notes')).toBeInTheDocument();
    expect(screen.getByTestId('card-error-admin-notes')).toHaveTextContent('Fixed in v2');
  });

  it('omits inline reply when admin_notes is null', () => {
    const rowNoNotes = makeRow({ admin_notes: null });
    renderWithProviders(<AdminCardErrorCard errorReport={rowNoNotes} onRespond={vi.fn()} />);
    expect(screen.queryByTestId('card-error-admin-notes')).not.toBeInTheDocument();
  });

  it('omits inline reply when admin_notes is empty string', () => {
    const rowEmpty = makeRow({ admin_notes: '' });
    renderWithProviders(<AdminCardErrorCard errorReport={rowEmpty} onRespond={vi.fn()} />);
    expect(screen.queryByTestId('card-error-admin-notes')).not.toBeInTheDocument();
  });

  // AC #4: open-state border (data-state) for PENDING and REVIEWED, not for FIXED/DISMISSED
  it.each([
    ['PENDING' as const, 'open'],
    ['REVIEWED' as const, 'open'],
    ['FIXED' as const, 'triaged'],
    ['DISMISSED' as const, 'triaged'],
  ])('%s row has data-state="%s"', (status, expectedState) => {
    const row = makeRow({ status });
    renderWithProviders(<AdminCardErrorCard errorReport={row} onRespond={vi.fn()} />);
    const card = screen.getByTestId('admin-card-error-card');
    expect(card).toHaveAttribute('data-state', expectedState);
  });

  // AC #5: timestamp element has mono font class (ce-card-when)
  it('timestamp has the ce-card-when mono font class', () => {
    const row = makeRow();
    const { container } = renderWithProviders(
      <AdminCardErrorCard errorReport={row} onRespond={vi.fn()} />
    );
    const timestamp = container.querySelector('.ce-card-when');
    expect(timestamp).not.toBeNull();
    // The element should contain a relative time string
    expect(timestamp?.textContent).not.toBe('');
  });

  // CULTURE variant — deck chip and card peek render
  it('renders CULTURE card peek with question text', () => {
    const row = makeRow({
      card_type: 'CULTURE',
      card: {
        question_en: 'What is the capital of Greece?',
        question_el: null,
        options: ['Athens', 'Thessaloniki', 'Heraklion', 'Patras'],
        correct_index: 0,
      },
    });
    renderWithProviders(<AdminCardErrorCard errorReport={row} onRespond={vi.fn()} />);
    expect(screen.getByText('What is the capital of Greece?')).toBeInTheDocument();
  });
});
