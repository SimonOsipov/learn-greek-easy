// src/components/admin/announcements/__tests__/AnnouncementHistoryTable.test.tsx

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AnnouncementItem } from '@/services/adminAPI';

import { AnnouncementHistoryTable } from '../AnnouncementHistoryTable';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'announcements.history.title': 'Announcement History',
        'announcements.history.description': 'View all past announcements',
        'announcements.history.empty': 'No announcements yet',
        'announcements.history.emptyHint': 'Create your first announcement above',
        'announcements.history.viewDetail': 'View Details',
        'announcements.create.titleLabel': 'Title',
        'announcements.detail.sent': 'Sent to',
        'announcements.detail.read': 'Read by',
        'news.table.created': 'Created',
        'pagination.pageOf': `Page ${options?.page} of ${options?.totalPages}`,
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
      };
      return translations[key] || key;
    },
    i18n: {
      language: 'en',
    },
  }),
}));

describe('AnnouncementHistoryTable', () => {
  const mockAnnouncements: AnnouncementItem[] = [
    {
      id: '1',
      title: 'First Announcement',
      message: 'First message content',
      link_url: null,
      total_recipients: 100,
      read_count: 75,
      created_at: '2026-01-20T10:00:00Z',
      creator: { id: 'admin-1', display_name: 'Admin User' },
    },
    {
      id: '2',
      title: 'Second Announcement with a very long title that should be truncated',
      message: 'Second message',
      link_url: 'https://example.com',
      total_recipients: 50,
      read_count: 25,
      created_at: '2026-01-15T14:30:00Z',
      creator: null,
    },
  ];

  const defaultProps = {
    announcements: mockAnnouncements,
    isLoading: false,
    page: 1,
    totalPages: 1,
    onPageChange: vi.fn(),
    onViewDetail: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the table with header', () => {
    render(<AnnouncementHistoryTable {...defaultProps} />);

    expect(screen.getByText('Announcement History')).toBeInTheDocument();
    expect(screen.getByText('View all past announcements')).toBeInTheDocument();
  });

  it('renders announcement rows', () => {
    render(<AnnouncementHistoryTable {...defaultProps} />);

    expect(screen.getByText('First Announcement')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('75 (75%)')).toBeInTheDocument();
  });

  it('truncates long titles', () => {
    render(<AnnouncementHistoryTable {...defaultProps} />);

    // Should truncate title longer than 50 chars (47 chars + "...")
    // Original: "Second Announcement with a very long title that should be truncated"
    // Truncated: first 47 chars + "..."
    expect(
      screen.getByText('Second Announcement with a very long title that...')
    ).toBeInTheDocument();
  });

  it('calculates read percentage correctly', () => {
    render(<AnnouncementHistoryTable {...defaultProps} />);

    // First announcement: 75/100 = 75%
    expect(screen.getByText('75 (75%)')).toBeInTheDocument();
    // Second announcement: 25/50 = 50%
    expect(screen.getByText('25 (50%)')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(<AnnouncementHistoryTable {...defaultProps} isLoading={true} />);

    // Table should still show header
    expect(screen.getByText('Announcement History')).toBeInTheDocument();

    // But content should be skeletons (no actual data visible)
    expect(screen.queryByText('First Announcement')).not.toBeInTheDocument();
  });

  it('shows empty state when no announcements', () => {
    render(<AnnouncementHistoryTable {...defaultProps} announcements={[]} />);

    expect(screen.getByText('No announcements yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first announcement above')).toBeInTheDocument();
  });

  it('calls onViewDetail when view button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnViewDetail = vi.fn();

    render(<AnnouncementHistoryTable {...defaultProps} onViewDetail={mockOnViewDetail} />);

    const viewButton = screen.getByTestId('view-detail-1');
    await user.click(viewButton);

    expect(mockOnViewDetail).toHaveBeenCalledWith('1');
  });

  it('shows pagination when totalPages > 1', () => {
    render(<AnnouncementHistoryTable {...defaultProps} page={1} totalPages={3} />);

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-previous')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-next')).toBeInTheDocument();
  });

  it('hides pagination when totalPages <= 1', () => {
    render(<AnnouncementHistoryTable {...defaultProps} page={1} totalPages={1} />);

    expect(screen.queryByTestId('pagination-previous')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pagination-next')).not.toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(<AnnouncementHistoryTable {...defaultProps} page={1} totalPages={3} />);

    expect(screen.getByTestId('pagination-previous')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<AnnouncementHistoryTable {...defaultProps} page={3} totalPages={3} />);

    expect(screen.getByTestId('pagination-next')).toBeDisabled();
  });

  it('calls onPageChange when previous is clicked', async () => {
    const user = userEvent.setup();
    const mockOnPageChange = vi.fn();

    render(
      <AnnouncementHistoryTable
        {...defaultProps}
        page={2}
        totalPages={3}
        onPageChange={mockOnPageChange}
      />
    );

    await user.click(screen.getByTestId('pagination-previous'));
    expect(mockOnPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange when next is clicked', async () => {
    const user = userEvent.setup();
    const mockOnPageChange = vi.fn();

    render(
      <AnnouncementHistoryTable
        {...defaultProps}
        page={1}
        totalPages={3}
        onPageChange={mockOnPageChange}
      />
    );

    await user.click(screen.getByTestId('pagination-next'));
    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });

  it('handles zero recipients without division by zero', () => {
    const announcementsWithZero: AnnouncementItem[] = [
      {
        id: '1',
        title: 'Empty Announcement',
        message: 'Message',
        link_url: null,
        total_recipients: 0,
        read_count: 0,
        created_at: '2026-01-20T10:00:00Z',
        creator: null,
      },
    ];

    render(<AnnouncementHistoryTable {...defaultProps} announcements={announcementsWithZero} />);

    // Should show 0 (0%) without crashing
    expect(screen.getByText('0 (0%)')).toBeInTheDocument();
  });
});
