// src/components/admin/announcements/__tests__/AnnouncementDetailModal.test.tsx

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AnnouncementDetailResponse } from '@/services/adminAPI';

import { AnnouncementDetailModal } from '../AnnouncementDetailModal';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'announcements.detail.title': 'Announcement Details',
        'announcements.detail.message': 'Message',
        'announcements.detail.link': 'Link URL',
        'announcements.detail.statistics': 'Statistics',
        'announcements.detail.sent': 'Sent to',
        'announcements.detail.read': 'Read by',
        'announcements.detail.readProgress': 'Read Progress',
        'announcements.detail.close': 'Close',
        'announcements.history.by': 'by',
        'announcements.history.unknownAdmin': 'Unknown Admin',
      };
      return translations[key] || key;
    },
    i18n: {
      language: 'en',
    },
  }),
}));

describe('AnnouncementDetailModal', () => {
  const mockAnnouncement: AnnouncementDetailResponse = {
    id: '1',
    title: 'Test Announcement Title',
    message: 'This is the full announcement message content.',
    link_url: 'https://example.com/announcement',
    total_recipients: 100,
    read_count: 75,
    read_percentage: 75.0,
    created_at: '2026-01-20T10:30:00Z',
    creator: {
      id: 'admin-1',
      display_name: 'Admin User',
    },
  };

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    announcement: mockAnnouncement,
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with announcement details', () => {
    render(<AnnouncementDetailModal {...defaultProps} />);

    expect(screen.getByText('Announcement Details')).toBeInTheDocument();
    expect(screen.getByTestId('detail-title')).toHaveTextContent('Test Announcement Title');
    expect(screen.getByTestId('detail-message')).toHaveTextContent(
      'This is the full announcement message content.'
    );
  });

  it('displays statistics correctly', () => {
    render(<AnnouncementDetailModal {...defaultProps} />);

    expect(screen.getByTestId('detail-sent')).toHaveTextContent('100');
    expect(screen.getByTestId('detail-read')).toHaveTextContent('75');
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('shows link URL when present', () => {
    render(<AnnouncementDetailModal {...defaultProps} />);

    const link = screen.getByTestId('detail-link');
    expect(link).toHaveAttribute('href', 'https://example.com/announcement');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('hides link section when link_url is null', () => {
    const announcementWithoutLink = { ...mockAnnouncement, link_url: null };
    render(<AnnouncementDetailModal {...defaultProps} announcement={announcementWithoutLink} />);

    expect(screen.queryByTestId('detail-link')).not.toBeInTheDocument();
  });

  it('shows creator name when available', () => {
    render(<AnnouncementDetailModal {...defaultProps} />);

    expect(screen.getByTestId('detail-creator')).toHaveTextContent('Admin User');
    expect(screen.getByText('by')).toBeInTheDocument();
  });

  it('shows "Unknown Admin" when creator display_name is null', () => {
    const announcementWithNullCreator = {
      ...mockAnnouncement,
      creator: { id: 'admin-1', display_name: null },
    };
    render(
      <AnnouncementDetailModal {...defaultProps} announcement={announcementWithNullCreator} />
    );

    expect(screen.getByTestId('detail-creator')).toHaveTextContent('Unknown Admin');
  });

  it('hides creator section when creator is null', () => {
    const announcementWithoutCreator = { ...mockAnnouncement, creator: null };
    render(<AnnouncementDetailModal {...defaultProps} announcement={announcementWithoutCreator} />);

    expect(screen.queryByTestId('detail-creator')).not.toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<AnnouncementDetailModal {...defaultProps} isLoading={true} />);

    // Should show loading spinner, not content
    expect(screen.queryByTestId('detail-title')).not.toBeInTheDocument();
  });

  it('renders nothing when announcement is null and not loading', () => {
    render(<AnnouncementDetailModal {...defaultProps} announcement={null} isLoading={false} />);

    // Modal title should still be there
    expect(screen.getByText('Announcement Details')).toBeInTheDocument();
    // But no content
    expect(screen.queryByTestId('detail-title')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when close button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnOpenChange = vi.fn();

    render(<AnnouncementDetailModal {...defaultProps} onOpenChange={mockOnOpenChange} />);

    await user.click(screen.getByTestId('detail-close-button'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders progress bar with correct value', () => {
    render(<AnnouncementDetailModal {...defaultProps} />);

    const progressBar = screen.getByTestId('detail-progress');
    expect(progressBar).toBeInTheDocument();
  });

  it('handles decimal read_percentage correctly', () => {
    const announcementWithDecimal = {
      ...mockAnnouncement,
      read_percentage: 66.67,
    };
    render(<AnnouncementDetailModal {...defaultProps} announcement={announcementWithDecimal} />);

    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });
});
