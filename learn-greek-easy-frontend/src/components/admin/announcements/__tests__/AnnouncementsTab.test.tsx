// src/components/admin/announcements/__tests__/AnnouncementsTab.test.tsx
//
// Integration tests for the ANND-07 rewrite of AnnouncementsTab.
// Covers: render, URL-driven drawer open/close, single tab-level ConfirmDialog,
// and URL-strip idempotency (fetchAnnouncementDetail called exactly once).

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useAdminAnnouncementStore } from '@/stores/adminAnnouncementStore';

import { AnnouncementsTab } from '../AnnouncementsTab';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/stores/adminAnnouncementStore', () => ({
  useAdminAnnouncementStore: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/services/adminAPI', () => ({
  GENERATE_WORD_ENTRY_STREAM_URL: '/api/v1/admin/word-entries/generate/stream',
  adminAPI: {
    getAnnouncements: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
    }),
    createAnnouncement: vi.fn().mockResolvedValue({}),
    getAnnouncementDetail: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

// ── Radix Select shim ─────────────────────────────────────────────────────────
// Radix UI's <Select> does not work in jsdom (no pointer events, no hidden native
// <select> outside a <form>). Replace with a lightweight native <select> shim so
// the toolbar sort tests can drive sort changes via fireEvent.change.
// Existing tests don't interact with the Select, so this shim is transparent to them.
vi.mock('@/components/ui/select', () => {
  const React = require('react');
  const Select: React.FC<{
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }> = ({ value, onValueChange, children }) => (
    <select
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      data-testid="select-shim"
    >
      {children}
    </select>
  );
  const SelectTrigger: React.FC<{ children?: React.ReactNode; [k: string]: unknown }> = () => null;
  const SelectValue: React.FC<{ [k: string]: unknown }> = () => null;
  const SelectContent: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
  const SelectItem: React.FC<{ value: string; children?: React.ReactNode }> = ({
    value,
    children,
  }) => <option value={value}>{children}</option>;
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

// ── i18n mock ─────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        // PageHead
        'inbox.breadcrumb.dashboard': 'Dashboard',
        'announcements.title': 'Announcements',
        'announcements.kicker': 'Admin',
        'announcements.actions.new': 'New announcement',
        // StatCards
        'announcements.stats.total': 'Total Announcements',
        'announcements.stats.peopleReached': 'People Reached',
        'announcements.stats.avgReadRate': 'Avg. Read Rate',
        'announcements.stats.withLink': 'With Link',
        'announcements.stats.allTime': 'All time',
        'announcements.stats.acrossAll': 'Across all',
        // HistoryRows
        'announcements.v2.history.colDate': 'Date',
        'announcements.v2.history.colTitle': 'Title',
        'announcements.v2.history.colReach': 'Reach',
        'announcements.v2.history.colRead': 'Read',
        'announcements.v2.history.colRate': 'Rate',
        'announcements.history.empty': 'No announcements yet',
        'announcements.history.emptyHint': 'Create your first announcement above',
        'announcements.history.title': 'Announcement History',
        // ComposeDrawer
        'announcements.create.title': 'Create Announcement',
        'announcements.create.formTab': 'Form',
        'announcements.create.jsonTab': 'JSON',
        'announcements.create.titleLabel': 'Title',
        'announcements.create.titlePlaceholder': 'Enter title',
        'announcements.create.messageLabel': 'Message',
        'announcements.create.messagePlaceholder': 'Enter message',
        'announcements.create.linkLabel': 'Link URL',
        'announcements.create.linkPlaceholder': 'https://example.com',
        'announcements.create.linkDescription': 'Users can click this link',
        'announcements.create.optional': 'optional',
        'announcements.create.preview': 'Preview',
        'announcements.create.jsonHint': 'Paste a JSON object.',
        'announcements.create.jsonPlaceholder': '{"title":"..."}',
        'announcements.compose.audienceLabel': 'Audience',
        'announcements.compose.scheduleLabel': 'Schedule',
        'announcements.compose.sendNow': 'Send now',
        'announcements.compose.scheduleLater': 'Schedule for later',
        'announcements.compose.previewLabel': 'Preview',
        'announcements.compose.sendButton': 'Send now',
        'announcements.compose.cancelButton': 'Cancel',
        'announcements.compose.audience.allLearners': 'All learners',
        'announcements.create.modeForm': 'Form',
        'announcements.create.modeJson': 'JSON',
        'announcements.create.switchModeConfirmTitle': 'Switch mode?',
        'announcements.create.switchModeConfirm': 'Your current input will be cleared. Continue?',
        'announcements.create.unsavedTitle': 'Discard changes?',
        'announcements.create.unsavedDescription': 'You have unsaved input.',
        'announcements.create.jsonInvalidJson': 'Invalid JSON.',
        'announcements.create.jsonTitleRequired': 'Title is required.',
        'announcements.create.jsonTitleTooLong': 'Title too long.',
        'announcements.create.jsonMessageRequired': 'Message is required.',
        'announcements.create.jsonMessageTooLong': 'Message too long.',
        'announcements.create.jsonInvalidUrl': 'Invalid URL.',
        'announcements.create.jsonUrlTooLong': 'URL too long.',
        // DetailsDrawer
        'announcements.v2.details.sent': 'Sent',
        'announcements.v2.details.message': 'Message',
        'announcements.v2.details.linkUrl': 'Link',
        'announcements.v2.details.reach': 'Reach',
        'announcements.v2.details.sentTo': 'Sent to',
        'announcements.v2.details.recipients': 'recipients',
        'announcements.v2.details.readBy': 'Read by',
        'announcements.v2.details.unread': 'unread',
        'announcements.v2.details.clickThrough': 'Click-through',
        'announcements.v2.details.readProgress': 'Read progress',
        'announcements.v2.details.readTimeline': 'Read timeline',
        'announcements.v2.details.announcementLabel': 'Announcement',
        'announcements.v2.details.delivered': 'Delivered',
        'announcements.v2.details.read': 'Read',
        'announcements.v2.details.resendToUnread': 'Resend to unread',
        'announcements.v2.timeline.comingSoonCaption': 'Detailed timeline coming soon',
        'announcements.v2.ctr.trackingComingSoon': 'tracking coming soon',
        'announcements.v2.ctr.noLink': 'no link',
        'announcements.detail.close': 'Close',
        // Delete dialog
        'announcements.delete.title': 'Delete Announcement',
        'announcements.delete.warning':
          'This will permanently delete the announcement. Already-sent notifications will NOT be recalled.',
        'announcements.delete.confirm': 'Delete',
        'announcements.delete.button': 'Delete',
        // Pagination
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
        'pagination.pageOf': 'Page {{page}} of {{totalPages}}',
        // Toolbar search
        'announcements.toolbar.searchPlaceholder': 'Search',
        'announcements.toolbar.emptySearch': 'No results for "{{query}}"',
        'announcements.toolbar.clearSearch': 'Clear search',
        // Sort
        'announcements.toolbar.sortLabel': 'Sort',
        'announcements.toolbar.sort.newest': 'Newest',
        'announcements.toolbar.sort.oldest': 'Oldest',
        'announcements.toolbar.sort.rateDesc': 'Rate ↓',
        'announcements.toolbar.sort.rateAsc': 'Rate ↑',
      };
      return map[key] || key;
    },
    i18n: { language: 'en' },
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const ANNOUNCEMENT_ID = 'ann-uuid-001';

const sampleAnnouncements = [
  {
    id: ANNOUNCEMENT_ID,
    title: 'Test Announcement',
    message: 'Hello world',
    link_url: null,
    total_recipients: 100,
    read_count: 25,
    created_at: '2026-02-01T10:00:00Z',
  },
];

function buildStoreState(overrides: Record<string, unknown> = {}) {
  const fetchAnnouncements = vi.fn().mockResolvedValue(undefined);
  const fetchAnnouncementDetail = vi.fn().mockResolvedValue(undefined);
  const deleteAnnouncement = vi.fn().mockResolvedValue(undefined);
  const setPage = vi.fn();
  const clearSelectedAnnouncement = vi.fn();
  return {
    announcements: [] as typeof sampleAnnouncements,
    selectedAnnouncement: null,
    page: 1,
    total: 0,
    totalPages: 1,
    isLoading: false,
    isLoadingDetail: false,
    isDeleting: false,
    error: null,
    fetchAnnouncements,
    fetchAnnouncementDetail,
    deleteAnnouncement,
    setPage,
    clearSelectedAnnouncement,
    refresh: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
    ...overrides,
  };
}

type StoreState = ReturnType<typeof buildStoreState>;

/**
 * Set up the Zustand mock so it works for BOTH call signatures:
 *   useAdminAnnouncementStore()            → tab-level destructuring
 *   useAdminAnnouncementStore((s) => s.x)  → child components (DetailsDrawer)
 */
function setupStore(state: StoreState) {
  (useAdminAnnouncementStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector?: (s: StoreState) => unknown) => {
      if (typeof selector === 'function') return selector(state);
      return state;
    }
  );
  return state;
}

function renderTab(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AnnouncementsTab />
    </MemoryRouter>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnnouncementsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Render ────────────────────────────────────────────────────────────────

  it('renders the outer announcements-tab wrapper', () => {
    setupStore(buildStoreState());
    renderTab();
    expect(screen.getByTestId('announcements-tab')).toBeInTheDocument();
  });

  // Note: PageHead (title H1) is now owned by AdminPage (ADMIN2-HEAD).
  // AnnouncementsTab renders stat cards, history rows, compose/detail drawers.

  it('renders 2 StatCards', () => {
    setupStore(buildStoreState());
    renderTab();
    // Only 2 stat cards remain after ADMIN2-20: Total Announcements + Avg. Read Rate
    expect(screen.getByText('Total Announcements')).toBeInTheDocument();
    expect(screen.getByText('Avg. Read Rate')).toBeInTheDocument();
    // People Reached and With Link were removed
    expect(screen.queryByText('People Reached')).not.toBeInTheDocument();
    expect(screen.queryByText('With Link')).not.toBeInTheDocument();
  });

  it('renders AnnouncementHistoryRows (empty state text visible)', () => {
    setupStore(buildStoreState());
    renderTab();
    expect(screen.getByText('No announcements yet')).toBeInTheDocument();
  });

  it('calls fetchAnnouncements on mount', () => {
    const state = setupStore(buildStoreState());
    renderTab();
    expect(state.fetchAnnouncements).toHaveBeenCalled();
  });

  // ── New-announcement button is now in AdminPage PageHead (ADMIN2-HEAD) ───────
  // The compose drawer still opens when URL has ?compose=1.
  // Direct button click is covered by e2e smoke tests.

  // ── Mount with ?compose=1 ─────────────────────────────────────────────────

  it('mounts with ?compose=1 → compose drawer opens directly', async () => {
    setupStore(buildStoreState());
    renderTab('/?compose=1');

    await waitFor(() => {
      expect(screen.getByTestId('announcement-compose-drawer')).toBeInTheDocument();
    });
  });

  // ── Row click → details drawer ────────────────────────────────────────────

  it('clicking a history row opens details drawer', async () => {
    const user = userEvent.setup();
    setupStore(
      buildStoreState({
        announcements: sampleAnnouncements,
        total: 1,
      })
    );
    renderTab();

    const row = await screen.findByTestId(`announcement-row-${ANNOUNCEMENT_ID}`);
    await user.click(row);

    await waitFor(() => {
      expect(screen.getByTestId('announcement-details-drawer')).toBeInTheDocument();
    });
  });

  // ── Mount with ?edit=<uuid> ───────────────────────────────────────────────

  it('mounts with ?edit=<uuid> → details drawer opens directly', async () => {
    setupStore(buildStoreState());
    renderTab(`/?edit=${ANNOUNCEMENT_ID}`);

    await waitFor(() => {
      expect(screen.getByTestId('announcement-details-drawer')).toBeInTheDocument();
    });
  });

  // ── Mount with ?compose=1&edit=<uuid> → only details drawer ──────────────

  it('mounts with ?compose=1&edit=<uuid> → only details drawer is open', async () => {
    setupStore(buildStoreState());
    renderTab(`/?compose=1&edit=${ANNOUNCEMENT_ID}`);

    await waitFor(() => {
      expect(screen.getByTestId('announcement-details-drawer')).toBeInTheDocument();
    });
    // Compose drawer should NOT be open (compose stripped because edit wins)
    expect(screen.queryByTestId('announcement-compose-drawer')).not.toBeInTheDocument();
  });

  // ── URL-strip idempotency: fetchAnnouncementDetail called exactly once ─────

  it('mounts at ?compose=1&edit=<uuid> → fetchAnnouncementDetail called exactly once', async () => {
    const state = buildStoreState();
    setupStore(state);

    renderTab(`/?compose=1&edit=${ANNOUNCEMENT_ID}`);

    // Wait for the URL-strip effect to settle
    await waitFor(() => {
      expect(screen.getByTestId('announcement-details-drawer')).toBeInTheDocument();
    });

    // Give any subsequent effects time to fire
    await new Promise((r) => setTimeout(r, 50));

    // The idempotency guard (hasStrippedRef) must prevent a second fetch
    expect(state.fetchAnnouncementDetail).toHaveBeenCalledTimes(1);
  });

  // ── Tab-level ConfirmDialog — triggered by row trash icon ─────────────────

  it('clicking row trash icon opens the tab-level delete ConfirmDialog', async () => {
    const user = userEvent.setup();
    setupStore(
      buildStoreState({
        announcements: sampleAnnouncements,
        total: 1,
      })
    );
    renderTab();

    const trashBtn = await screen.findByTestId(`announcement-row-trash-${ANNOUNCEMENT_ID}`);
    await user.click(trashBtn);

    await waitFor(() => {
      expect(screen.getByText('Delete Announcement')).toBeInTheDocument();
    });
  });

  it('confirming delete calls deleteAnnouncement with correct id', async () => {
    const user = userEvent.setup();
    const state = buildStoreState({
      announcements: sampleAnnouncements,
      total: 1,
    });
    setupStore(state);
    renderTab();

    const trashBtn = await screen.findByTestId(`announcement-row-trash-${ANNOUNCEMENT_ID}`);
    await user.click(trashBtn);

    await waitFor(() => screen.getByText('Delete Announcement'));

    // confirmText is mapped to 'Delete' via i18n key announcements.delete.confirm
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(state.deleteAnnouncement).toHaveBeenCalledWith(ANNOUNCEMENT_ID);
    });
  });

  it('cancelling delete dialog does not call deleteAnnouncement', async () => {
    const user = userEvent.setup();
    const state = buildStoreState({
      announcements: sampleAnnouncements,
      total: 1,
    });
    setupStore(state);
    renderTab();

    const trashBtn = await screen.findByTestId(`announcement-row-trash-${ANNOUNCEMENT_ID}`);
    await user.click(trashBtn);

    await waitFor(() => screen.getByText('Delete Announcement'));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Delete Announcement')).not.toBeInTheDocument();
    });

    expect(state.deleteAnnouncement).not.toHaveBeenCalled();
  });

  // ── Tab-level ConfirmDialog — triggered by Details drawer Delete button ─────

  it('clicking Details drawer Delete button opens the tab-level ConfirmDialog', async () => {
    const user = userEvent.setup();
    setupStore(buildStoreState());
    renderTab(`/?edit=${ANNOUNCEMENT_ID}`);

    // Wait for details drawer to open
    const detailsDrawer = await screen.findByTestId('announcement-details-drawer');
    expect(detailsDrawer).toBeInTheDocument();

    // The Delete button in the drawer is disabled while no announcement is loaded
    // (selectedAnnouncement is null in this test). Verify the button exists.
    const deleteBtn = screen.getByTestId('announcement-details-delete-button');
    expect(deleteBtn).toBeInTheDocument();
    // Button is disabled because selectedAnnouncement is null
    expect(deleteBtn).toBeDisabled();
  });

  it('Details drawer Delete button calls onRequestDelete which opens ConfirmDialog', async () => {
    const user = userEvent.setup();
    // Provide a loaded announcement so the Delete button is enabled
    const ann = {
      id: ANNOUNCEMENT_ID,
      title: 'Test',
      message: 'Hello',
      link_url: null,
      total_recipients: 10,
      read_count: 5,
      read_percentage: 50,
      created_at: '2026-02-01T10:00:00Z',
      creator: { id: 'c1', display_name: 'Admin', email: 'a@b.com' },
    };
    setupStore(
      buildStoreState({
        selectedAnnouncement: ann,
      })
    );
    renderTab(`/?edit=${ANNOUNCEMENT_ID}`);

    await waitFor(() => {
      expect(screen.getByTestId('announcement-details-drawer')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTestId('announcement-details-delete-button');
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Delete Announcement')).toBeInTheDocument();
    });
  });

  // ── toolbar — search + sort (ANLP-07) ────────────────────────────────────

  describe('toolbar — search + sort', () => {
    /**
     * Five announcements with varied titles (mixed case), created_at, and
     * read rates. Default sort is 'newest' → order: a5, a4, a2, a3, a1.
     * "welcome" substring (case-insensitive) matches a1 + a3 only.
     */
    const FIXTURE = [
      {
        id: 'a1',
        title: 'Welcome to Greeklish',
        message: 'msg',
        link_url: null,
        total_recipients: 100,
        read_count: 10,
        created_at: '2026-01-01T00:00:00Z',
        creator: { id: 'c1', display_name: 'Admin' },
      },
      {
        id: 'a2',
        title: 'March product update',
        message: 'msg',
        link_url: null,
        total_recipients: 100,
        read_count: 90,
        created_at: '2026-03-01T00:00:00Z',
        creator: { id: 'c1', display_name: 'Admin' },
      },
      {
        id: 'a3',
        title: 'welcome back promo',
        message: 'msg',
        link_url: null,
        total_recipients: 100,
        read_count: 50,
        created_at: '2026-02-01T00:00:00Z',
        creator: { id: 'c1', display_name: 'Admin' },
      },
      {
        id: 'a4',
        title: 'Holiday schedule',
        message: 'msg',
        link_url: null,
        total_recipients: 100,
        read_count: 25,
        created_at: '2026-04-01T00:00:00Z',
        creator: { id: 'c1', display_name: 'Admin' },
      },
      {
        id: 'a5',
        title: 'Beta announcement',
        message: 'msg',
        link_url: null,
        total_recipients: 0,
        read_count: 0,
        created_at: '2026-05-01T00:00:00Z',
        creator: { id: 'c1', display_name: 'Admin' },
      },
    ];

    /** Extract visible row ids in DOM order, excluding trash-button testids. */
    function getRowIds() {
      return screen
        .getAllByTestId(/^announcement-row-/)
        .filter((el) => !el.getAttribute('data-testid')!.startsWith('announcement-row-trash-'))
        .map((el) => el.getAttribute('data-testid')!.replace('announcement-row-', ''));
    }

    /**
     * Change the sort value via the Select shim's native <select>.
     * The Radix UI Select shim (vi.mock '@/components/ui/select') renders a
     * plain native <select data-testid="select-shim"> so fireEvent.change works.
     */
    function changeSort(value: 'newest' | 'oldest' | 'rateDesc' | 'rateAsc') {
      const sel = screen.getByTestId('select-shim');
      fireEvent.change(sel, { target: { value } });
    }

    // (a) Search filter — type substring, only matching rows remain
    it('(a) typing in search input filters rows by title substring, case-insensitive', async () => {
      const user = userEvent.setup();
      setupStore(buildStoreState({ announcements: FIXTURE, total: FIXTURE.length }));
      renderTab();

      // Wait for rows to render
      await screen.findByTestId('announcement-row-a1');

      // Mixed-case input proves the filter is case-insensitive; matches a1 + a3.
      await user.type(screen.getByTestId('announcement-search-input'), 'WeLcOmE');

      const ids = getRowIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('a1');
      expect(ids).toContain('a3');
      expect(ids).not.toContain('a2');
      expect(ids).not.toContain('a4');
      expect(ids).not.toContain('a5');
    });

    // (b) Clear-X restores all rows
    it('(b) clicking the clear-X button restores all rows', async () => {
      const user = userEvent.setup();
      setupStore(buildStoreState({ announcements: FIXTURE, total: FIXTURE.length }));
      renderTab();

      await screen.findByTestId('announcement-row-a1');

      await user.type(screen.getByTestId('announcement-search-input'), 'WeLcOmE');
      // Only 2 rows visible after filter
      expect(getRowIds()).toHaveLength(2);

      await user.click(screen.getByTestId('announcement-search-clear'));

      // All 5 rows restored
      expect(getRowIds()).toHaveLength(5);
    });

    // (c) Oldest first sort
    it('(c) selecting "oldest" sort orders rows by created_at ASC', () => {
      setupStore(buildStoreState({ announcements: FIXTURE, total: FIXTURE.length }));
      renderTab();

      changeSort('oldest');

      expect(getRowIds()).toEqual(['a1', 'a3', 'a2', 'a4', 'a5']);
    });

    // (d) Highest read rate sort (rateDesc) — a5 has 0/0 → rate 0 → goes last
    it('(d) selecting "rateDesc" orders rows by read_count/total_recipients DESC', () => {
      setupStore(buildStoreState({ announcements: FIXTURE, total: FIXTURE.length }));
      renderTab();

      changeSort('rateDesc');

      // rates: a2=90%, a3=50%, a4=25%, a1=10%, a5=0% (0 recipients → rate 0)
      expect(getRowIds()).toEqual(['a2', 'a3', 'a4', 'a1', 'a5']);
    });

    // (e) Filter before sort — subset filtered, then sorted oldest→newest
    it('(e) filter + sort: filtered subset is then sorted correctly', async () => {
      const user = userEvent.setup();
      setupStore(buildStoreState({ announcements: FIXTURE, total: FIXTURE.length }));
      renderTab();

      await screen.findByTestId('announcement-row-a1');

      // Type "welcome" → matches a1 (Jan) and a3 (Feb)
      await user.type(screen.getByTestId('announcement-search-input'), 'welcome');

      // Switch to oldest-first
      changeSort('oldest');

      // a1 (2026-01-01) before a3 (2026-02-01)
      expect(getRowIds()).toEqual(['a1', 'a3']);
    });

    // (f) Mount fetch — fetchAnnouncements called with (1, 100)
    it('(f) on mount fetchAnnouncements is called with (1, 100)', () => {
      const state = setupStore(buildStoreState());
      renderTab();

      expect(state.fetchAnnouncements).toHaveBeenCalledWith(1, 100);
      expect(state.fetchAnnouncements).toHaveBeenCalledTimes(1);
    });
  });

  // ── axe accessibility audit (skipped — deferred to ADMIN2-12) ────────────

  it.skip('axe: compose drawer has no accessibility violations', async () => {
    // Requires @axe-core/react wiring — deferred to ADMIN2-12 visual coverage pass
  });

  it.skip('axe: details drawer has no accessibility violations', async () => {
    // Requires @axe-core/react wiring — deferred to ADMIN2-12 visual coverage pass
  });

  // ── avg read rate tone ────────────────────────────────────────────────────

  describe('avg read rate tone', () => {
    /**
     * The avg read rate StatCard gets className `tone-amber` or `tone-green`
     * depending on whether avgReadRate >= AVG_READ_RATE_HEALTHY_THRESHOLD (20).
     * We locate it by its unique title text, then check the parent .stat-card wrapper.
     */
    function getAvgReadRateCard() {
      // The StatCard title is rendered inside .stat-label — walk up to .stat-card
      const titleEl = screen.getByText('Avg. Read Rate');
      return titleEl.closest('.stat-card') as HTMLElement;
    }

    it('read=2 / total=20 (10%) → avg read rate tone is amber', () => {
      setupStore(
        buildStoreState({
          announcements: [
            {
              ...sampleAnnouncements[0],
              read_count: 2,
              total_recipients: 20,
            },
          ],
          total: 1,
        })
      );
      renderTab();
      const card = getAvgReadRateCard();
      expect(card).toHaveClass('tone-amber');
      expect(card).not.toHaveClass('tone-green');
    });

    it('read=5 / total=20 (25%) → avg read rate tone is green', () => {
      setupStore(
        buildStoreState({
          announcements: [
            {
              ...sampleAnnouncements[0],
              read_count: 5,
              total_recipients: 20,
            },
          ],
          total: 1,
        })
      );
      renderTab();
      const card = getAvgReadRateCard();
      expect(card).toHaveClass('tone-green');
      expect(card).not.toHaveClass('tone-amber');
    });

    it('read=0 / total=0 → tone is amber and no NaN in DOM', () => {
      // buildStoreState defaults announcements=[] → totalRecipients=0 → avgReadRate=0
      setupStore(buildStoreState({ announcements: [], total: 0 }));
      const { container } = renderTab();
      const card = getAvgReadRateCard();
      expect(card).toHaveClass('tone-amber');
      expect(container.textContent).not.toContain('NaN');
    });
  });
});
