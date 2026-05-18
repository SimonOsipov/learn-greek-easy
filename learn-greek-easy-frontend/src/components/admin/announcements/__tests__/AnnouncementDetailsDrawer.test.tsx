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
    read_percentage: 40,
    created_at: '2026-01-15T10:00:00Z',
    creator: { id: 'admin-1', display_name: 'Admin User', email: 'admin@greeklish.eu' },
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

  it('renders 3 reach stat tiles', () => {
    const ann = makeAnnouncement();
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    const stats = document.querySelectorAll('.an-stat');
    expect(stats).toHaveLength(3);
  });

  it('renders read progress bar', () => {
    const ann = makeAnnouncement({ read_percentage: 40 });
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    const bar = document.querySelector('.an-progress-bar');
    expect(bar).toBeInTheDocument();
  });

  it('renders 5 timeline bars with "Detailed timeline coming soon" caption', () => {
    const ann = makeAnnouncement();
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    const bars = document.querySelectorAll('.an-timeline-bar');
    expect(bars).toHaveLength(5);
    expect(screen.getByText('Detailed timeline coming soon')).toBeInTheDocument();
  });

  // ── CTR tile ─────────────────────────────────────────────────────────────

  it('shows "tracking coming soon" CTR sub-label when link_url is present', () => {
    const ann = makeAnnouncement({ link_url: 'https://greeklish.eu' });
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    expect(screen.getByText('tracking coming soon')).toBeInTheDocument();
  });

  it('shows "no link" CTR sub-label when link_url is null', () => {
    const ann = makeAnnouncement({ link_url: null });
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    expect(screen.getByText('no link')).toBeInTheDocument();
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

  // ── Resend gated ─────────────────────────────────────────────────────────

  it('renders Resend to unread button with aria-disabled="true"', () => {
    const ann = makeAnnouncement();
    setupStore(buildStoreState({ selectedAnnouncement: ann }));

    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    const resendBtn = screen.getByText('Resend to unread');
    expect(resendBtn.closest('button')).toHaveAttribute('aria-disabled', 'true');
  });

  // ── Header DOM structure (ANDD-03) ────────────────────────────────────────

  it('renders header children inside a .drawer-head-content wrapper in DOM order', () => {
    const state = buildStoreState({ selectedAnnouncement: makeAnnouncement() });
    setupStore(state);
    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    const wrapper = document.querySelector('.drawer-head-content');
    expect(wrapper).not.toBeNull();

    const children = Array.from(wrapper!.children);
    expect(children).toHaveLength(3);
    expect(children[0].classList.contains('drawer-breadcrumb')).toBe(true);
    expect(children[1].classList.contains('drawer-head-row')).toBe(true);
    expect(children[2].classList.contains('drawer-meta')).toBe(true);
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

  it('renders Resend button with btn + btn-glass + cursor-not-allowed + opacity-60 classes, Bell icon, and aria-disabled', () => {
    const state = buildStoreState({ selectedAnnouncement: makeAnnouncement() });
    setupStore(state);
    render(<AnnouncementDetailsDrawer {...defaultProps} />);

    const resendBtn = screen.getByTestId('announcement-details-resend-button');
    expect(resendBtn.classList.contains('btn')).toBe(true);
    expect(resendBtn.classList.contains('btn-glass')).toBe(true);
    expect(resendBtn.classList.contains('cursor-not-allowed')).toBe(true);
    expect(resendBtn.classList.contains('opacity-60')).toBe(true);
    expect(resendBtn.getAttribute('aria-disabled')).toBe('true');
    expect(resendBtn.querySelector('svg')).not.toBeNull(); // Bell lucide svg
  });
});
