// src/components/admin/announcements/__tests__/AnnouncementHistoryRows.test.tsx

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { AnnouncementItem } from '@/services/adminAPI';
import { AnnouncementHistoryRows, truncateMessage } from '../AnnouncementHistoryRows';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeAnnouncement(overrides: Partial<AnnouncementItem> = {}): AnnouncementItem {
  return {
    id: 'ann-001',
    title: 'Test Title',
    message: 'Test message body',
    link_url: null,
    total_recipients: 100,
    read_count: 20,
    created_at: '2026-01-15T10:00:00Z',
    creator: null,
    ...overrides,
  };
}

const defaultProps = {
  announcements: [makeAnnouncement()],
  isLoading: false,
  page: 1,
  totalPages: 1,
  onPageChange: vi.fn(),
  onOpenDetails: vi.fn(),
  onRequestDelete: vi.fn(),
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('truncateMessage helper', () => {
  it('returns message unchanged when ≤ 80 chars', () => {
    const msg = 'a'.repeat(80);
    expect(truncateMessage(msg)).toBe(msg);
  });

  it('appends ellipsis and is ≤ 81 chars when message > 80 chars', () => {
    const msg = 'word '.repeat(20); // 100 chars
    const result = truncateMessage(msg);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(81);
  });

  it('truncates at word boundary when possible', () => {
    const msg = 'hello world ' + 'a'.repeat(80);
    const result = truncateMessage(msg);
    // Should not cut mid-word
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('AnnouncementHistoryRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one .an-row per announcement item', () => {
    const items = [
      makeAnnouncement({ id: 'a1', title: 'First' }),
      makeAnnouncement({ id: 'a2', title: 'Second' }),
      makeAnnouncement({ id: 'a3', title: 'Third' }),
    ];
    render(<AnnouncementHistoryRows {...defaultProps} announcements={items} />);

    const rows = document.querySelectorAll('.an-row');
    // 3 data rows + 1 header row (an-row-head, not an-row)
    expect(rows).toHaveLength(3);
  });

  it('renders title text in each row', () => {
    const items = [
      makeAnnouncement({ id: 'a1', title: 'Alpha Announcement' }),
      makeAnnouncement({ id: 'a2', title: 'Beta Announcement' }),
    ];
    render(<AnnouncementHistoryRows {...defaultProps} announcements={items} />);

    expect(screen.getByText('Alpha Announcement')).toBeInTheDocument();
    expect(screen.getByText('Beta Announcement')).toBeInTheDocument();
  });

  // ── 80-char truncation ────────────────────────────────────────────────────

  it('truncates messages longer than 80 chars with ellipsis', () => {
    const longMsg = 'A'.repeat(40) + ' ' + 'B'.repeat(40) + ' extra words here';
    const item = makeAnnouncement({ id: 'a1', message: longMsg });
    render(<AnnouncementHistoryRows {...defaultProps} announcements={[item]} />);

    const truncated = screen.getByText(/…$/);
    expect(truncated.textContent!.length).toBeLessThanOrEqual(81);
  });

  it('does not truncate messages of exactly 80 chars', () => {
    const exactMsg = 'a'.repeat(80);
    const item = makeAnnouncement({ id: 'a1', message: exactMsg });
    render(<AnnouncementHistoryRows {...defaultProps} announcements={[item]} />);

    expect(screen.getByText(exactMsg)).toBeInTheDocument();
  });

  // ── Color thresholds (an-rate-pct class) ─────────────────────────────────

  it('applies is-zero class when read_percentage is 0%', () => {
    const item = makeAnnouncement({ id: 'a1', read_count: 0, total_recipients: 100 });
    render(<AnnouncementHistoryRows {...defaultProps} announcements={[item]} />);

    const pctEl = document.querySelector('.an-rate-pct');
    expect(pctEl).toHaveClass('is-zero');
  });

  it('applies is-ok class when read_percentage is ~5%', () => {
    const item = makeAnnouncement({ id: 'a1', read_count: 5, total_recipients: 100 });
    render(<AnnouncementHistoryRows {...defaultProps} announcements={[item]} />);

    const pctEl = document.querySelector('.an-rate-pct');
    expect(pctEl).toHaveClass('is-ok');
  });

  it('applies is-good class when read_percentage is ≥ 20% (25 used)', () => {
    const item = makeAnnouncement({ id: 'a1', read_count: 25, total_recipients: 100 });
    render(<AnnouncementHistoryRows {...defaultProps} announcements={[item]} />);

    const pctEl = document.querySelector('.an-rate-pct');
    expect(pctEl).toHaveClass('is-good');
  });

  it('renders correct rate classes across multiple rows', () => {
    const items = [
      makeAnnouncement({ id: 'a1', read_count: 0, total_recipients: 100 }), // 0% → is-zero
      makeAnnouncement({ id: 'a2', read_count: 5, total_recipients: 100 }), // 5% → is-ok
      makeAnnouncement({ id: 'a3', read_count: 25, total_recipients: 100 }), // 25% → is-good
    ];
    render(<AnnouncementHistoryRows {...defaultProps} announcements={items} />);

    const pctEls = document.querySelectorAll('.an-rate-pct');
    expect(pctEls[0]).toHaveClass('is-zero');
    expect(pctEls[1]).toHaveClass('is-ok');
    expect(pctEls[2]).toHaveClass('is-good');
  });

  // ── Row click → onOpenDetails ─────────────────────────────────────────────

  it('calls onOpenDetails with announcement id on row click', async () => {
    const user = userEvent.setup();
    const onOpenDetails = vi.fn();
    const item = makeAnnouncement({ id: 'row-id-42' });
    render(
      <AnnouncementHistoryRows
        {...defaultProps}
        announcements={[item]}
        onOpenDetails={onOpenDetails}
      />
    );

    const row = screen.getByTestId('announcement-row-row-id-42');
    await user.click(row);

    expect(onOpenDetails).toHaveBeenCalledWith('row-id-42');
  });

  // ── Trash icon stops propagation ──────────────────────────────────────────

  it('calls onRequestDelete and NOT onOpenDetails when trash icon is clicked', async () => {
    const user = userEvent.setup();
    const onOpenDetails = vi.fn();
    const onRequestDelete = vi.fn();
    const item = makeAnnouncement({ id: 'trash-id-7' });
    render(
      <AnnouncementHistoryRows
        {...defaultProps}
        announcements={[item]}
        onOpenDetails={onOpenDetails}
        onRequestDelete={onRequestDelete}
      />
    );

    const trashBtn = screen.getByTestId('announcement-row-trash-trash-id-7');
    await user.click(trashBtn);

    expect(onRequestDelete).toHaveBeenCalledWith('trash-id-7');
    expect(onOpenDetails).not.toHaveBeenCalled();
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  it('renders 5 skeleton rows when isLoading is true', () => {
    render(<AnnouncementHistoryRows {...defaultProps} isLoading={true} announcements={[]} />);

    // Skeleton rows have aria-hidden="true" on each .an-row during loading
    const rows = document.querySelectorAll('.an-row[aria-hidden="true"]');
    expect(rows).toHaveLength(5);
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  it('renders Megaphone icon and helper text when list is empty', () => {
    render(<AnnouncementHistoryRows {...defaultProps} announcements={[]} isLoading={false} />);

    expect(screen.getByText('No announcements yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first announcement above')).toBeInTheDocument();
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  it('does not render pagination when totalPages is 1', () => {
    render(<AnnouncementHistoryRows {...defaultProps} totalPages={1} page={1} />);

    expect(screen.queryByTestId('pagination-previous')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pagination-next')).not.toBeInTheDocument();
  });

  it('calls onPageChange(page-1) when Previous is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <AnnouncementHistoryRows
        {...defaultProps}
        page={2}
        totalPages={3}
        onPageChange={onPageChange}
      />
    );

    await user.click(screen.getByTestId('pagination-previous'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange(page+1) when Next is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <AnnouncementHistoryRows
        {...defaultProps}
        page={1}
        totalPages={3}
        onPageChange={onPageChange}
      />
    );

    await user.click(screen.getByTestId('pagination-next'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables Previous button on first page', () => {
    render(<AnnouncementHistoryRows {...defaultProps} page={1} totalPages={3} />);
    expect(screen.getByTestId('pagination-previous')).toBeDisabled();
  });

  it('disables Next button on last page', () => {
    render(<AnnouncementHistoryRows {...defaultProps} page={3} totalPages={3} />);
    expect(screen.getByTestId('pagination-next')).toBeDisabled();
  });
});
