/**
 * FeedbackCard Component Tests
 *
 * Tests for the FeedbackCard component verifying:
 * - Display of DeveloperResponseSection when admin_response exists
 * - Hiding of DeveloperResponseSection when admin_response is null
 * - Basic feedback card rendering
 * - Owner edit/delete buttons visibility
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { FeedbackItem, FeedbackCategory, FeedbackStatus, VoteType } from '@/types/feedback';

import { FeedbackCard } from '../FeedbackCard';

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-123', role: 'free' },
    isAuthenticated: true,
    isLoading: false,
  })),
}));

// Mock useFeedbackStore for vote button
vi.mock('@/stores/feedbackStore', () => ({
  useFeedbackStore: vi.fn(() => ({
    vote: vi.fn(),
    removeVote: vi.fn(),
    isVoting: false,
  })),
}));

// Mock English translations
const enFeedback = {
  list: {
    by: 'by',
  },
  categories: {
    feature_request: 'Feature Request',
    bug_incorrect_data: 'Bug / Incorrect Data',
  },
  status: {
    new: 'New',
    under_review: 'Under Review',
    planned: 'Planned',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },
  voting: {
    upvote: 'Upvote',
    downvote: 'Downvote',
  },
  edit: {
    button: 'Edit',
  },
  delete: {
    button: 'Delete',
    title: 'Delete Feedback',
    description: 'Are you sure you want to delete "{{title}}"? This action cannot be undone.',
    confirm: 'Delete',
    cancel: 'Cancel',
  },
  developerResponse: {
    title: 'Developer Response',
  },
};

// Setup i18n for tests
const setupI18n = (language: string = 'en') => {
  const testI18n = i18n.createInstance();
  testI18n.use(initReactI18next).init({
    resources: {
      en: { feedback: enFeedback },
    },
    lng: language,
    fallbackLng: 'en',
    ns: ['feedback'],
    defaultNS: 'feedback',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return testI18n;
};

const renderWithI18n = (ui: React.ReactElement, language: string = 'en') => {
  const testI18n = setupI18n(language);
  return render(<I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>);
};

/**
 * Factory function to create mock feedback items
 */
const createMockFeedback = (overrides?: Partial<FeedbackItem>): FeedbackItem => ({
  id: 'feedback-123',
  title: 'Test Feedback Title',
  description: 'This is a test feedback description.',
  category: 'feature_request' as FeedbackCategory,
  status: 'new' as FeedbackStatus,
  vote_count: 5,
  user_vote: null as VoteType | null,
  author: {
    id: 'author-456',
    full_name: 'Test Author',
  },
  created_at: '2026-01-10T10:00:00Z',
  updated_at: '2026-01-10T10:00:00Z',
  admin_response: null,
  admin_response_at: null,
  ...overrides,
});

describe('FeedbackCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render feedback card with title', () => {
      const feedback = createMockFeedback();
      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.getByTestId('feedback-card')).toBeInTheDocument();
      expect(screen.getByTestId('feedback-title')).toHaveTextContent('Test Feedback Title');
    });

    it('should render feedback description', () => {
      const feedback = createMockFeedback();
      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.getByTestId('feedback-description')).toHaveTextContent(
        'This is a test feedback description.'
      );
    });

    it('should render vote buttons', () => {
      const feedback = createMockFeedback();
      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.getByTestId('vote-buttons')).toBeInTheDocument();
      expect(screen.getByTestId('vote-count')).toHaveTextContent('5');
    });

    it('should render author name in meta', () => {
      const feedback = createMockFeedback();
      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.getByTestId('feedback-meta')).toHaveTextContent('Test Author');
    });
  });

  describe('DeveloperResponseSection Display', () => {
    it('should show DeveloperResponseSection when admin_response exists', () => {
      const feedback = createMockFeedback({
        admin_response: 'Thank you for your feedback!',
        admin_response_at: '2026-01-10T12:00:00Z',
      });

      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.getByTestId('developer-response-section')).toBeInTheDocument();
      expect(screen.getByText('Thank you for your feedback!')).toBeInTheDocument();
      expect(screen.getByText('Developer Response')).toBeInTheDocument();
    });

    it('should hide DeveloperResponseSection when admin_response is null', () => {
      const feedback = createMockFeedback({
        admin_response: null,
        admin_response_at: null,
      });

      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.queryByTestId('developer-response-section')).not.toBeInTheDocument();
    });

    it('should hide DeveloperResponseSection when admin_response is not present', () => {
      const feedback = createMockFeedback();
      // Ensure no admin_response
      delete (feedback as any).admin_response;

      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.queryByTestId('developer-response-section')).not.toBeInTheDocument();
    });

    it('should display the correct admin response text', () => {
      const responseText = 'We have fixed this issue in the latest release.';
      const feedback = createMockFeedback({
        admin_response: responseText,
        admin_response_at: '2026-01-10T15:30:00Z',
      });

      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.getByTestId('developer-response-text')).toHaveTextContent(responseText);
    });
  });

  describe('Owner Actions', () => {
    it('should not show edit/delete buttons when user is not the owner', () => {
      const feedback = createMockFeedback({
        author: { id: 'different-user', full_name: 'Other User' },
      });

      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.queryByTestId('feedback-edit-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('feedback-delete-button')).not.toBeInTheDocument();
    });

    it('should show edit/delete buttons when user is the owner', async () => {
      // Import and mock useAuth for this specific test
      const { useAuth } = await import('@/hooks/useAuth');
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'author-456', role: 'free', email: 'test@test.com', name: 'Test' },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        updateProfile: vi.fn(),
        clearError: vi.fn(),
        isAdmin: false,
        isPremium: false,
        isFree: true,
      });

      const feedback = createMockFeedback({
        author: { id: 'author-456', full_name: 'Test Author' },
      });

      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.getByTestId('feedback-edit-button')).toBeInTheDocument();
      expect(screen.getByTestId('feedback-delete-button')).toBeInTheDocument();
    });
  });

  describe('Different Feedback States', () => {
    it('should render bug category correctly', () => {
      const feedback = createMockFeedback({ category: 'bug_incorrect_data' });
      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.getByText('Bug / Incorrect Data')).toBeInTheDocument();
    });

    it('should render feature request category correctly', () => {
      const feedback = createMockFeedback({ category: 'feature_request' });
      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.getByText('Feature Request')).toBeInTheDocument();
    });

    it('should render different statuses correctly', () => {
      const statuses: FeedbackStatus[] = [
        'new',
        'under_review',
        'planned',
        'in_progress',
        'completed',
        'cancelled',
      ];

      for (const status of statuses) {
        const feedback = createMockFeedback({ status });
        const { unmount } = renderWithI18n(<FeedbackCard feedback={feedback} />);

        const expectedText = enFeedback.status[status];
        expect(screen.getByText(expectedText)).toBeInTheDocument();

        unmount();
      }
    });
  });

  describe('Admin Response with Various Content', () => {
    it('should handle long admin response', () => {
      const longResponse = 'A'.repeat(500);
      const feedback = createMockFeedback({
        admin_response: longResponse,
        admin_response_at: '2026-01-10T12:00:00Z',
      });

      renderWithI18n(<FeedbackCard feedback={feedback} />);

      expect(screen.getByTestId('developer-response-text')).toHaveTextContent(longResponse);
    });

    it('should handle multiline admin response', () => {
      const multilineResponse = 'Line 1\nLine 2\nLine 3';
      const feedback = createMockFeedback({
        admin_response: multilineResponse,
        admin_response_at: '2026-01-10T12:00:00Z',
      });

      renderWithI18n(<FeedbackCard feedback={feedback} />);

      const responseText = screen.getByTestId('developer-response-text');
      // The whitespace-pre-wrap CSS class ensures multiline text displays correctly
      expect(responseText).toHaveClass('whitespace-pre-wrap');
      // Verify each line is present (toHaveTextContent normalizes whitespace)
      expect(responseText.textContent).toContain('Line 1');
      expect(responseText.textContent).toContain('Line 2');
      expect(responseText.textContent).toContain('Line 3');
    });
  });

  describe('Feedback ID for Anchoring', () => {
    it('should have correct id attribute for URL anchoring', () => {
      const feedback = createMockFeedback({ id: 'feedback-abc-123' });
      renderWithI18n(<FeedbackCard feedback={feedback} />);

      const card = screen.getByTestId('feedback-card');
      expect(card).toHaveAttribute('id', 'feedback-feedback-abc-123');
    });
  });
});
