// src/components/admin/__tests__/AdminFeedbackDelete.test.tsx
//
// Tests for TASK-159 delete capability on feedback:
// - Trash icon rendered in AdminFeedbackCard
// - Clicking trash calls onDelete with the feedback item
// - AdminFeedbackSection shows ConfirmDialog when trash is clicked
// - Confirming calls deleteFeedback from the store
// - ConfirmDialog closes after cancel (no delete called)
//
// FBDR-09 update: AdminFeedbackSection now uses useSearchParams (needs
// MemoryRouter wrapper) and expanded store shape (drawer state fields).

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AdminFeedbackCard } from '../AdminFeedbackCard';
import { AdminFeedbackSection } from '../AdminFeedbackSection';

// ============================================================
// Shared i18n mock
// ============================================================
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, _opts?: unknown) => {
      const map: Record<string, string> = {
        // v2 page head
        'feedback.v2.pageHead.breadcrumb': 'Feedback',
        'feedback.v2.pageHead.kicker': 'Reviews · Feedback',
        'feedback.v2.pageHead.title': 'User feedback',
        'feedback.v2.pageHead.sub': 'Review, respond, and track community feedback',
        comingSoon: 'Coming soon',
        // v2 stat cards
        'feedback.v2.statCards.total.label': 'Total feedback',
        'feedback.v2.statCards.total.sub': '0 new · 0 responded',
        'feedback.v2.statCards.awaiting.label': 'Awaiting response',
        'feedback.v2.statCards.awaiting.sub': 'oldest {{distance}}',
        'feedback.v2.statCards.communityVotes.label': 'Community votes',
        'feedback.v2.statCards.communityVotes.sub': 'upvotes on this page',
        // v2 filters
        'feedback.v2.filters.status.all': 'All',
        'feedback.v2.filters.status.open': 'Open',
        'feedback.v2.filters.status.new': 'New',
        'feedback.v2.filters.status.investigating': 'Investigating',
        'feedback.v2.filters.status.planned': 'Planned',
        'feedback.v2.filters.status.responded': 'Responded',
        'feedback.v2.filters.status.wont_fix': "Won't fix",
        'feedback.v2.filters.type.all': 'All',
        'feedback.v2.filters.type.bug': 'Bug',
        'feedback.v2.filters.type.feature': 'Feature',
        'feedback.v2.filters.status.label': 'Status',
        'feedback.v2.filters.type.label': 'Type',
        'feedback.v2.filters.search.placeholder': 'Search feedback...',
        'feedback.v2.filters.clear': 'Clear filters',
        // v2 empty states
        'feedback.v2.emptyStates.noMatch': 'No feedback matches your filters',
        // v2 toasts
        'feedback.v2.toasts.deepLinkNotFound': 'Feedback item not found on this page',
        // v1 keys still referenced
        'feedback.stats.total': 'Total Feedback',
        'feedback.stats.new': 'New',
        'feedback.stats.responded': 'Responded',
        'feedback.sectionTitle': 'User Feedback',
        'feedback.sectionDescription': 'Review and respond to user feedback',
        'feedback.anonymousUser': 'Anonymous User',
        'feedback.respond': 'Respond',
        'feedback.editResponse': 'Edit Response',
        'feedback.adminResponseLabel': 'Admin Response',
        'feedback.filters.clear': 'Clear Filters',
        'feedback.errors.loadingTitle': 'Error Loading Feedback',
        'feedback.search.placeholder': 'Search feedback...',
        'feedback.states.noFeedback': 'No feedback submitted yet',
        'feedback.states.noFilteredResults': 'No feedback matches the selected filters',
        'feedback.deleteAction': 'Delete',
        'feedback.delete.button': 'Delete',
        'feedback.delete.title': 'Delete Feedback',
        'feedback.delete.warning': 'This will permanently delete this feedback item.',
        'feedback.delete.confirm': 'Delete',
        'feedback.delete.success': 'Feedback deleted',
        'page.title': 'Admin Dashboard',
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
  useToast: () => ({ toast: vi.fn() }),
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

  it('calls onDelete with the feedback id when trash button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(<AdminFeedbackCard feedback={sampleFeedback} onRespond={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByTestId(`delete-feedback-${FEEDBACK_ID}`));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith(FEEDBACK_ID);
  });

  it('does not render trash button when onDelete prop is not provided', () => {
    render(
      <AdminFeedbackCard
        feedback={sampleFeedback}
        onRespond={vi.fn()}
        // onDelete intentionally omitted (optional prop)
      />
    );

    expect(screen.queryByTestId(`delete-feedback-${FEEDBACK_ID}`)).not.toBeInTheDocument();
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
const mockOpenDrawer = vi.fn();
const mockCloseDrawer = vi.fn();
const mockSetInnerTab = vi.fn();

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
    openFeedbackId: null,
    openInnerTab: 'reply',
    fetchFeedbackList: mockFetchFeedbackList,
    updateFeedback: mockUpdateFeedback,
    deleteFeedback: mockDeleteFeedback,
    setFilters: mockSetFilters,
    clearFilters: mockClearFilters,
    setPage: mockSetPage,
    clearError: mockClearError,
    setSelectedFeedback: mockSetSelectedFeedback,
    openDrawer: mockOpenDrawer,
    closeDrawer: mockCloseDrawer,
    setInnerTab: mockSetInnerTab,
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

// Helper to render AdminFeedbackSection inside a MemoryRouter
// (required because the component now uses useSearchParams)
function renderSection() {
  return render(
    <MemoryRouter>
      <AdminFeedbackSection />
    </MemoryRouter>
  );
}

describe('AdminFeedbackSection — delete ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show delete ConfirmDialog on initial render', () => {
    renderSection();

    expect(screen.queryByText('Delete Feedback')).not.toBeInTheDocument();
  });

  it('shows delete ConfirmDialog when trash button is clicked on a feedback card', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByTestId(`delete-feedback-${FEEDBACK_ID}`));

    await waitFor(() => {
      expect(screen.getByText('Delete Feedback')).toBeInTheDocument();
    });
  });

  it('displays the permanent deletion warning in the dialog', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByTestId(`delete-feedback-${FEEDBACK_ID}`));

    await waitFor(() => {
      expect(
        screen.getByText(/This will permanently delete this feedback item/i)
      ).toBeInTheDocument();
    });
  });

  it('calls deleteFeedback with the correct id when Confirm is clicked', async () => {
    const user = userEvent.setup();
    renderSection();

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
    renderSection();

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
