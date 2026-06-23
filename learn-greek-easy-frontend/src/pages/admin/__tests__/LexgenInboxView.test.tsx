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
const mockUseLexgenProposal = vi.fn();
const mockUseApproveProposal = vi.fn();
const mockUseEditProposalField = vi.fn();
const mockUseRegenerateProposal = vi.fn();
const mockUseRejectProposal = vi.fn();

// Default mutation-like return shape: all mutation hooks that LexgenInboxView
// (and the LexgenProposalActions stub below) consume. Each must expose at
// minimum { mutate, mutateAsync, isPending }.
const defaultMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  reset: vi.fn(),
});

vi.mock('@/hooks/useLexgenProposals', () => ({
  useLexgenProposals: (...args: unknown[]) => mockUseLexgenProposals(...args),
  useLexgenProposal: (...args: unknown[]) => mockUseLexgenProposal(...args),
  useApproveProposal: (...args: unknown[]) => mockUseApproveProposal(...args),
  useEditProposalField: (...args: unknown[]) => mockUseEditProposalField(...args),
  useRegenerateProposal: (...args: unknown[]) => mockUseRegenerateProposal(...args),
  useRejectProposal: (...args: unknown[]) => mockUseRejectProposal(...args),
}));

// LexgenProposalActions is independently tested in its own suite. Stub it here
// so the inbox tests do not need a QueryClientProvider for the deck-list useQuery
// call inside LexgenProposalActions. The stub preserves the sentinel testid used
// nowhere in the inbox tests, keeping the mock transparent.
vi.mock('@/components/admin/LexgenProposalActions', () => ({
  LexgenProposalActions: () => <div data-testid="lexgen-proposal-actions-stub" />,
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
  mockUseLexgenProposal.mockReset();
  mockUseApproveProposal.mockReset();
  mockUseEditProposalField.mockReset();
  mockUseRegenerateProposal.mockReset();
  mockUseRejectProposal.mockReset();
  mockTrack.mockReset();

  // Detail panel hook: idle by default (no proposal selected). Individual
  // tests that exercise the detail panel override this.
  mockUseLexgenProposal.mockReturnValue({ data: undefined, isLoading: false, isError: false });

  // Mutation hooks: return a stable mutation-like object. LexgenInboxView calls
  // useEditProposalField unconditionally (keyed on selectedProposalId ?? '').
  mockUseApproveProposal.mockReturnValue(defaultMutation());
  mockUseEditProposalField.mockReturnValue(defaultMutation());
  mockUseRegenerateProposal.mockReturnValue(defaultMutation());
  mockUseRejectProposal.mockReturnValue(defaultMutation());
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

// ---------------------------------------------------------------------------
// QA adversarial coverage (LEXGEN-12-02) — counts, dates, no-score, a11y.
// These probe boundaries the happy-path suite above does not: a zero/large
// flagged count, locale-aware age rendering, the anti-anchoring invariant
// across the WHOLE rendered subtree, Space-key activation, error state, and
// that a row click passes the *correct* id when multiple rows exist.
// ---------------------------------------------------------------------------

describe('LexgenInboxView — adversarial', () => {
  it('renders a flagged_field_count=0 row without crashing (badge still present)', () => {
    mockUseLexgenProposals.mockReturnValue(
      loaded({ items: [makeItem('z', { flagged_field_count: 0 })], total: 1 })
    );

    render(<LexgenInboxView />);

    const row = screen.getByTestId('lexgen-inbox-row-z');
    expect(row).toBeTruthy();
    // The count cell renders the literal 0 (a count, not a score) — no crash,
    // no empty cell.
    expect(row.textContent).toContain('0');
  });

  it('renders a large flagged_field_count without truncation or crash', () => {
    mockUseLexgenProposals.mockReturnValue(
      loaded({ items: [makeItem('big', { flagged_field_count: 999 })], total: 1 })
    );

    render(<LexgenInboxView />);

    expect(screen.getByText('999')).toBeTruthy();
  });

  it('renders a relative age from created_at (default/EN locale)', () => {
    // ~3 days before a fixed "now" so the english "days ago" phrasing is stable.
    const now = new Date('2026-06-23T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      mockUseLexgenProposals.mockReturnValue(
        loaded({
          items: [makeItem('age', { created_at: '2026-06-20T10:00:00.000Z' })],
          total: 1,
        })
      );

      render(<LexgenInboxView />);

      const row = screen.getByTestId('lexgen-inbox-row-age');
      // date-fns formatDistanceToNow(addSuffix) → "3 days ago" in EN.
      expect(row.textContent?.toLowerCase()).toMatch(/ago/);
      expect(row.textContent).toMatch(/3 days/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never renders any text matching /score/i anywhere in the view (anti-anchoring)', () => {
    mockUseLexgenProposals.mockReturnValue(
      loaded({
        items: [
          makeItem('a', { flagged_field_count: 5 }),
          makeItem('b', { lemma: 'σπίτι', flagged_field_count: 0 }),
        ],
        total: 2,
      })
    );

    const { container } = render(<LexgenInboxView />) as { container: HTMLElement };

    expect(container.textContent ?? '').not.toMatch(/score/i);
    // Belt-and-suspenders: no element carries a "score" testid either.
    expect(container.querySelector('[data-testid*="score" i]')).toBeNull();
  });

  it('passes the correct id when one of several rows is clicked', () => {
    const onSelectProposal = vi.fn();
    mockUseLexgenProposals.mockReturnValue(
      loaded({ items: [makeItem('a'), makeItem('b'), makeItem('c')], total: 3 })
    );

    render(<LexgenInboxView onSelectProposal={onSelectProposal} />);

    fireEvent.click(screen.getByTestId('lexgen-inbox-row-b'));
    expect(onSelectProposal).toHaveBeenCalledTimes(1);
    expect(onSelectProposal).toHaveBeenCalledWith('b');
  });

  it('invokes onSelectProposal on keyboard activation (Space)', () => {
    const onSelectProposal = vi.fn();
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('a')], total: 1 }));

    render(<LexgenInboxView onSelectProposal={onSelectProposal} />);

    fireEvent.keyDown(screen.getByTestId('lexgen-inbox-row-a'), { key: ' ' });
    expect(onSelectProposal).toHaveBeenCalledWith('a');
  });

  it('does not fire onSelectProposal for a non-activation key (ArrowDown)', () => {
    const onSelectProposal = vi.fn();
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('a')], total: 1 }));

    render(<LexgenInboxView onSelectProposal={onSelectProposal} />);

    fireEvent.keyDown(screen.getByTestId('lexgen-inbox-row-a'), { key: 'ArrowDown' });
    expect(onSelectProposal).not.toHaveBeenCalled();
  });

  it('rows are keyboard-focusable (role=button, tabIndex=0)', () => {
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('a')], total: 1 }));

    render(<LexgenInboxView />);

    const row = screen.getByTestId('lexgen-inbox-row-a');
    expect(row.getAttribute('role')).toBe('button');
    expect(row.getAttribute('tabindex')).toBe('0');
  });

  it('does not throw when a row is activated with no onSelectProposal handler', () => {
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('a')], total: 1 }));

    render(<LexgenInboxView />);

    expect(() => fireEvent.click(screen.getByTestId('lexgen-inbox-row-a'))).not.toThrow();
    expect(() =>
      fireEvent.keyDown(screen.getByTestId('lexgen-inbox-row-a'), { key: 'Enter' })
    ).not.toThrow();
  });

  it('renders the error state (role=alert) when the query errors', () => {
    mockUseLexgenProposals.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<LexgenInboxView />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByTestId('lexgen-inbox-table')).toBeNull();
    expect(screen.queryByTestId('lexgen-inbox-loading')).toBeNull();
  });

  it('shows the "showing X-Y of N" range on a paginated queue', () => {
    // 41 rows → 3 pages, so the range summary + controls render.
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('a')], total: 41 }));

    render(<LexgenInboxView />);

    // EN: "Showing 1-20 of 41"
    expect(screen.getByText(/1-20/)).toBeTruthy();
    expect(screen.getByText(/of 41/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// QA adversarial coverage (LEXGEN-12-03) — the DEFERRED analytics + Sheet rows.
//
// AC #6 (lexgen_proposal_viewed) and the detail Sheet open/close lifecycle are
// owned by THIS container (the presentational LexgenProposalDetail does no
// fetching/analytics). The 12-02 happy-path suite asserts only `onSelectProposal`
// — the analytics event and the Sheet open/close were left UNCOVERED. These
// close that gap.
//
// `lexgen_proposal_viewed` fires from the LIST row's data (anti-anchoring: the
// payload carries id/lemma/flagged_field_count, never a score), so a row mock
// is sufficient — no detail fetch needed to assert the event.
// ---------------------------------------------------------------------------

describe('LexgenInboxView — detail analytics & Sheet (12-03)', () => {
  it('fires lexgen_proposal_viewed once with {proposal_id, lemma, flagged_field_count} on row click', () => {
    mockUseLexgenProposals.mockReturnValue(
      loaded({
        items: [makeItem('p1', { lemma: 'σπίτι', flagged_field_count: 3 })],
        total: 1,
      })
    );

    render(<LexgenInboxView />);

    fireEvent.click(screen.getByTestId('lexgen-inbox-row-p1'));

    expect(mockTrack).toHaveBeenCalledWith('lexgen_proposal_viewed', {
      proposal_id: 'p1',
      lemma: 'σπίτι',
      flagged_field_count: 3,
    });
    // exactly one viewed event for the single activation (inbox_opened is separate)
    const viewedCalls = mockTrack.mock.calls.filter((c) => c[0] === 'lexgen_proposal_viewed');
    expect(viewedCalls).toHaveLength(1);
  });

  it('fires lexgen_proposal_viewed with NO score-bearing prop (anti-anchoring)', () => {
    mockUseLexgenProposals.mockReturnValue(
      loaded({ items: [makeItem('p1', { flagged_field_count: 2 })], total: 1 })
    );

    render(<LexgenInboxView />);
    fireEvent.click(screen.getByTestId('lexgen-inbox-row-p1'));

    const viewed = mockTrack.mock.calls.find((c) => c[0] === 'lexgen_proposal_viewed');
    expect(viewed).toBeTruthy();
    const props = (viewed?.[1] ?? {}) as Record<string, unknown>;
    // exactly the three contract keys — no judge_scores/trust_score/confidence/score
    expect(Object.keys(props).sort()).toEqual(['flagged_field_count', 'lemma', 'proposal_id']);
    for (const k of Object.keys(props)) {
      expect(k).not.toMatch(/score|confidence|trust|naturalness|sense_fit/i);
    }
  });

  it('fires lexgen_proposal_viewed on keyboard (Enter) activation too', () => {
    mockUseLexgenProposals.mockReturnValue(
      loaded({ items: [makeItem('k1', { lemma: 'νερό', flagged_field_count: 1 })], total: 1 })
    );

    render(<LexgenInboxView />);
    fireEvent.keyDown(screen.getByTestId('lexgen-inbox-row-k1'), { key: 'Enter' });

    expect(mockTrack).toHaveBeenCalledWith('lexgen_proposal_viewed', {
      proposal_id: 'k1',
      lemma: 'νερό',
      flagged_field_count: 1,
    });
  });

  it('opens the detail Sheet (rendering the resolved detail) on row click', () => {
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('p1')], total: 1 }));
    // Detail hook resolves once a row is selected → the Sheet shows the detail.
    mockUseLexgenProposal.mockReturnValue({
      data: {
        id: 'p1',
        lemma: 'σπίτι',
        pos: 'noun',
        status: 'needs_review',
        created_at: '2026-06-22T10:00:00Z',
        fields: [{ field: 'gender', value: 'n', source: 'greek_lexicon', flagged: false }],
        content: [],
      },
      isLoading: false,
      isError: false,
    });

    render(<LexgenInboxView />);

    // Closed before interaction.
    expect(screen.queryByTestId('lexgen-proposal-detail')).toBeNull();

    fireEvent.click(screen.getByTestId('lexgen-inbox-row-p1'));

    // Sheet opened → the presentational detail mounted (portal-rendered).
    expect(screen.getByTestId('lexgen-proposal-detail')).toBeTruthy();
  });

  it('shows the detail skeleton while the detail query is loading', () => {
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('p1')], total: 1 }));
    mockUseLexgenProposal.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(<LexgenInboxView />);
    fireEvent.click(screen.getByTestId('lexgen-inbox-row-p1'));

    expect(screen.getByTestId('lexgen-detail-loading')).toBeTruthy();
    expect(screen.queryByTestId('lexgen-proposal-detail')).toBeNull();
  });

  it('closes the detail Sheet (unmounts the detail) when dismissed', () => {
    mockUseLexgenProposals.mockReturnValue(loaded({ items: [makeItem('p1')], total: 1 }));
    mockUseLexgenProposal.mockReturnValue({
      data: {
        id: 'p1',
        lemma: 'σπίτι',
        pos: 'noun',
        status: 'needs_review',
        created_at: '2026-06-22T10:00:00Z',
        fields: [{ field: 'gender', value: 'n', source: 'greek_lexicon', flagged: false }],
        content: [],
      },
      isLoading: false,
      isError: false,
    });

    render(<LexgenInboxView />);
    fireEvent.click(screen.getByTestId('lexgen-inbox-row-p1'));
    expect(screen.getByTestId('lexgen-proposal-detail')).toBeTruthy();

    // Radix Sheet exposes a labelled Close button; Escape also triggers onOpenChange(false).
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(screen.queryByTestId('lexgen-proposal-detail')).toBeNull();
  });
});
