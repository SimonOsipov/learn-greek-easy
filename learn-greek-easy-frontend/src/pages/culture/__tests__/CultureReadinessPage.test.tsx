/**
 * CultureReadinessPage tests
 *
 * Covers:
 * - Loading skeleton while both APIs are pending
 * - Rendered donut percentage after both resolve
 * - Category rows rendered per categories[] payload
 * - Attempt rows rendered per recent_exams[]
 * - Empty attempts state when recent_exams is []
 * - Error state when readiness API rejects
 * - Nudge banner shown/hidden based on motivation
 * - Take mock exam CTA link present
 */

import React, { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import i18n from '@/i18n';

import { CultureReadinessPage } from '../CultureReadinessPage';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetReadiness = vi.fn();

vi.mock('@/services/cultureDeckAPI', () => ({
  cultureDeckAPI: {
    getReadiness: (...args: unknown[]) => mockGetReadiness(...args),
    getList: vi.fn(),
  },
}));

const mockGetStatistics = vi.fn();

vi.mock('@/services/mockExamAPI', () => ({
  mockExamAPI: {
    getStatistics: (...args: unknown[]) => mockGetStatistics(...args),
  },
}));

// ── Test wrapper ──────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
    },
  });
}

function renderPage() {
  const queryClient = makeQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/culture/readiness']}>{children}</MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>
    );
  }

  return rtlRender(<CultureReadinessPage />, { wrapper: Wrapper });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const readinessFixture = {
  readiness_percentage: 45,
  verdict: 'getting_there' as const,
  questions_learned: 220,
  questions_total: 490,
  accuracy_percentage: 72,
  total_answers: 650,
  categories: [
    {
      category: 'history',
      readiness_percentage: 22,
      questions_mastered: 25,
      questions_total: 110,
      deck_ids: ['deck-history-1'],
      accuracy_percentage: 65,
      needs_reinforcement: true,
    },
    {
      category: 'politics',
      readiness_percentage: 38,
      questions_mastered: 42,
      questions_total: 110,
      deck_ids: ['deck-politics-1'],
      accuracy_percentage: 70,
      needs_reinforcement: false,
    },
    {
      category: 'geography',
      readiness_percentage: 60,
      questions_mastered: 66,
      questions_total: 110,
      deck_ids: ['deck-geo-1'],
      accuracy_percentage: null,
      needs_reinforcement: false,
    },
  ],
  motivation: null,
};

const examStatsFixture = {
  stats: {
    total_exams: 7,
    passed_exams: 3,
    pass_rate: 42.9,
    average_score: 14.2,
    best_score: 18,
    total_questions_answered: 175,
    average_time_seconds: 1800,
  },
  recent_exams: [
    {
      id: 'exam-1',
      started_at: '2026-05-20T10:00:00Z',
      completed_at: '2026-05-20T10:30:00Z',
      score: 15,
      total_questions: 25,
      passed: false,
      time_taken_seconds: 1800,
    },
    {
      id: 'exam-2',
      started_at: '2026-05-22T14:00:00Z',
      completed_at: '2026-05-22T14:28:00Z',
      score: 18,
      total_questions: 25,
      passed: true,
      time_taken_seconds: 1680,
    },
  ],
};

const emptyExamStats = {
  stats: {
    total_exams: 0,
    passed_exams: 0,
    pass_rate: 0,
    average_score: 0,
    best_score: 0,
    total_questions_answered: 0,
    average_time_seconds: 0,
  },
  recent_exams: [],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CultureReadinessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton while both APIs are pending', () => {
    mockGetReadiness.mockReturnValue(new Promise(() => {}));
    mockGetStatistics.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    // Skeleton elements rendered by ReadinessPageSkeleton have animate-pulse class
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders donut percentage after both APIs resolve', async () => {
    mockGetReadiness.mockResolvedValue(readinessFixture);
    mockGetStatistics.mockResolvedValue(examStatsFixture);

    renderPage();

    await waitFor(() => {
      // The donut center shows the rounded readiness percentage
      expect(screen.getByText('45%')).toBeInTheDocument();
    });
  });

  it('renders all category rows', async () => {
    mockGetReadiness.mockResolvedValue(readinessFixture);
    mockGetStatistics.mockResolvedValue(examStatsFixture);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Politics')).toBeInTheDocument();
      expect(screen.getByText('Geography')).toBeInTheDocument();
    });
  });

  it('renders attempt rows for each recent exam', async () => {
    mockGetReadiness.mockResolvedValue(readinessFixture);
    mockGetStatistics.mockResolvedValue(examStatsFixture);

    renderPage();

    await waitFor(() => {
      // exam-1: 15/25, exam-2: 18/25
      expect(screen.getByText('15/25')).toBeInTheDocument();
      expect(screen.getByText('18/25')).toBeInTheDocument();
    });
  });

  it('shows empty attempts state when recent_exams is empty', async () => {
    mockGetReadiness.mockResolvedValue(readinessFixture);
    mockGetStatistics.mockResolvedValue(emptyExamStats);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No mock exams yet')).toBeInTheDocument();
    });
  });

  it('renders error state when readiness API rejects', async () => {
    mockGetReadiness.mockRejectedValue(new Error('API down'));
    mockGetStatistics.mockResolvedValue(examStatsFixture);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('API down')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders nudge banner when motivation is provided', async () => {
    const withMotivation = {
      ...readinessFixture,
      motivation: {
        message_key: 'You are making great progress!',
        params: {},
        delta_direction: 'improving' as const,
        delta_percentage: 5,
      },
    };
    mockGetReadiness.mockResolvedValue(withMotivation);
    mockGetStatistics.mockResolvedValue(examStatsFixture);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('You are making great progress!')).toBeInTheDocument();
    });
  });

  it('hides nudge banner when motivation is null', async () => {
    mockGetReadiness.mockResolvedValue(readinessFixture); // motivation: null
    mockGetStatistics.mockResolvedValue(examStatsFixture);

    renderPage();

    await waitFor(() => {
      // Confirm page data loaded
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    // nudge role=note should not exist
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('renders the Take mock exam CTA link pointing to /practice/culture-exam', async () => {
    mockGetReadiness.mockResolvedValue(readinessFixture);
    mockGetStatistics.mockResolvedValue(examStatsFixture);

    renderPage();

    await waitFor(() => {
      const links = screen.getAllByRole('link', { name: /take mock exam/i });
      expect(links.length).toBeGreaterThan(0);
      expect(links[0]).toHaveAttribute('href', '/practice/culture-exam');
    });
  });

  it('shows "No attempts yet" for a category with null accuracy', async () => {
    mockGetReadiness.mockResolvedValue(readinessFixture); // geography has null accuracy
    mockGetStatistics.mockResolvedValue(examStatsFixture);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No attempts yet')).toBeInTheDocument();
    });
  });
});
