// src/components/admin/announcements/__tests__/AnnouncementPreviewModal.test.tsx

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AnnouncementPreviewModal } from '../AnnouncementPreviewModal';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'announcements.preview.title': 'Preview Announcement',
        'announcements.preview.description': 'Review before sending',
        'announcements.preview.warningTitle': 'This action cannot be undone',
        'announcements.preview.warningMessage': 'Once sent, notifications will be created.',
        'announcements.preview.cancel': 'Edit',
        'announcements.preview.send': 'Send to All Users',
        'announcements.preview.sending': 'Sending...',
      };
      return translations[key] || key;
    },
  }),
}));

describe('AnnouncementPreviewModal', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  const defaultData = {
    title: 'Test Announcement',
    message: 'This is a test message for the announcement.',
    linkUrl: 'https://example.com/link',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders preview content when open', () => {
    render(
      <AnnouncementPreviewModal
        open={true}
        onOpenChange={mockOnOpenChange}
        data={defaultData}
        onConfirm={mockOnConfirm}
        isSubmitting={false}
      />
    );

    expect(screen.getByTestId('announcement-preview-modal')).toBeInTheDocument();
    expect(screen.getByTestId('preview-title')).toHaveTextContent('Test Announcement');
    expect(screen.getByTestId('preview-message')).toHaveTextContent(
      'This is a test message for the announcement.'
    );
    expect(screen.getByTestId('preview-link')).toHaveTextContent('https://example.com/link');
  });

  it('renders preview without link when linkUrl is empty', () => {
    render(
      <AnnouncementPreviewModal
        open={true}
        onOpenChange={mockOnOpenChange}
        data={{ ...defaultData, linkUrl: '' }}
        onConfirm={mockOnConfirm}
        isSubmitting={false}
      />
    );

    expect(screen.getByTestId('preview-title')).toBeInTheDocument();
    expect(screen.getByTestId('preview-message')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-link')).not.toBeInTheDocument();
  });

  it('shows warning message', () => {
    render(
      <AnnouncementPreviewModal
        open={true}
        onOpenChange={mockOnOpenChange}
        data={defaultData}
        onConfirm={mockOnConfirm}
        isSubmitting={false}
      />
    );

    expect(screen.getByText('This action cannot be undone')).toBeInTheDocument();
    expect(screen.getByText('Once sent, notifications will be created.')).toBeInTheDocument();
  });

  it('calls onOpenChange when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <AnnouncementPreviewModal
        open={true}
        onOpenChange={mockOnOpenChange}
        data={defaultData}
        onConfirm={mockOnConfirm}
        isSubmitting={false}
      />
    );

    await user.click(screen.getByTestId('preview-cancel-button'));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onConfirm when send button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <AnnouncementPreviewModal
        open={true}
        onOpenChange={mockOnOpenChange}
        data={defaultData}
        onConfirm={mockOnConfirm}
        isSubmitting={false}
      />
    );

    await user.click(screen.getByTestId('preview-send-button'));

    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it('shows loading state when submitting', () => {
    render(
      <AnnouncementPreviewModal
        open={true}
        onOpenChange={mockOnOpenChange}
        data={defaultData}
        onConfirm={mockOnConfirm}
        isSubmitting={true}
      />
    );

    expect(screen.getByTestId('preview-send-button')).toHaveTextContent('Sending...');
    expect(screen.getByTestId('preview-send-button')).toBeDisabled();
  });

  it('disables cancel button when submitting', () => {
    render(
      <AnnouncementPreviewModal
        open={true}
        onOpenChange={mockOnOpenChange}
        data={defaultData}
        onConfirm={mockOnConfirm}
        isSubmitting={true}
      />
    );

    expect(screen.getByTestId('preview-cancel-button')).toBeDisabled();
  });

  it('returns null when data is null', () => {
    const { container } = render(
      <AnnouncementPreviewModal
        open={true}
        onOpenChange={mockOnOpenChange}
        data={null}
        onConfirm={mockOnConfirm}
        isSubmitting={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when open is false', () => {
    render(
      <AnnouncementPreviewModal
        open={false}
        onOpenChange={mockOnOpenChange}
        data={defaultData}
        onConfirm={mockOnConfirm}
        isSubmitting={false}
      />
    );

    expect(screen.queryByTestId('announcement-preview-modal')).not.toBeInTheDocument();
  });
});
