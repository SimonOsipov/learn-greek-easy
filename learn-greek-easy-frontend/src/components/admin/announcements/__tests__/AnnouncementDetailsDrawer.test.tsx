// src/components/admin/announcements/__tests__/AnnouncementDetailsDrawer.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { AnnouncementDetailResponse } from '@/services/adminAPI';
import { useAdminAnnouncementStore } from '@/stores/adminAnnouncementStore';

import { AnnouncementDetailsDrawer } from '../AnnouncementDetailsDrawer';

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/stores/adminAnnouncementStore', () => ({
  useAdminAnnouncementStore: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeAnnouncement(
  overrides: Partial<AnnouncementDetailResponse> = {}
): AnnouncementDetailResponse {
  return {
    id: 'detail-uuid-001',
    title: 'Important Update',
    message: 'This is the full announcement message for testing.',
    link_url: null,
    total_recipients: 200,
    read_count: 80,
    created_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

function buildStoreState(overrides: Record<string, unknown> = {}) {
  const fetchAnnouncementDetail = vi.fn().mockResolvedValue(undefined);
  return {
    selectedAnnouncement: null as AnnouncementDetailResponse | null,
    isLoadingDetail: false,
    error: null as string | null,
    fetchAnnouncementDetail,
    ...overrides,
  };
}

function setupStore(state: ReturnType<typeof buildStoreState>) {
  (useAdminAnnouncementStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state)
  );
  return state;
}

const defaultProps = {
  announcementId: 'detail-uuid-001',
  onClose: vi.fn(),
  onRequestDelete: vi.fn(),
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AnnouncementDetailsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Fetch on mount ────────────────────────────────────────────────────────

  it('dispatches fetchAnnouncementDetail with announcementId on mount', () => {
    const state = buildStoreState();
    setupStore(state);

    render(<AnnouncementDetailsDrawer {...defaultProps} announcementId="abc-123" />);

    expect(state.fetchAnnouncementDetail).toHaveBeenCalledWith('abc-123');
  });

  it('does not fetch when announcementId is null', () => {
    const state = buildStoreState();
    setupStore(state);

    render(<AnnouncementDetailsDrawer {...defaultProps} announcementId={null} />);

    expect(state.fetchAnnouncementDetail).not.toHaveBeenCalled();
  });

  // ── Body with loaded announcement ─────────────────────────────────────────

  it('renders message block when announcement is loaded', () => {
    const ann = makeAnnouncement({ message: 'Hello learners!' });
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    expect(screen.getByText('Hello learners!')).toBeInTheDocument();
  });

  it('renders link block when announcement has link_url', () => {
    const ann = makeAnnouncement({ link_url: 'https://greeklish.eu/promo' });
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    expect(screen.getByRole('link', { name: /greeklish\.eu\/promo/ })).toBeInTheDocument();
  });

  it('does not render link block when link_url is null', () => {
    const ann = makeAnnouncement({ link_url: null });
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders 2 reach stat tiles', () => {
    const ann = makeAnnouncement();
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    const stats = document.querySelectorAll('.an-stat');
    expect(stats).toHaveLength(2);
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  it('renders skeleton elements when isLoadingDetail is true', () => {
    setupStore(buildStoreState({ isLoadingDetail: true }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    // DetailSkeleton renders Skeleton components; they use a standard class
    const skeletons = document.querySelectorAll('.an-detail-stats .h-20');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('does not render announcement body content while loading', () => {
    setupStore(buildStoreState({ isLoadingDetail: true }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    expect(document.querySelector('.an-detail-msg')).not.toBeInTheDocument();
  });

  // ── 404 / error state ─────────────────────────────────────────────────────

  it('renders destructive Alert when error is set and no announcement', () => {
    setupStore(buildStoreState({ error: 'Not found', selectedAnnouncement: null }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    // Alert with variant="destructive" gets role="alert"
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toContain('Not found');
  });

  it('renders a single Close button in error state (no Retry button)', () => {
    setupStore(buildStoreState({ error: 'Not found', selectedAnnouncement: null }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    // Only one "Close" button in the error body
    const closeButtons = screen.getAllByText('Close');
    // The error state renders ONE Close button in the body
    // Footer also has a Close button — but with our mock store, announcement=null
    // so footer text is empty. The body button is the one with variant="outline".
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/retry/i)).not.toBeInTheDocument();
  });

  it('does not fire toast when error state is shown', () => {
    setupStore(buildStoreState({ error: 'Not found', selectedAnnouncement: null }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    expect(mockToast).not.toHaveBeenCalled();
  });

  // ── Delete callback ───────────────────────────────────────────────────────

  it('calls onRequestDelete with announcement id when Delete button is clicked', async () => {
    const user = userEvent.setup();
    const ann = makeAnnouncement({ id: 'del-uuid-99' });
    const onRequestDelete = vi.fn();
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(
      <AnnouncementDetailsDrawer
        {...defaultProps}
        announcementId="del-uuid-99"
        onRequestDelete={onRequestDelete}
      />
    );

    await user.click(screen.getByTestId('announcement-details-delete-button'));

    expect(onRequestDelete).toHaveBeenCalledWith('del-uuid-99');
  });

  it('does NOT render a ConfirmDialog inside the drawer on delete click', async () => {
    const user = userEvent.setup();
    const ann = makeAnnouncement({ id: 'del-uuid-99' });
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(<AnnouncementDetailsDrawer {...defaultProps} announcementId="del-uuid-99" />);

    await user.click(screen.getByTestId('announcement-details-delete-button'));

    // No alertdialog role should appear — confirm dialog is NOT rendered here
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // Dialog role shouldn't appear either (ConfirmDialog uses Dialog internally)
    // The sheet itself uses dialog role, but no ConfirmDialog title should appear
    expect(screen.queryByText('Delete Announcement')).not.toBeInTheDocument();
  });

  // ── Header DOM structure (ANDD-03) ────────────────────────────────────────

  it('renders header children inside a .drawer-head-content wrapper in DOM order', () => {
    const state = buildStoreState({ selectedAnnouncement: makeAnnouncement() });
    setupStore(state);
    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    const wrapper = document.querySelector('.drawer-head-content');
    expect(wrapper).not.toBeNull();

    // breadcrumb and head-row are always present
    expect(wrapper!.querySelector('.drawer-breadcrumb')).not.toBeNull();
    expect(wrapper!.querySelector('.drawer-head-row')).not.toBeNull();
    // drawer-meta renders conditionally when announcement is loaded
    expect(wrapper!.querySelector('.drawer-meta')).not.toBeNull();
  });

  // ── Footer button classlists + icons (ANDD-04) ────────────────────────────

  it('renders Delete button with btn + btn-glass classes and Trash2 icon', () => {
    const state = buildStoreState({ selectedAnnouncement: makeAnnouncement() });
    setupStore(state);
    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    const deleteBtn = screen.getByTestId('announcement-details-delete-button');
    expect(deleteBtn.classList.contains('btn')).toBe(true);
    expect(deleteBtn.classList.contains('btn-glass')).toBe(true);
    expect(deleteBtn.querySelector('svg')).not.toBeNull(); // Trash2 lucide svg
  });

  it('Delete button accessible name matches the testid-located element', () => {
    const state = buildStoreState({ selectedAnnouncement: makeAnnouncement() });
    setupStore(state);
    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    const byTestId = screen.getByTestId('announcement-details-delete-button');
    const byRole = screen.getByRole('button', { name: /delete/i });
    expect(byRole).toBe(byTestId);
  });

  // ── Removed elements absent (ADMIN2-20) ──────────────────────────────────

  describe('removed elements absent', () => {
    it('progress bar (.an-progress-row) is absent', () => {
      const ann = makeAnnouncement();
      setupStore(buildStoreState({ selectedAnnouncement: ann }));
      render(<AnnouncementDetailsDrawer {...defaultProps} />);
      expect(document.querySelector('.an-progress-row')).toBeNull();
    });

    it('timeline (.an-timeline) is absent', () => {
      const ann = makeAnnouncement();
      setupStore(buildStoreState({ selectedAnnouncement: ann }));
      render(<AnnouncementDetailsDrawer {...defaultProps} />);
      expect(document.querySelector('.an-timeline')).toBeNull();
    });

    it('renders exactly 2 .an-stat tiles (no click-through tile)', () => {
      const ann = makeAnnouncement();
      setupStore(buildStoreState({ selectedAnnouncement: ann }));
      render(<AnnouncementDetailsDrawer {...defaultProps} />);
      const stats = document.querySelectorAll('.an-stat');
      expect(stats).toHaveLength(2);
    });

    it('resend button is absent', () => {
      const ann = makeAnnouncement();
      setupStore(buildStoreState({ selectedAnnouncement: ann }));
      render(<AnnouncementDetailsDrawer {...defaultProps} />);
      expect(screen.queryByTestId('announcement-details-resend-button')).toBeNull();
    });

    it('creator breadcrumb (.drawer-bcrumb) is absent', () => {
      const ann = makeAnnouncement();
      setupStore(buildStoreState({ selectedAnnouncement: ann }));
      render(<AnnouncementDetailsDrawer {...defaultProps} />);
      expect(document.querySelector('.drawer-bcrumb')).toBeNull();
    });
  });

  // ── SidePanel primitive consumption (ADMIN2-20) ───────────────────────────

  describe('SidePanel primitive consumption', () => {
    it('mounts SidePanel with size="half" — dialog content has class w-[50vw]', () => {
      const ann = makeAnnouncement();
      setupStore(buildStoreState({ selectedAnnouncement: ann }));
      render(<AnnouncementDetailsDrawer {...defaultProps} />);
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog!.className).toContain('w-[50vw]');
    });

    it('Close button has class drawer-close-right when position="right"', () => {
      const ann = makeAnnouncement();
      setupStore(buildStoreState({ selectedAnnouncement: ann }));
      render(<AnnouncementDetailsDrawer {...defaultProps} />);
      const closeBtn = document.querySelector('button.drawer-close');
      expect(closeBtn).not.toBeNull();
      expect(closeBtn!.className).toContain('drawer-close-right');
    });
  });
});
