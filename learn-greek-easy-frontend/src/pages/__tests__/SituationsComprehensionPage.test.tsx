/**
 * SituationsComprehensionPage Tests (SIT-27-09 / SIT-27-10)
 *
 * Focused coverage of the two non-trivial rendering rules the visual gate can't
 * cheaply assert:
 *  - empty recent-sessions state ("No reviews yet")
 *  - per-topic danger-tone threshold (< 40% → data-tone='danger') and the
 *    null-accuracy "No attempts yet" empty state
 */

import { createElement } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { render, createTestQueryClient } from '@/lib/test-utils';
import { SituationsComprehensionPage } from '@/pages/SituationsComprehensionPage';
import { situationAPI } from '@/services/situationAPI';
import type { SituationComprehensionResponse } from '@/types/situation';

vi.mock('@/services/situationAPI', () => ({
  situationAPI: {
    getList: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 }),
    getComprehension: vi.fn(),
  },
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  registerTheme: vi.fn(),
  registerInterfaceLanguage: vi.fn(),
}));

function makeResponse(
  overrides: Partial<SituationComprehensionResponse> = {}
): SituationComprehensionResponse {
  return {
    comprehension_percentage: 52,
    verdict: 'getting_there',
    topic_confidence: [
      { topic: 'Listening', confidence_percentage: 70, accuracy: 80 },
      { topic: 'Reading', confidence_percentage: 35, accuracy: null }, // danger + no attempts
      { topic: 'Dialogue', confidence_percentage: 50, accuracy: 55 },
      { topic: 'Visual', confidence_percentage: 90, accuracy: 95 },
    ],
    streak: 4,
    recent_sessions: [],
    whats_new_count: 2,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = createTestQueryClient();
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(SituationsComprehensionPage)
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (situationAPI.getList as Mock).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 1,
  });
});

describe('SituationsComprehensionPage', () => {
  it('renders the donut percentage and verdict from the payload', async () => {
    (situationAPI.getComprehension as Mock).mockResolvedValue(makeResponse());
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('comprehension-donut-pct')).toHaveTextContent('52%');
    });
    // getting_there → "Getting there" verdict label
    expect(screen.getByTestId('comprehension-verdict')).toHaveTextContent(/getting there/i);
  });

  it('applies danger tone to a topic below 40% confidence', async () => {
    (situationAPI.getComprehension as Mock).mockResolvedValue(makeResponse());
    renderPage();

    // Reading is 35% → danger; Listening is 70% → success
    const readingRow = await screen.findByTestId('comprehension-topic-Reading');
    const readingBar = readingRow.querySelector('.cx-cat-bar');
    expect(readingBar).toHaveAttribute('data-tone', 'danger');

    const listeningRow = screen.getByTestId('comprehension-topic-Listening');
    expect(listeningRow.querySelector('.cx-cat-bar')).toHaveAttribute('data-tone', 'success');
  });

  it('shows "No attempts yet" for a topic with null accuracy', async () => {
    (situationAPI.getComprehension as Mock).mockResolvedValue(makeResponse());
    renderPage();

    const readingRow = await screen.findByTestId('comprehension-topic-Reading');
    // Reading has accuracy: null → empty-state copy, NOT "0%"
    expect(within(readingRow).getByText(/no attempts yet/i)).toBeInTheDocument();
    expect(within(readingRow).queryByText(/accuracy/i)).not.toBeInTheDocument();
  });

  it('renders the empty recent-sessions state when there are no reviews', async () => {
    (situationAPI.getComprehension as Mock).mockResolvedValue(
      makeResponse({ recent_sessions: [] })
    );
    renderPage();

    expect(await screen.findByTestId('comprehension-recent-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('comprehension-session-0')).not.toBeInTheDocument();
  });

  it('renders recent-session rows with derived pass/fail and Strong/Review tags', async () => {
    (situationAPI.getComprehension as Mock).mockResolvedValue(
      makeResponse({
        recent_sessions: [
          { reviewed_at: '2026-06-20T10:00:00Z', score: 9, max_score: 10, quality: 5 }, // 90% pass, Strong
          { reviewed_at: '2026-06-19T10:00:00Z', score: 4, max_score: 10, quality: 2 }, // 40% fail, Review
        ],
      })
    );
    renderPage();

    const first = await screen.findByTestId('comprehension-session-0');
    expect(within(first).getByText('90%')).toBeInTheDocument();
    expect(within(first).getByText(/strong/i)).toBeInTheDocument();
    expect(first.querySelector('.cx-attempt-icon')).toHaveAttribute('data-pass', 'true');

    const second = screen.getByTestId('comprehension-session-1');
    expect(within(second).getByText(/review/i)).toBeInTheDocument();
    expect(second.querySelector('.cx-attempt-icon')).toHaveAttribute('data-pass', 'false');
  });

  it('shows the error nudge when the comprehension query fails', async () => {
    (situationAPI.getComprehension as Mock).mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByTestId('comprehension-error')).toBeInTheDocument();
  });
});
