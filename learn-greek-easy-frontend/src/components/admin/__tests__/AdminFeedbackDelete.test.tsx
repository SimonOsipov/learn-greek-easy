// src/components/admin/__tests__/AdminFeedbackDelete.test.tsx
//
// Tests for TASK-159 delete capability on feedback:
// - Trash icon rendered in AdminFeedbackCard
// - Clicking trash calls onDelete with the feedback item
// - AdminFeedbackSection shows ConfirmDialog when trash is clicked
// - Confirming calls deleteFeedback from the store
// - ConfirmDialog closes after cancel (no delete called)

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AdminFeedbackCard } from '../AdminFeedbackCard';
import { AdminFeedbackSection } from '../AdminFeedbackSection';

// ============================================================
// Shared i18n mock
// ============================================================
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'feedback.stats.total': 'Total Feedback',
        'feedback.stats.new': 'New',
        'feedback.stats.responded': 'Responded',
        'feedback.sectionTitle': 'User Feedback',
        'feedback.sectionDescription': 'Review and respond to user feedback',
        'feedback.anonymousUser': 'Anonymous User',
        'feedback.respond': 'Respond',
        'feedback.editResponse': 'Edit Response',
        'feedback.adminResponseLabel': 'Admin Response',
        'feedback.filters.statusPlaceholder': 'Filter by status',
        'feedback.filters.categoryPlaceholder': 'Filter by category',
        'feedback.filters.allStatuses': 'All Statuses',
        'feedback.filters.allCategories': 'All Categories',
        'feedback.filters.clear': 'Clear Filters',
        'feedback.statuses.new': 'New',
        'feedback.statuses.under_review': 'Under Review',
        'feedback.statuses.planned': 'Planned',
        'feedback.statuses.in_progress': 'In Progress',
        'feedback.statuses.completed': 'Completed',
        'feedback.statuses.cancelled': 'Cancelled',
        'feedback.categories.feature_request': 'Feature Request',
        'feedback.categories.bug_incorrect_data': 'Bug / Incorrect Data',
        'feedback.errors.loadingTitle': 'Error Loading Feedback',
        'feedback.search.placeholder': 'Search feedback...',
        'feedback.search.filteredCount': '{{filtered}} of {{total}} items',
        'feedback.search.noResults': 'No feedback matches your search',
        'feedback.states.noFeedback': 'No feedback submitted yet',
        'feedback.states.noFilteredResults': 'No feedback matches the selected filters',
        'feedback.delete.button': 'Delete',
        'feedback.delete.title': 'Delete Feedback',
        'feedback.delete.warning': 'This will permanently delete this feedback item.',
        'feedback.delete.confirm': 'Delete',
        'feedback.delete.success': 'Feedback deleted',
        'pagination.showing': 'Showing {{from}}-{{to}} of {{total}}',
        'pagination.pageOf': 'Page {{page}} of {{totalPages}}',
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
        'actions.retry': 'Retry',
      };
      return map[key] || key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

// ============================================================
// Helpers
// ============================================================

const FEEDBACK_ID = 'feedback-uuid-001';

const sampleFeedback = {
  id: FEEDBACK_ID,
  title: 'Dark mode please',
  description: 'It would be great to have a dark mode.',
  category: 'feature_request' as const,
  status: 'new' as const,
  vote_count: 3,
  admin_response: null,
  admin_response_at: null,
  author: { id: 'user-1', full_name: 'Jane Doe' },
  created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z',
};

// ============================================================
// AdminFeedbackCard — delete button rendering
// ============================================================

describe('AdminFeedbackCard — delete button', () => {
  it('renders a trash icon button', () => {
    const onDelete = vi.fn();

    render(<AdminFeedbackCard feedback={sampleFeedback} onRespond={vi.fn()} onDelete={onDelete} />);

    expect(screen.getByTestId(`delete-feedback-${FEEDBACK_ID}`)).toBeInTheDocument();
  });

  it('calls onDelete with the feedback item when trash button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(<AdminFeedbackCard feedback={sampleFeedback} onRespond={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByTestId(`delete-feedback-${FEEDBACK_ID}`));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith(sampleFeedback);
  });

  it('renders trash button even when onDelete prop is not provided (no crash)', () => {
    render(
      <AdminFeedbackCard
        feedback={sampleFeedback}
        onRespond={vi.fn()}
        // onDelete intentionally omitted (optional prop)
      />
    );

    expect(screen.getByTestId(`delete-feedback-${FEEDBACK_ID}`)).toBeInTheDocument();
  });
});

// ============================================================
// AdminFeedbackSection — ConfirmDialog for delete
// ============================================================

const mockDeleteFeedback = vi.fn().mockResolvedValue(undefined);
const mockFetchFeedbackList = vi.fn().mockResolvedValue(undefined);
const mockSetFilters = vi.fn();
const mockClearFilters = vi.fn();
const mockSetPage = vi.fn();
const mockClearError = vi.fn();
const mockSetSelectedFeedback = vi.fn();
const mockUpdateFeedback = vi.fn().mockResolvedValue(sampleFeedback);

vi.mock('@/stores/adminFeedbackStore', () => ({
  useAdminFeedbackStore: () => ({
    feedbackList: [sampleFeedback],
    selectedFeedback: null,
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
    filters: { status: null, category: null },
    isLoading: false,
    isUpdating: false,
    isDeleting: false,
    error: null,
    fetchFeedbackList: mockFetchFeedbackList,
    updateFeedback: mockUpdateFeedback,
    deleteFeedback: mockDeleteFeedback,
    setFilters: mockSetFilters,
    clearFilters: mockClearFilters,
    setPage: mockSetPage,
    clearError: mockClearError,
    setSelectedFeedback: mockSetSelectedFeedback,
  }),
}));

// FEEDBACK_STATUSES and FEEDBACK_CATEGORIES come from @/types/feedback
vi.mock('@/types/feedback', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/types/feedback')>();
  return {
    ...actual,
    FEEDBACK_STATUSES: [],
    FEEDBACK_CATEGORIES: [],
  };
});

// Mock AdminFeedbackResponseDialog to keep tests focused
vi.mock('../AdminFeedbackResponseDialog', () => ({
  AdminFeedbackResponseDialog: () => null,
}));

describe('AdminFeedbackSection — delete ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show delete ConfirmDialog on initial render', () => {
    render(<AdminFeedbackSection />);

    expect(screen.queryByText('Delete Feedback')).not.toBeInTheDocument();
  });

  it('shows delete ConfirmDialog when trash button is clicked on a feedback card', async () => {
    const user = userEvent.setup();
    render(<AdminFeedbackSection />);

    await user.click(screen.getByTestId(`delete-feedback-${FEEDBACK_ID}`));

    await waitFor(() => {
      expect(screen.getByText('Delete Feedback')).toBeInTheDocument();
    });
  });

  it('displays the permanent deletion warning in the dialog', async () => {
    const user = userEvent.setup();
    render(<AdminFeedbackSection />);

    await user.click(screen.getByTestId(`delete-feedback-${FEEDBACK_ID}`));

    await waitFor(() => {
      expect(
        screen.getByText(/This will permanently delete this feedback item/i)
      ).toBeInTheDocument();
    });
  });

  it('calls deleteFeedback with the correct id when Confirm is clicked', async () => {
    const user = userEvent.setup();
    render(<AdminFeedbackSection />);

    // Open dialog
    await user.click(screen.getByTestId(`delete-feedback-${FEEDBACK_ID}`));
    await waitFor(() => {
      expect(screen.getByText('Delete Feedback')).toBeInTheDocument();
    });

    // Confirm
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mockDeleteFeedback).toHaveBeenCalledWith(FEEDBACK_ID);
    });
  });

  it('closes the ConfirmDialog and does NOT call deleteFeedback when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<AdminFeedbackSection />);

    // Open dialog
    await user.click(screen.getByTestId(`delete-feedback-${FEEDBACK_ID}`));
    await waitFor(() => {
      expect(screen.getByText('Delete Feedback')).toBeInTheDocument();
    });

    // Cancel
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Delete Feedback')).not.toBeInTheDocument();
    });
    expect(mockDeleteFeedback).not.toHaveBeenCalled();
  });
});
