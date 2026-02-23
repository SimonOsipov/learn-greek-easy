// src/components/admin/announcements/__tests__/AnnouncementsTab.test.tsx
//
// Tests for the mode-switching behavior introduced in TASK-160:
// - Form/JSON tabs render correctly
// - Mode switch without dirty data: no dialog, immediate switch
// - Mode switch with dirty JSON: shows ConfirmDialog
// - Mode switch with dirty form: shows ConfirmDialog
// - Confirm on dialog: switches mode and clears input
// - Cancel on dialog: stays on current mode
// - Preview works from JSON mode (calls AnnouncementPreviewModal)

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AnnouncementsTab } from '../AnnouncementsTab';

// ---- Mocks ----

// Mock i18n — cover keys used in AnnouncementsTab, AnnouncementCreateForm, AnnouncementJsonInput
// and ConfirmDialog title/description
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'announcements.create.title': 'Create Announcement',
        'announcements.create.description': 'Send a notification to all active users',
        'announcements.create.modeForm': 'Form',
        'announcements.create.modeJson': 'JSON',
        'announcements.create.switchModeConfirmTitle': 'Switch mode?',
        'announcements.create.switchModeConfirm': 'Your current input will be cleared. Continue?',
        'announcements.create.titleLabel': 'Title',
        'announcements.create.titlePlaceholder': 'Enter announcement title',
        'announcements.create.messageLabel': 'Message',
        'announcements.create.messagePlaceholder': 'Enter the announcement message...',
        'announcements.create.linkLabel': 'Link URL',
        'announcements.create.linkPlaceholder': 'https://example.com/page',
        'announcements.create.linkDescription': 'Users can click this link',
        'announcements.create.optional': 'optional',
        'announcements.create.preview': 'Preview',
        'announcements.create.jsonHint':
          'Paste a JSON object with title, message, and optional link_url.',
        'announcements.create.jsonPlaceholder': '{"title":"..."}',
        'announcements.create.jsonInvalidJson': 'Invalid JSON. Please check your syntax.',
        'announcements.create.jsonTitleRequired': 'Title is required.',
        'announcements.create.jsonTitleTooLong': 'Title must be 100 characters or less.',
        'announcements.create.jsonMessageRequired': 'Message is required.',
        'announcements.create.jsonMessageTooLong': 'Message must be 500 characters or less.',
        'announcements.create.jsonInvalidUrl': 'Link URL must be a valid URL.',
        'announcements.create.jsonUrlTooLong': 'Link URL must be 500 characters or less.',
        'announcements.stats.total': 'Total Announcements',
        'announcements.stats.avgRead': 'Avg. Read Rate',
        'announcements.history.title': 'Announcement History',
        'announcements.history.description': 'View all past announcements',
        'announcements.history.empty': 'No announcements yet',
        'announcements.history.emptyHint': 'Create your first announcement above',
        'announcements.history.viewDetail': 'View Details',
        'announcements.history.by': 'by',
        'announcements.history.unknownAdmin': 'Unknown Admin',
        'announcements.preview.title': 'Preview Announcement',
        'announcements.preview.description': 'Review before sending',
        'announcements.preview.warningTitle': 'This action cannot be undone',
        'announcements.preview.warningMessage': 'Once sent...',
        'announcements.preview.cancel': 'Edit',
        'announcements.preview.send': 'Send to All Users',
        'announcements.preview.sending': 'Sending...',
        'pagination.pageOf': 'Page 1 of 1',
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
        'announcements.detail.sent': 'Sent to',
        'announcements.detail.read': 'Read by',
      };
      return map[key] || key;
    },
    i18n: { language: 'en' },
  }),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// Mock adminAPI
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getAnnouncements: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
    }),
    createAnnouncement: vi.fn().mockResolvedValue({}),
  },
}));

// Mock the announcement store
const mockFetchAnnouncements = vi.fn().mockResolvedValue(undefined);
const mockFetchAnnouncementDetail = vi.fn().mockResolvedValue(undefined);
const mockSetPage = vi.fn();
const mockClearSelectedAnnouncement = vi.fn();
const mockRefresh = vi.fn().mockResolvedValue(undefined);

vi.mock('@/stores/adminAnnouncementStore', () => ({
  useAdminAnnouncementStore: () => ({
    announcements: [],
    selectedAnnouncement: null,
    page: 1,
    total: 0,
    totalPages: 1,
    isLoading: false,
    isLoadingDetail: false,
    fetchAnnouncements: mockFetchAnnouncements,
    fetchAnnouncementDetail: mockFetchAnnouncementDetail,
    setPage: mockSetPage,
    clearSelectedAnnouncement: mockClearSelectedAnnouncement,
    refresh: mockRefresh,
  }),
}));

// Minimal mock for error reporting (used by ConfirmDialog)
vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

describe('AnnouncementsTab — mode switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- Tab rendering ----------

  it('renders both Form and JSON tab triggers', () => {
    render(<AnnouncementsTab />);

    expect(screen.getByTestId('create-mode-form-tab')).toBeInTheDocument();
    expect(screen.getByTestId('create-mode-json-tab')).toBeInTheDocument();
  });

  it('shows Form mode content by default', () => {
    render(<AnnouncementsTab />);

    // Form mode shows the create form elements
    expect(screen.getByTestId('announcement-create-form')).toBeInTheDocument();
    expect(screen.queryByTestId('announcement-json-textarea')).not.toBeInTheDocument();
  });

  it('shows JSON mode content after clicking JSON tab', async () => {
    const user = userEvent.setup();
    render(<AnnouncementsTab />);

    await user.click(screen.getByTestId('create-mode-json-tab'));

    expect(screen.getByTestId('announcement-json-textarea')).toBeInTheDocument();
    expect(screen.queryByTestId('announcement-create-form')).not.toBeInTheDocument();
  });

  // ---------- Mode switch without dirty data ----------

  it('switches from Form to JSON immediately when form has no input', async () => {
    const user = userEvent.setup();
    render(<AnnouncementsTab />);

    // Form mode is active, no data typed
    await user.click(screen.getByTestId('create-mode-json-tab'));

    // Should switch immediately without showing ConfirmDialog
    expect(screen.getByTestId('announcement-json-textarea')).toBeInTheDocument();
    // ConfirmDialog should NOT be visible
    expect(screen.queryByText('Switch mode?')).not.toBeInTheDocument();
  });

  it('switches from JSON to Form immediately when JSON textarea is empty', async () => {
    const user = userEvent.setup();
    render(<AnnouncementsTab />);

    // Switch to JSON mode first
    await user.click(screen.getByTestId('create-mode-json-tab'));
    expect(screen.getByTestId('announcement-json-textarea')).toBeInTheDocument();

    // Switch back to Form without typing anything
    await user.click(screen.getByTestId('create-mode-form-tab'));

    expect(screen.getByTestId('announcement-create-form')).toBeInTheDocument();
    expect(screen.queryByText('Switch mode?')).not.toBeInTheDocument();
  });

  // ---------- Mode switch with dirty JSON ----------

  it('shows ConfirmDialog when switching away from JSON mode with dirty textarea', async () => {
    const user = userEvent.setup();
    render(<AnnouncementsTab />);

    // Switch to JSON mode
    await user.click(screen.getByTestId('create-mode-json-tab'));

    // Type something to make it dirty
    const textarea = screen.getByTestId('announcement-json-textarea');
    fireEvent.change(textarea, { target: { value: '{"title":"Test"}' } });

    // Try switching to Form mode
    await user.click(screen.getByTestId('create-mode-form-tab'));

    // ConfirmDialog should appear
    await waitFor(() => {
      expect(screen.getByText('Switch mode?')).toBeInTheDocument();
    });
    expect(screen.getByText('Your current input will be cleared. Continue?')).toBeInTheDocument();
  });

  it('stays on JSON mode when Cancel is clicked in ConfirmDialog', async () => {
    const user = userEvent.setup();
    render(<AnnouncementsTab />);

    // Switch to JSON and dirty it
    await user.click(screen.getByTestId('create-mode-json-tab'));
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: '{"title":"Test"}' },
    });

    // Try to switch
    await user.click(screen.getByTestId('create-mode-form-tab'));
    await waitFor(() => {
      expect(screen.getByText('Switch mode?')).toBeInTheDocument();
    });

    // Click Cancel button in ConfirmDialog
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    // Should still be on JSON mode
    await waitFor(() => {
      expect(screen.queryByText('Switch mode?')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('announcement-json-textarea')).toBeInTheDocument();
  });

  it('switches to Form mode and clears JSON textarea when Confirm is clicked', async () => {
    const user = userEvent.setup();
    render(<AnnouncementsTab />);

    // Switch to JSON and dirty it
    await user.click(screen.getByTestId('create-mode-json-tab'));
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: '{"title":"Test"}' },
    });

    // Try to switch to Form
    await user.click(screen.getByTestId('create-mode-form-tab'));
    await waitFor(() => {
      expect(screen.getByText('Switch mode?')).toBeInTheDocument();
    });

    // Click Confirm button
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    // Should now show Form mode
    await waitFor(() => {
      expect(screen.getByTestId('announcement-create-form')).toBeInTheDocument();
    });
    expect(screen.queryByText('Switch mode?')).not.toBeInTheDocument();
  });

  // ---------- Mode switch with dirty form ----------

  it('shows ConfirmDialog when switching away from Form mode with typed input', async () => {
    const user = userEvent.setup();
    render(<AnnouncementsTab />);

    // Form is the default mode; fire an input event to mark it dirty
    // We use fireEvent.input directly on the wrapping div since the dirty ref
    // is set via onInput on the wrapper div
    const titleInput = screen.getByTestId('announcement-title-input');
    await user.type(titleInput, 'Hello');

    // Try to switch to JSON
    await user.click(screen.getByTestId('create-mode-json-tab'));

    // ConfirmDialog should appear
    await waitFor(() => {
      expect(screen.getByText('Switch mode?')).toBeInTheDocument();
    });
  });

  it('switches from Form to JSON and shows empty textarea after confirm', async () => {
    const user = userEvent.setup();
    render(<AnnouncementsTab />);

    const titleInput = screen.getByTestId('announcement-title-input');
    await user.type(titleInput, 'Hello');

    await user.click(screen.getByTestId('create-mode-json-tab'));
    await waitFor(() => {
      expect(screen.getByText('Switch mode?')).toBeInTheDocument();
    });

    // Confirm the switch
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(screen.getByTestId('announcement-json-textarea')).toBeInTheDocument();
    });

    // Textarea should be empty after reset
    expect(screen.getByTestId('announcement-json-textarea')).toHaveValue('');
  });

  // ---------- Preview from JSON mode ----------

  it('opens preview modal when valid JSON is submitted from JSON mode', async () => {
    const user = userEvent.setup();
    render(<AnnouncementsTab />);

    // Switch to JSON
    await user.click(screen.getByTestId('create-mode-json-tab'));

    // Enter valid JSON using fireEvent to avoid curly brace interpretation issues
    const textarea = screen.getByTestId('announcement-json-textarea');
    fireEvent.change(textarea, {
      target: { value: '{"title":"Hello","message":"World message here"}' },
    });

    // Click preview
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    // Preview modal should open — verify preview modal content
    await waitFor(() => {
      expect(screen.getByTestId('announcement-preview-modal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('preview-title')).toHaveTextContent('Hello');
    expect(screen.getByTestId('preview-message')).toHaveTextContent('World message here');
  });
});
