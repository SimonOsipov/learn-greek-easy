// src/components/admin/announcements/__tests__/AnnouncementComposeDrawer.test.tsx

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useAdminAnnouncementStore } from '@/stores/adminAnnouncementStore';
import { adminAPI } from '@/services/adminAPI';

import { AnnouncementComposeDrawer } from '../AnnouncementComposeDrawer';

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/stores/adminAnnouncementStore', () => ({
  useAdminAnnouncementStore: vi.fn(),
}));

vi.mock('@/services/adminAPI', () => ({
  GENERATE_WORD_ENTRY_STREAM_URL: '/api/v1/admin/word-entries/generate/stream',
  adminAPI: {
    createAnnouncement: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildDefaultStore(overrides: Record<string, unknown> = {}) {
  const fetchAnnouncements = vi.fn().mockResolvedValue(undefined);
  return { fetchAnnouncements, ...overrides };
}

function setupStore(state: ReturnType<typeof buildDefaultStore>) {
  (useAdminAnnouncementStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state)
  );
  return state;
}

function renderDrawer(
  props: { open?: boolean; onClose?: () => void } = {},
  initialPath = '/?compose=1'
) {
  const onClose = props.onClose ?? vi.fn();
  const open = props.open ?? true;
  return {
    onClose,
    ...render(
      <MemoryRouter initialEntries={[initialPath]}>
        <AnnouncementComposeDrawer open={open} onClose={onClose} />
      </MemoryRouter>
    ),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AnnouncementComposeDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore(buildDefaultStore());
  });

  // ── Form mode render ──────────────────────────────────────────────────────

  it('renders Title, Message, and Link URL inputs in form mode', () => {
    renderDrawer();

    expect(screen.getByTestId('announcement-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-message-input')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-link-input')).toBeInTheDocument();
  });

  it('renders audience picker with 7 buttons (1 active + 6 gated)', () => {
    renderDrawer();

    // "All learners" is the active one; 6 segments are gated
    const audButtons = document.querySelectorAll('.ann-aud-btn');
    expect(audButtons).toHaveLength(7);
  });

  it('renders schedule section with Send now radio and Schedule for later', () => {
    renderDrawer();

    // The schedule section's "Send now" option uses role="radio"
    const scheduleSection = document.querySelector('.ann-sched');
    expect(scheduleSection).toBeInTheDocument();
    expect(scheduleSection!.textContent).toContain('Send now');
    expect(scheduleSection!.textContent).toContain('Schedule for later');
  });

  it('renders Send now button as disabled when form is empty', () => {
    renderDrawer();

    const sendBtn = screen.getByTestId('announcement-compose-send-button');
    expect(sendBtn).toBeDisabled();
  });

  it('enables Send now button after title and message are filled', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.type(screen.getByTestId('announcement-title-input'), 'My Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'My Message');

    await waitFor(() => {
      expect(screen.getByTestId('announcement-compose-send-button')).not.toBeDisabled();
    });
  });

  // ── JSON mode render ──────────────────────────────────────────────────────

  it('renders JSON textarea when JSON tab is selected', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByTestId('announcement-compose-tab-json'));

    await waitFor(() => {
      expect(screen.getByTestId('announcement-json-textarea')).toBeInTheDocument();
    });
  });

  it('shows "Preview not available in JSON mode" when preview is toggled in JSON mode', async () => {
    const user = userEvent.setup();
    renderDrawer();

    // Switch to JSON tab (preview defaults to visible)
    await user.click(screen.getByTestId('announcement-compose-tab-json'));

    await waitFor(() => {
      expect(screen.getByText('Preview not available in JSON mode')).toBeInTheDocument();
    });
  });

  // ── Form ownership / live preview ─────────────────────────────────────────

  it('updates preview card title when title input is typed', async () => {
    const user = userEvent.setup();
    renderDrawer();

    // Before typing, placeholder is shown
    const previewTitle = screen.getByTestId('announcement-preview-card-title');
    expect(previewTitle.textContent).toMatch(/Your announcement title/i);

    await user.type(screen.getByTestId('announcement-title-input'), 'Live Preview Test');

    await waitFor(() => {
      expect(screen.getByTestId('announcement-preview-card-title').textContent).toBe(
        'Live Preview Test'
      );
    });
  });

  // ── Audience gating ───────────────────────────────────────────────────────

  it('gated audience buttons have aria-disabled="true"', () => {
    renderDrawer();

    const gatedBtns = document.querySelectorAll('.ann-aud-btn[aria-disabled="true"]');
    expect(gatedBtns).toHaveLength(6);
  });

  it('gated audience buttons are not hard-disabled (aria-disabled used instead)', () => {
    renderDrawer();

    // Gated buttons use aria-disabled="true" rather than the disabled attribute,
    // so they remain focusable by assistive technology (AT can still read them).
    const gatedBtns = document.querySelectorAll('.ann-aud-btn[aria-disabled="true"]');
    expect(gatedBtns.length).toBe(6);
    gatedBtns.forEach((btn) => {
      expect((btn as HTMLElement).hasAttribute('disabled')).toBe(false);
    });
  });

  it('clicking a gated audience button does not change form state', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const gatedBtns = document.querySelectorAll('.ann-aud-btn[aria-disabled="true"]');
    const firstGated = gatedBtns[0] as HTMLElement;
    await user.click(firstGated);

    // Form is still clean — Send button still disabled
    expect(screen.getByTestId('announcement-compose-send-button')).toBeDisabled();
  });

  // ── Schedule gating ───────────────────────────────────────────────────────

  it('"Schedule for later" has aria-disabled="true"', () => {
    renderDrawer();

    const scheduleLater = screen.getByText('Schedule for later').closest('[role="radio"]');
    expect(scheduleLater).toHaveAttribute('aria-disabled', 'true');
  });

  it('clicking "Schedule for later" does not enable submit', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const scheduleLater = screen.getByText('Schedule for later');
    await user.click(scheduleLater);

    // Send button remains disabled — click was no-op
    expect(screen.getByTestId('announcement-compose-send-button')).toBeDisabled();
  });

  // ── Mode-switch dirty guard ───────────────────────────────────────────────

  it('shows ConfirmDialog when switching to JSON tab with dirty form', async () => {
    const user = userEvent.setup();
    renderDrawer();

    // Make form dirty
    await user.type(screen.getByTestId('announcement-title-input'), 'Some text');

    // Click JSON tab
    await user.click(screen.getByTestId('announcement-compose-tab-json'));

    await waitFor(() => {
      expect(screen.getByText('Switch mode?')).toBeInTheDocument();
    });
  });

  it('stays on Form tab when Cancel is clicked in mode-switch dialog', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.type(screen.getByTestId('announcement-title-input'), 'Some text');
    await user.click(screen.getByTestId('announcement-compose-tab-json'));

    await waitFor(() => screen.getByText('Switch mode?'));

    // Click Cancel in the dialog
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      // JSON tab should NOT be active
      const jsonTab = screen.getByTestId('announcement-compose-tab-json');
      expect(jsonTab).not.toHaveAttribute('aria-selected', 'true');
      // Form inputs still present
      expect(screen.getByTestId('announcement-title-input')).toBeInTheDocument();
    });
  });

  // ── Close dirty guard ─────────────────────────────────────────────────────

  it('shows ConfirmDialog when Cancel is clicked with dirty form', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.type(screen.getByTestId('announcement-title-input'), 'Dirty');
    await user.click(screen.getByTestId('announcement-compose-cancel-button'));

    await waitFor(() => {
      expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    });
  });

  it('closes drawer when Confirm is clicked in close-guard dialog', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer({ onClose });

    await user.type(screen.getByTestId('announcement-title-input'), 'Dirty');
    await user.click(screen.getByTestId('announcement-compose-cancel-button'));

    await waitFor(() => screen.getByText('Discard changes?'));

    // Click the confirm button — it has text "Confirm" by default
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('keeps drawer open when Cancel is clicked in close-guard dialog', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer({ onClose });

    await user.type(screen.getByTestId('announcement-title-input'), 'Dirty');
    await user.click(screen.getByTestId('announcement-compose-cancel-button'));

    await waitFor(() => screen.getByText('Discard changes?'));

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled();
    });

    // Form inputs still visible
    expect(screen.getByTestId('announcement-title-input')).toBeInTheDocument();
  });

  // ── Submit happy path ─────────────────────────────────────────────────────

  it('calls adminAPI.createAnnouncement with correct payload on submit', async () => {
    const user = userEvent.setup();
    (adminAPI.createAnnouncement as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'new-id',
    });
    const onClose = vi.fn();
    setupStore(buildDefaultStore());
    renderDrawer({ onClose });

    await user.type(screen.getByTestId('announcement-title-input'), 'Test Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Test Message');
    await user.type(screen.getByTestId('announcement-link-input'), 'https://greeklish.eu');

    await waitFor(() => {
      expect(screen.getByTestId('announcement-compose-send-button')).not.toBeDisabled();
    });

    await user.click(screen.getByTestId('announcement-compose-send-button'));

    await waitFor(() => {
      expect(adminAPI.createAnnouncement).toHaveBeenCalledWith({
        title: 'Test Title',
        message: 'Test Message',
        link_url: 'https://greeklish.eu',
      });
    });
  });

  it('awaits fetchAnnouncements before closing on successful submit', async () => {
    const user = userEvent.setup();

    // Control fetch resolution timing
    let resolveFetch!: () => void;
    const fetchPromise = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchAnnouncements = vi.fn().mockReturnValue(fetchPromise);
    (adminAPI.createAnnouncement as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'x' });
    const onClose = vi.fn();
    setupStore(buildDefaultStore({ fetchAnnouncements }));
    renderDrawer({ onClose });

    await user.type(screen.getByTestId('announcement-title-input'), 'Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Message');
    await waitFor(() =>
      expect(screen.getByTestId('announcement-compose-send-button')).not.toBeDisabled()
    );

    await user.click(screen.getByTestId('announcement-compose-send-button'));

    // At this point createAnnouncement resolved, but fetchAnnouncements hasn't
    expect(fetchAnnouncements).toHaveBeenCalled();
    // onClose should NOT be called yet
    expect(onClose).not.toHaveBeenCalled();

    // Now resolve the fetch
    resolveFetch();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── Submit error path ─────────────────────────────────────────────────────

  it('fires destructive toast on API rejection', async () => {
    const user = userEvent.setup();
    (adminAPI.createAnnouncement as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );
    renderDrawer();

    await user.type(screen.getByTestId('announcement-title-input'), 'Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Message');
    await waitFor(() =>
      expect(screen.getByTestId('announcement-compose-send-button')).not.toBeDisabled()
    );

    await user.click(screen.getByTestId('announcement-compose-send-button'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });
  });

  it('keeps drawer open after API rejection', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    (adminAPI.createAnnouncement as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );
    renderDrawer({ onClose });

    await user.type(screen.getByTestId('announcement-title-input'), 'Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Message');
    await waitFor(() =>
      expect(screen.getByTestId('announcement-compose-send-button')).not.toBeDisabled()
    );

    await user.click(screen.getByTestId('announcement-compose-send-button'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('announcement-title-input')).toBeInTheDocument();
  });

  it('re-enables Send button after API rejection clears submitting state', async () => {
    const user = userEvent.setup();
    (adminAPI.createAnnouncement as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    renderDrawer();

    await user.type(screen.getByTestId('announcement-title-input'), 'Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Message');
    await waitFor(() =>
      expect(screen.getByTestId('announcement-compose-send-button')).not.toBeDisabled()
    );

    await user.click(screen.getByTestId('announcement-compose-send-button'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });

    // After error, button should be re-enabled (form still valid, not submitting)
    await waitFor(() => {
      expect(screen.getByTestId('announcement-compose-send-button')).not.toBeDisabled();
    });
  });
});
