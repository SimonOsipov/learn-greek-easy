/**
 * LexgenInboxView Component Tests (LEXGEN-12-02)
 *
 * Read-only verification-inbox queue. Note: PageHead (H1, breadcrumb, kicker)
 * is owned by AdminPage, not this view body.
 *
 * Covers: table renders rows from the mocked hook; empty state when total 0;
 * pagination buttons disable at boundaries; no numeric score column; the
 * `lexgen_inbox_opened` event fires on mount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import LexgenInboxView from '../LexgenInboxView';
import type { LexgenProposalListResponse } from '@/services/adminAPI';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockUseLexgenProposals = vi.fn();
vi.mock('@/hooks/useLexgenProposals', () => ({
  useLexgenProposals: (...args: unknown[]) => mockUseLexgenProposals(...args),
}));

const mockTrack = vi.fn();
vi.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    lemma: `λέξη-${id}`,
    pos: 'noun',
    flagged_field_count: 2,
    created_at: '2026-06-20T10:00:00.000Z',
    ...overrides,
  };
}

function loaded(data: Partial<LexgenProposalListResponse>) {
  return {
    data: {
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      ...data,
    } as LexgenProposalListResponse,
    isLoading: false,
    isError: false,
  };
}

beforeEach(() => {
  mockUseLexgenProposals.mockReset();
  mockTrack.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LexgenInboxView', () => {
  it('renders a table row per proposal from the mocked response', () => {
    mockUseLexgenProposals.mockReturnValue(
      loaded({
        items: [makeItem('a'), makeItem('b', { lemma: 'σπίτι', flagged_field_count: 0 })],
        total: 2,
      })
    );

    render(<LexgenInboxView />);

    expect(screen.getByTestId('lexgen-inbox-table')).toBeTruthy();
    expect(screen.getByText('λέξη-a')).toBeTruthy();
    expect(screen.getByText('σπίτι')).toBeTruthy();
    expect(screen.getByTestId('lexgen-inbox-row-a')).toBeTruthy();
    expect(screen.getByTestId('lexgen-inbox-row-b')).toBeTruthy();
  });

  it('shows the empty state when total is 0', () => {
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [], total: 0 }));

    render(<LexgenInboxView />);

    expect(screen.getByTestId('lexgen-inbox-empty')).toBeTruthy();
    expect(screen.getByText('No proposals awaiting review')).toBeTruthy();
    expect(screen.queryByTestId('lexgen-inbox-table')).toBeNull();
  });

  it('shows a skeleton while loading', () => {
    mockUseLexgenProposals.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(<LexgenInboxView />);

    expect(screen.getByTestId('lexgen-inbox-loading')).toBeTruthy();
  });

  it('renders no numeric score column (only the flagged-field count badge)', () => {
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('a')], total: 1 }));

    render(<LexgenInboxView />);

    // Column headers: lemma / pos / flagged fields / age — no "score".
    const headerRow = screen.getByTestId('lexgen-inbox-table').querySelector('thead');
    expect(headerRow?.textContent?.toLowerCase()).not.toContain('score');
    expect(screen.getByText('Flagged fields')).toBeTruthy();
  });

  it('disables prev on the first page and next on the last page', () => {
    // 41 rows / 20 per page = 3 pages → pagination is shown.
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('a')], total: 41 }));

    render(<LexgenInboxView />);

    const prev = screen.getByTestId('pagination-prev') as HTMLButtonElement;
    const next = screen.getByTestId('pagination-next') as HTMLButtonElement;

    // On page 1: prev disabled, next enabled.
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    // Advance to the last page (page 3): next becomes disabled.
    fireEvent.click(next);
    fireEvent.click(next);
    const prev2 = screen.getByTestId('pagination-prev') as HTMLButtonElement;
    const next2 = screen.getByTestId('pagination-next') as HTMLButtonElement;
    expect(prev2.disabled).toBe(false);
    expect(next2.disabled).toBe(true);
  });

  it('does not render pagination when there is only one page', () => {
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('a')], total: 5 }));

    render(<LexgenInboxView />);

    expect(screen.queryByTestId('pagination-prev')).toBeNull();
    expect(screen.queryByTestId('pagination-next')).toBeNull();
  });

  it('fires lexgen_inbox_opened once on mount', () => {
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [], total: 0 }));

    render(<LexgenInboxView />);

    expect(mockTrack).toHaveBeenCalledWith('lexgen_inbox_opened');
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('invokes onSelectProposal when a row is clicked', () => {
    const onSelectProposal = vi.fn();
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('a')], total: 1 }));

    render(<LexgenInboxView onSelectProposal={onSelectProposal} />);

    fireEvent.click(screen.getByTestId('lexgen-inbox-row-a'));
    expect(onSelectProposal).toHaveBeenCalledWith('a');
  });

  it('invokes onSelectProposal on keyboard activation (Enter)', () => {
    const onSelectProposal = vi.fn();
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('a')], total: 1 }));

    render(<LexgenInboxView onSelectProposal={onSelectProposal} />);

    fireEvent.keyDown(screen.getByTestId('lexgen-inbox-row-a'), { key: 'Enter' });
    expect(onSelectProposal).toHaveBeenCalledWith('a');
  });
});
