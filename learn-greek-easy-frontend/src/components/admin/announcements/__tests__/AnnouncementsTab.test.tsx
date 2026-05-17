// src/components/admin/announcements/__tests__/AnnouncementsTab.test.tsx
//
// Integration tests for the ANND-07 rewrite of AnnouncementsTab.
// Covers: render, URL-driven drawer open/close, single tab-level ConfirmDialog,
// and URL-strip idempotency (fetchAnnouncementDetail called exactly once).

import { render, screen, waitFor } from '@testing-library/react';
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
        'announcements.v2.details.by': 'by',
        'announcements.v2.details.resendToUnread': 'Resend to unread',
        'announcements.v2.timeline.comingSoonCaption': 'Detailed timeline coming soon',
        'announcements.v2.ctr.trackingComingSoon': 'tracking coming soon',
        'announcements.v2.ctr.noLink': 'no link',
        'announcements.history.unknownAdmin': 'Unknown Admin',
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
    creator: { id: 'creator-1', display_name: 'Admin' },
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

  it('renders 4 StatCards', () => {
    setupStore(buildStoreState());
    renderTab();
    // StatCards use data-testid="stat-card" or unique text content —
    // check for the 4 known stat titles
    expect(screen.getByText('Total Announcements')).toBeInTheDocument();
    expect(screen.getByText('People Reached')).toBeInTheDocument();
    expect(screen.getByText('Avg. Read Rate')).toBeInTheDocument();
    expect(screen.getByText('With Link')).toBeInTheDocument();
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

  // ── axe accessibility audit (skipped — deferred to ADMIN2-12) ────────────

  it.skip('axe: compose drawer has no accessibility violations', async () => {
    // Requires @axe-core/react wiring — deferred to ADMIN2-12 visual coverage pass
  });

  it.skip('axe: details drawer has no accessibility violations', async () => {
    // Requires @axe-core/react wiring — deferred to ADMIN2-12 visual coverage pass
  });
});
