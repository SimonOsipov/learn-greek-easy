// src/components/admin/__tests__/AdminFeedbackSection.test.tsx
//
// Vitest + RTL tests for AdminFeedbackSection (FBDR-10).
// Covers: stat cards, seg-control filters (status × type AND-combined),
// vote-desc sort, debounced search, URL deep-link mounting, decorative buttons.

import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

import { AdminFeedbackSection } from '../AdminFeedbackSection';
import { useAdminFeedbackStore } from '@/stores/adminFeedbackStore';

import type { AdminFeedbackItem } from '@/types/feedback';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        // page head
        'feedback.v2.pageHead.breadcrumb': 'Feedback',
        'feedback.v2.pageHead.kicker': 'Reviews · Feedback',
        'feedback.v2.pageHead.title': 'User feedback',
        'feedback.v2.pageHead.sub': 'Review, respond, and track community feedback',
        'feedback.v2.pageHead.exportCsv': 'Export CSV',
        'feedback.v2.pageHead.sendMassUpdate': 'Send mass update',
        'feedback.v2.pageHead.comingSoonTooltip': 'Coming soon',
        // stat cards
        'feedback.v2.statCards.total.label': 'Total feedback',
        'feedback.v2.statCards.total.sub': '0 new · 0 responded',
        'feedback.v2.statCards.awaiting.label': 'Awaiting response',
        'feedback.v2.statCards.communityVotes.label': 'Community votes',
        'feedback.v2.statCards.communityVotes.sub': 'upvotes on this page',
        // filters
        'feedback.v2.filters.status.all': 'All',
        'feedback.v2.filters.status.open': 'Open',
        'feedback.v2.filters.status.new': 'New',
        'feedback.v2.filters.status.investigating': 'Investigating',
        'feedback.v2.filters.status.planned': 'Planned',
        'feedback.v2.filters.status.responded': 'Responded',
        'feedback.v2.filters.status.wont_fix': "Won't fix",
        'feedback.v2.filters.type.all': 'All',
        'feedback.v2.filters.type.bug': 'Bug',
        'feedback.v2.filters.type.feature': 'Feature',
        'feedback.v2.filters.type.compliment': 'Compliment',
        'feedback.v2.filters.search.placeholder': 'Search feedback...',
        'feedback.v2.filters.clear': 'Clear filters',
        // empty states
        'feedback.v2.emptyStates.noMatch': 'No feedback matches your filters',
        'feedback.v2.emptyStates.compliments': 'No compliments yet — backend support coming',
        // toasts
        'feedback.v2.toasts.deepLinkNotFound': 'Feedback item not found on this page',
        // v1 keys still referenced
        'feedback.anonymousUser': 'Anonymous User',
        'feedback.respond': 'Respond',
        'feedback.editResponse': 'Edit Response',
        'feedback.adminResponseLabel': 'Admin Response',
        'feedback.filters.clear': 'Clear Filters',
        'feedback.errors.loadingTitle': 'Error Loading Feedback',
        'feedback.search.placeholder': 'Search feedback...',
        'feedback.states.noFeedback': 'No feedback submitted yet',
        'feedback.states.noFilteredResults': 'No feedback matches the selected filters',
        'feedback.delete.button': 'Delete',
        'feedback.delete.title': 'Delete Feedback',
        'feedback.delete.warning': 'This will permanently delete this feedback item.',
        'feedback.delete.confirm': 'Delete',
        'feedback.delete.success': 'Feedback deleted',
        'feedback.v2.card.openReply': opts?.title ? `Open reply for ${opts.title}` : 'Open reply',
        'feedback.v2.card.adminResponseLabel': 'Admin response',
        'page.title': 'Admin Dashboard',
        'pagination.showing': `Showing 1-${opts?.total ?? 0} of ${opts?.total ?? 0}`,
        'pagination.pageOf': 'Page 1 of 1',
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
        'actions.retry': 'Retry',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

vi.mock('@/stores/adminFeedbackStore', () => ({
  useAdminFeedbackStore: vi.fn(),
}));

// ── Spies ──────────────────────────────────────────────────────────────────────

const mockToast = vi.fn();
const mockFetchFeedbackList = vi.fn().mockResolvedValue(undefined);
const mockDeleteFeedback = vi.fn().mockResolvedValue(undefined);
const mockOpenDrawer = vi.fn();
const mockCloseDrawer = vi.fn();
const mockSetInnerTab = vi.fn();
const mockSetPage = vi.fn();

// ── Fixture factory ────────────────────────────────────────────────────────────

function makeFeedback(overrides: Partial<AdminFeedbackItem> = {}): AdminFeedbackItem {
  return {
    id: `fb-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Sample feedback',
    description: 'Sample description',
    category: 'feature_request',
    status: 'new',
    vote_count: 1,
    admin_response: null,
    admin_response_at: null,
    author: { id: 'user-1', full_name: 'Jane Doe' },
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

// 3-item fixture for vote-desc sort tests
const SORT_FIXTURE = [
  makeFeedback({
    id: 'vote-low',
    title: 'Low votes',
    vote_count: 2,
    status: 'new',
    created_at: '2026-01-01T00:00:00Z',
  }),
  makeFeedback({
    id: 'vote-high',
    title: 'High votes',
    vote_count: 12,
    status: 'planned',
    created_at: '2026-01-02T00:00:00Z',
  }),
  makeFeedback({
    id: 'vote-mid',
    title: 'Mid votes',
    vote_count: 7,
    status: 'new',
    created_at: '2026-01-03T00:00:00Z',
  }),
];

// ── Store mock helpers ─────────────────────────────────────────────────────────

function buildMockState(
  feedbackList: AdminFeedbackItem[],
  overrides: Partial<{
    openFeedbackId: string | null;
    openInnerTab: 'reply' | 'thread' | 'meta';
    isLoading: boolean;
    total: number;
    totalPages: number;
    page: number;
  }> = {}
) {
  const state = {
    feedbackList,
    selectedFeedback: null,
    page: overrides.page ?? 1,
    pageSize: 10,
    total: overrides.total ?? feedbackList.length,
    totalPages: overrides.totalPages ?? 1,
    filters: { status: null, category: null },
    isLoading: overrides.isLoading ?? false,
    isUpdating: false,
    isDeleting: false,
    error: null,
    openFeedbackId: overrides.openFeedbackId ?? null,
    openInnerTab: overrides.openInnerTab ?? ('reply' as const),
    fetchFeedbackList: mockFetchFeedbackList,
    updateFeedback: vi.fn().mockResolvedValue(feedbackList[0]),
    deleteFeedback: mockDeleteFeedback,
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
    setPage: mockSetPage,
    clearError: vi.fn(),
    setSelectedFeedback: vi.fn(),
    openDrawer: mockOpenDrawer,
    closeDrawer: mockCloseDrawer,
    setInnerTab: mockSetInnerTab,
  };

  (useAdminFeedbackStore as unknown as Mock).mockImplementation(
    (sel?: (s: typeof state) => unknown) => (typeof sel === 'function' ? sel(state) : state)
  );

  return state;
}

// ── Render helper ──────────────────────────────────────────────────────────────

function renderSection(initialEntries: string[] = ['/admin?tab=feedback']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AdminFeedbackSection />
    </MemoryRouter>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AdminFeedbackSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── StatCards ──────────────────────────────────────────────────────────────

  describe('StatCards', () => {
    it('renders Total feedback, Awaiting response, and Community votes stat cards', () => {
      buildMockState([makeFeedback()]);

      renderSection();

      expect(screen.getByText('Total feedback')).toBeInTheDocument();
      expect(screen.getByText('Awaiting response')).toBeInTheDocument();
      expect(screen.getByText('Community votes')).toBeInTheDocument();
    });

    it('shows page-scoped vote sum in Community votes card', () => {
      const items = [
        makeFeedback({ vote_count: 5 }),
        makeFeedback({ vote_count: 8 }),
        makeFeedback({ vote_count: 3 }),
      ];
      buildMockState(items, { total: 3 });

      renderSection();

      // Total votes = 16; StatCard renders `n` as a number
      expect(screen.getByText('16')).toBeInTheDocument();
    });
  });

  // ── Status SegControl ──────────────────────────────────────────────────────

  describe('Status SegControl', () => {
    it('renders 7 status options (all, open, new, investigating, planned, responded, wont_fix)', () => {
      buildMockState([]);

      renderSection();

      // SegControl renders buttons with aria-pressed; look for them by text inside the seg group
      // The status seg group is labeled with its first option 'All'
      // Use getByText to assert each option label is present
      const segLabels = [
        'All',
        'Open',
        'New',
        'Investigating',
        'Planned',
        'Responded',
        "Won't fix",
      ];
      // There are two 'All' buttons (status + type segs), so getAllByText is fine
      for (const label of segLabels) {
        expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ── Type SegControl ────────────────────────────────────────────────────────

  describe('Type SegControl', () => {
    it('renders 4 type options (all, bug, feature, compliment)', () => {
      buildMockState([]);

      renderSection();

      expect(screen.getByText('Bug')).toBeInTheDocument();
      expect(screen.getByText('Feature')).toBeInTheDocument();
      expect(screen.getByText('Compliment')).toBeInTheDocument();
    });

    it('compliment type shows the "No compliments yet" placeholder', async () => {
      const user = userEvent.setup();
      buildMockState([makeFeedback({ category: 'feature_request' })]);

      renderSection();

      const complimentBtn = screen
        .getAllByRole('button')
        .find(
          (btn) =>
            btn.classList.contains('news-seg-btn') && btn.textContent?.trim() === 'Compliment'
        );
      await user.click(complimentBtn!);

      await waitFor(() => {
        expect(screen.getByText('No compliments yet — backend support coming')).toBeInTheDocument();
      });
    });
  });

  // ── Filter combinations (status × type AND-combined) ──────────────────────

  describe('Filter combinations', () => {
    const MIXED = [
      makeFeedback({
        id: 'bug-new',
        title: 'Bug 1',
        category: 'bug_incorrect_data',
        status: 'new',
      }),
      makeFeedback({
        id: 'bug-planned',
        title: 'Bug 2',
        category: 'bug_incorrect_data',
        status: 'planned',
      }),
      makeFeedback({
        id: 'feat-new',
        title: 'Feature 1',
        category: 'feature_request',
        status: 'new',
      }),
      makeFeedback({
        id: 'feat-planned',
        title: 'Feature 2',
        category: 'feature_request',
        status: 'planned',
      }),
    ];

    it('status=all + type=all renders full list', () => {
      buildMockState(MIXED, { total: MIXED.length });

      renderSection();

      expect(screen.getByText('Bug 1')).toBeInTheDocument();
      expect(screen.getByText('Feature 1')).toBeInTheDocument();
      expect(screen.getByText('Bug 2')).toBeInTheDocument();
      expect(screen.getByText('Feature 2')).toBeInTheDocument();
    });

    it('type=bug filters to bug_incorrect_data items only', async () => {
      const user = userEvent.setup();
      buildMockState(MIXED, { total: MIXED.length });

      renderSection();

      // 'Bug' appears in both the SegControl button and badge — click the seg button specifically
      const bugSegBtn = screen
        .getAllByRole('button')
        .find((btn) => btn.classList.contains('news-seg-btn') && btn.textContent?.trim() === 'Bug');
      await user.click(bugSegBtn!);

      await waitFor(() => {
        expect(screen.getByText('Bug 1')).toBeInTheDocument();
        expect(screen.getByText('Bug 2')).toBeInTheDocument();
        expect(screen.queryByText('Feature 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Feature 2')).not.toBeInTheDocument();
      });
    });

    it('status=open AND type=bug AND-combines (bugs that are new/under_review/planned/in_progress)', async () => {
      const user = userEvent.setup();
      buildMockState(MIXED, { total: MIXED.length });

      renderSection();

      // Click Open in the status seg
      const openBtn = screen
        .getAllByRole('button')
        .find(
          (btn) => btn.classList.contains('news-seg-btn') && btn.textContent?.trim() === 'Open'
        );
      await user.click(openBtn!);

      // Click Bug in the type seg
      const bugSegBtn = screen
        .getAllByRole('button')
        .find((btn) => btn.classList.contains('news-seg-btn') && btn.textContent?.trim() === 'Bug');
      await user.click(bugSegBtn!);

      await waitFor(() => {
        // bug-new (new = open) + bug-planned (planned = open) should show
        expect(screen.getByText('Bug 1')).toBeInTheDocument();
        expect(screen.getByText('Bug 2')).toBeInTheDocument();
        // Features should be hidden
        expect(screen.queryByText('Feature 1')).not.toBeInTheDocument();
      });
    });

    it('responded filter shows items with admin_response set', async () => {
      const user = userEvent.setup();
      const items = [
        makeFeedback({
          id: 'has-resp',
          title: 'Has response',
          admin_response: 'Fixed!',
          status: 'under_review',
        }),
        makeFeedback({ id: 'no-resp', title: 'No response', admin_response: null, status: 'new' }),
      ];
      buildMockState(items, { total: 2 });

      renderSection();

      const respondedBtn = screen
        .getAllByRole('button')
        .find(
          (btn) => btn.classList.contains('news-seg-btn') && btn.textContent?.trim() === 'Responded'
        );
      await user.click(respondedBtn!);

      await waitFor(() => {
        expect(screen.getByText('Has response')).toBeInTheDocument();
        expect(screen.queryByText('No response')).not.toBeInTheDocument();
      });
    });
  });

  // ── Vote-desc sort ─────────────────────────────────────────────────────────

  describe('Vote-desc sort', () => {
    it('renders 3-item fixture in vote_count desc order', () => {
      buildMockState(SORT_FIXTURE, { total: 3 });

      renderSection();

      const cards = screen.getAllByTestId('admin-feedback-card');
      expect(cards).toHaveLength(3);
      // First card should be "High votes" (12), second "Mid votes" (7), third "Low votes" (2)
      expect(cards[0]).toHaveTextContent('High votes');
      expect(cards[1]).toHaveTextContent('Mid votes');
      expect(cards[2]).toHaveTextContent('Low votes');
    });

    it('breaks ties in vote_count by created_at desc', () => {
      const tied = [
        makeFeedback({
          id: 'older',
          title: 'Older tied',
          vote_count: 5,
          created_at: '2026-01-01T00:00:00Z',
        }),
        makeFeedback({
          id: 'newer',
          title: 'Newer tied',
          vote_count: 5,
          created_at: '2026-01-10T00:00:00Z',
        }),
      ];
      buildMockState(tied, { total: 2 });

      renderSection();

      const cards = screen.getAllByTestId('admin-feedback-card');
      expect(cards[0]).toHaveTextContent('Newer tied');
      expect(cards[1]).toHaveTextContent('Older tied');
    });
  });

  // ── Debounced search ───────────────────────────────────────────────────────
  // Note: vi.useFakeTimers() + waitFor can deadlock in happy-dom because waitFor
  // itself uses setTimeout for polling. Instead we use real timers and a generous
  // waitFor timeout so the 300ms debounce can expire naturally.

  describe('Debounced search', () => {
    it('filters list by title substring after debounce (real timers)', async () => {
      const user = userEvent.setup();

      const items = [
        makeFeedback({ id: 'dark', title: 'Dark mode request' }),
        makeFeedback({ id: 'font', title: 'Bigger font size' }),
      ];
      buildMockState(items, { total: 2 });

      renderSection();

      const searchInput = screen.getByTestId('feedback-search-input');
      await user.type(searchInput, 'Dark');

      // Wait for debounce (300ms) + render to complete
      await waitFor(
        () => {
          expect(screen.getByText('Dark mode request')).toBeInTheDocument();
          expect(screen.queryByText('Bigger font size')).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('filters list by description substring after debounce (real timers)', async () => {
      const user = userEvent.setup();

      const items = [
        makeFeedback({ id: 'a', title: 'Feature A', description: 'Please add autocomplete' }),
        makeFeedback({ id: 'b', title: 'Feature B', description: 'Please add dark mode' }),
      ];
      buildMockState(items, { total: 2 });

      renderSection();

      const searchInput = screen.getByTestId('feedback-search-input');
      await user.type(searchInput, 'autocomplete');

      await waitFor(
        () => {
          expect(screen.getByText('Feature A')).toBeInTheDocument();
          expect(screen.queryByText('Feature B')).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });
  });

  // ── Deep-link mount via useSearchParams ────────────────────────────────────

  describe('Deep-link mount via useSearchParams', () => {
    const VALID_ID = 'deep-link-id-001';

    function makeDeepLinkFeedback() {
      return makeFeedback({ id: VALID_ID, title: 'Deep linked item' });
    }

    it('?edit=<valid-id>&inner=meta calls openDrawer with (id, "meta")', async () => {
      const feedback = makeDeepLinkFeedback();
      buildMockState([feedback]);

      renderSection([`/admin?tab=feedback&edit=${VALID_ID}&inner=meta`]);

      await waitFor(() => {
        expect(mockOpenDrawer).toHaveBeenCalledWith(VALID_ID, 'meta');
      });
    });

    it('?edit=<valid-id> alone calls openDrawer with default "reply" tab', async () => {
      const feedback = makeDeepLinkFeedback();
      buildMockState([feedback]);

      renderSection([`/admin?tab=feedback&edit=${VALID_ID}`]);

      await waitFor(() => {
        expect(mockOpenDrawer).toHaveBeenCalledWith(VALID_ID, 'reply');
      });
    });

    it('?edit=<unknown-id> shows error toast and does NOT call openDrawer', async () => {
      const feedback = makeDeepLinkFeedback();
      buildMockState([feedback]);

      renderSection(['/admin?tab=feedback&edit=nonexistent-id']);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
      });
      expect(mockOpenDrawer).not.toHaveBeenCalled();
    });

    it('?inner=meta WITHOUT ?edit renders list with drawer closed and no toast', async () => {
      buildMockState([makeDeepLinkFeedback()]);

      renderSection(['/admin?tab=feedback&inner=meta']);

      // Branch A: ?inner without ?edit — effect exits early, sets didMountFromUrl=true.
      // Assert openDrawer is not called and no error toast fires.
      // We waitFor the absence-assertion with a short timeout so the effect can run.
      await waitFor(
        () => {
          expect(mockOpenDrawer).not.toHaveBeenCalled();
          expect(mockToast).not.toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
    });

    it('?inner=foo (invalid inner value) is ignored silently — falls back to reply tab', async () => {
      buildMockState([makeDeepLinkFeedback()]);

      renderSection([`/admin?tab=feedback&edit=${VALID_ID}&inner=foo`]);

      // ?inner=foo is invalid → fallback to 'reply'
      await waitFor(() => {
        expect(mockOpenDrawer).toHaveBeenCalledWith(VALID_ID, 'reply');
      });
      expect(mockToast).not.toHaveBeenCalled();
    });
  });

  // ── Decorative "Coming soon" buttons ───────────────────────────────────────

  describe('Decorative header buttons', () => {
    it('Export CSV button has aria-disabled="true"', () => {
      buildMockState([]);

      renderSection();

      const exportBtn = screen.getByRole('button', { name: /Export CSV/i });
      expect(exportBtn).toHaveAttribute('aria-disabled', 'true');
    });

    it('Send mass update button has aria-disabled="true"', () => {
      buildMockState([]);

      renderSection();

      const massUpdateBtn = screen.getByRole('button', { name: /Send mass update/i });
      expect(massUpdateBtn).toHaveAttribute('aria-disabled', 'true');
    });

    it('clicking Export CSV does not navigate or call any handler', async () => {
      const user = userEvent.setup();
      buildMockState([]);

      renderSection();

      const exportBtn = screen.getByRole('button', { name: /Export CSV/i });
      // Should not throw; clicking should be a no-op
      await user.click(exportBtn);

      // No toast, no store calls related to export
      expect(mockToast).not.toHaveBeenCalled();
    });
  });
});
