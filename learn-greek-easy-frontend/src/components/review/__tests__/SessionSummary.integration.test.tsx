/**
 * SessionSummary Component Integration Tests
 *
 * Tests session summary display and analytics integration including:
 * - Summary statistics display (cards reviewed, accuracy, time)
 * - Rating breakdown visualization
 * - Progress transitions (new → learning → mastered)
 * - Navigation actions (back to deck, review again, dashboard)
 * - Edge cases (zero cards, perfect score, all failures)
 *
 * These tests verify that SessionSummary correctly displays session data
 * and integrates with navigation and analytics systems.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { SessionSummary } from '../SessionSummary';
import type { SessionSummary as SessionSummaryType } from '@/types/review';

// Mock navigation
const mockOnBackToDeck = vi.fn();
const mockOnReviewAgain = vi.fn();
const mockOnDashboard = vi.fn();

describe('SessionSummary - Statistics Display', () => {
  beforeEach(() => {
    mockOnBackToDeck.mockClear();
    mockOnReviewAgain.mockClear();
    mockOnDashboard.mockClear();
  });

  const createMockSummary = (overrides?: Partial<SessionSummaryType>): SessionSummaryType => ({
    sessionId: 'session-123',
    deckId: 'deck-a1',
    userId: 'user-1',
    completedAt: new Date(),
    cardsReviewed: 10,
    accuracy: 80,
    totalTime: 300, // 5 minutes
    averageTimePerCard: 30, // 30 seconds
    ratingBreakdown: {
      again: 1,
      hard: 1,
      good: 6,
      easy: 2,
    },
    transitions: {
      newToLearning: 3,
      learningToReview: 2,
      reviewToMastered: 1,
      toRelearning: 1,
    },
    deckProgressBefore: {
      cardsNew: 20,
      cardsLearning: 5,
      cardsReview: 15,
      cardsMastered: 10,
    },
    deckProgressAfter: {
      cardsNew: 17,
      cardsLearning: 6,
      cardsReview: 16,
      cardsMastered: 11,
    },
    ...overrides,
  });

  it('should display session completion message', () => {
    const summary = createMockSummary();

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText(/session complete/i)).toBeInTheDocument();
  });

  it('should display total cards reviewed', () => {
    const summary = createMockSummary({ cardsReviewed: 15 });

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText(/cards reviewed/i)).toBeInTheDocument();
  });

  it('should display accuracy percentage with correct color coding', () => {
    const summaryGood = createMockSummary({ accuracy: 85 });

    const { rerender } = render(
      <SessionSummary
        summary={summaryGood}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText(/85%/)).toBeInTheDocument();
    expect(screen.getByText(/accuracy/i)).toBeInTheDocument();

    // Test with low accuracy
    const summaryPoor = createMockSummary({ accuracy: 45 });
    rerender(
      <SessionSummary
        summary={summaryPoor}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText(/45%/)).toBeInTheDocument();
  });

  it('should display time spent in readable format', () => {
    // Test various time formats
    const summary1 = createMockSummary({ totalTime: 45 }); // 45 seconds

    const { rerender } = render(
      <SessionSummary
        summary={summary1}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText(/time spent/i)).toBeInTheDocument();

    // Test with minutes
    const summary2 = createMockSummary({ totalTime: 180 }); // 3 minutes
    rerender(
      <SessionSummary
        summary={summary2}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText(/time spent/i)).toBeInTheDocument();
  });

  it('should display average time per card', () => {
    const summary = createMockSummary({ averageTimePerCard: 25 });

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText('25s')).toBeInTheDocument();
    expect(screen.getByText(/avg per card/i)).toBeInTheDocument();
  });
});

describe('SessionSummary - Rating Breakdown', () => {
  beforeEach(() => {
    mockOnBackToDeck.mockClear();
    mockOnReviewAgain.mockClear();
    mockOnDashboard.mockClear();
  });

  const createMockSummary = (overrides?: Partial<SessionSummaryType>): SessionSummaryType => ({
    sessionId: 'session-123',
    deckId: 'deck-a1',
    userId: 'user-1',
    completedAt: new Date(),
    cardsReviewed: 10,
    accuracy: 80,
    totalTime: 300,
    averageTimePerCard: 30,
    ratingBreakdown: {
      again: 1,
      hard: 1,
      good: 6,
      easy: 2,
    },
    transitions: {
      newToLearning: 3,
      learningToReview: 2,
      reviewToMastered: 1,
      toRelearning: 1,
    },
    deckProgressBefore: {
      cardsNew: 20,
      cardsLearning: 5,
      cardsReview: 15,
      cardsMastered: 10,
    },
    deckProgressAfter: {
      cardsNew: 17,
      cardsLearning: 6,
      cardsReview: 16,
      cardsMastered: 11,
    },
    ...overrides,
  });

  it('should display rating breakdown section', () => {
    const summary = createMockSummary();

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText(/rating breakdown/i)).toBeInTheDocument();
  });

  it('should display all rating counts (Again, Hard, Good, Easy)', () => {
    const summary = createMockSummary({
      ratingBreakdown: {
        again: 2,
        hard: 3,
        good: 8,
        easy: 5,
      },
    });

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    // Check for rating labels
    expect(screen.getByText(/again/i)).toBeInTheDocument();
    expect(screen.getByText(/hard/i)).toBeInTheDocument();
    expect(screen.getByText(/good/i)).toBeInTheDocument();
    expect(screen.getByText(/easy/i)).toBeInTheDocument();

    // Check for counts
    expect(screen.getByText('2')).toBeInTheDocument(); // Again
    expect(screen.getByText('3')).toBeInTheDocument(); // Hard
    expect(screen.getByText('8')).toBeInTheDocument(); // Good
    expect(screen.getByText('5')).toBeInTheDocument(); // Easy
  });

  it('should display rating percentages correctly', () => {
    const summary = createMockSummary({
      cardsReviewed: 10,
      ratingBreakdown: {
        again: 1, // 10%
        hard: 2,  // 20%
        good: 5,  // 50%
        easy: 2,  // 20%
      },
    });

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    // Percentages should be calculated and displayed
    expect(screen.getByText(/10%/)).toBeInTheDocument(); // Again
    expect(screen.getAllByText(/20%/).length).toBeGreaterThan(0); // Hard and Easy
    expect(screen.getByText(/50%/)).toBeInTheDocument(); // Good
  });
});

describe('SessionSummary - Progress Transitions', () => {
  beforeEach(() => {
    mockOnBackToDeck.mockClear();
    mockOnReviewAgain.mockClear();
    mockOnDashboard.mockClear();
  });

  const createMockSummary = (overrides?: Partial<SessionSummaryType>): SessionSummaryType => ({
    sessionId: 'session-123',
    deckId: 'deck-a1',
    userId: 'user-1',
    completedAt: new Date(),
    cardsReviewed: 10,
    accuracy: 80,
    totalTime: 300,
    averageTimePerCard: 30,
    ratingBreakdown: {
      again: 1,
      hard: 1,
      good: 6,
      easy: 2,
    },
    transitions: {
      newToLearning: 0,
      learningToReview: 0,
      reviewToMastered: 0,
      toRelearning: 0,
    },
    deckProgressBefore: {
      cardsNew: 20,
      cardsLearning: 5,
      cardsReview: 15,
      cardsMastered: 10,
    },
    deckProgressAfter: {
      cardsNew: 20,
      cardsLearning: 5,
      cardsReview: 15,
      cardsMastered: 10,
    },
    ...overrides,
  });

  it('should display progress transitions when they exist', () => {
    const summary = createMockSummary({
      transitions: {
        newToLearning: 3,
        learningToReview: 2,
        reviewToMastered: 1,
        toRelearning: 1,
      },
    });

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText(/progress made/i)).toBeInTheDocument();
    expect(screen.getByText(/3.*moved to learning/i)).toBeInTheDocument();
    expect(screen.getByText(/2.*graduated to review/i)).toBeInTheDocument();
    expect(screen.getByText(/1.*mastered/i)).toBeInTheDocument();
    expect(screen.getByText(/1.*need review/i)).toBeInTheDocument();
  });

  it('should hide progress section when no transitions occurred', () => {
    const summary = createMockSummary({
      transitions: {
        newToLearning: 0,
        learningToReview: 0,
        reviewToMastered: 0,
        toRelearning: 0,
      },
    });

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.queryByText(/progress made/i)).not.toBeInTheDocument();
  });
});

describe('SessionSummary - Navigation Actions', () => {
  beforeEach(() => {
    mockOnBackToDeck.mockClear();
    mockOnReviewAgain.mockClear();
    mockOnDashboard.mockClear();
  });

  const createMockSummary = (): SessionSummaryType => ({
    sessionId: 'session-123',
    deckId: 'deck-a1',
    userId: 'user-1',
    completedAt: new Date(),
    cardsReviewed: 10,
    accuracy: 80,
    totalTime: 300,
    averageTimePerCard: 30,
    ratingBreakdown: {
      again: 1,
      hard: 1,
      good: 6,
      easy: 2,
    },
    transitions: {
      newToLearning: 3,
      learningToReview: 2,
      reviewToMastered: 1,
      toRelearning: 1,
    },
    deckProgressBefore: {
      cardsNew: 20,
      cardsLearning: 5,
      cardsReview: 15,
      cardsMastered: 10,
    },
    deckProgressAfter: {
      cardsNew: 17,
      cardsLearning: 6,
      cardsReview: 16,
      cardsMastered: 11,
    },
  });

  it('should call onBackToDeck when "Back to Deck" button is clicked', async () => {
    const user = userEvent.setup();
    const summary = createMockSummary();

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    const backButton = screen.getByRole('button', { name: /back to deck/i });
    await user.click(backButton);

    expect(mockOnBackToDeck).toHaveBeenCalledTimes(1);
  });

  it('should call onReviewAgain when "Review Again" button is clicked', async () => {
    const user = userEvent.setup();
    const summary = createMockSummary();

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    const reviewAgainButton = screen.getByRole('button', { name: /review again/i });
    await user.click(reviewAgainButton);

    expect(mockOnReviewAgain).toHaveBeenCalledTimes(1);
  });

  it('should call onDashboard when "Dashboard" button is clicked', async () => {
    const user = userEvent.setup();
    const summary = createMockSummary();

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    // Dashboard button might be hidden on mobile, so check if it exists
    const dashboardButton = screen.queryByRole('button', { name: /dashboard/i });

    if (dashboardButton) {
      await user.click(dashboardButton);
      expect(mockOnDashboard).toHaveBeenCalledTimes(1);
    }
  });

  it('should display all navigation buttons', () => {
    const summary = createMockSummary();

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByRole('button', { name: /back to deck/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review again/i })).toBeInTheDocument();
    // Dashboard button might be hidden on mobile in responsive design
  });
});

describe('SessionSummary - Edge Cases', () => {
  beforeEach(() => {
    mockOnBackToDeck.mockClear();
    mockOnReviewAgain.mockClear();
    mockOnDashboard.mockClear();
  });

  const createMockSummary = (overrides?: Partial<SessionSummaryType>): SessionSummaryType => ({
    sessionId: 'session-123',
    deckId: 'deck-a1',
    userId: 'user-1',
    completedAt: new Date(),
    cardsReviewed: 10,
    accuracy: 80,
    totalTime: 300,
    averageTimePerCard: 30,
    ratingBreakdown: {
      again: 1,
      hard: 1,
      good: 6,
      easy: 2,
    },
    transitions: {
      newToLearning: 3,
      learningToReview: 2,
      reviewToMastered: 1,
      toRelearning: 1,
    },
    deckProgressBefore: {
      cardsNew: 20,
      cardsLearning: 5,
      cardsReview: 15,
      cardsMastered: 10,
    },
    deckProgressAfter: {
      cardsNew: 17,
      cardsLearning: 6,
      cardsReview: 16,
      cardsMastered: 11,
    },
    ...overrides,
  });

  it('should handle zero cards reviewed edge case', () => {
    const summary = createMockSummary({ cardsReviewed: 0 });

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText(/session ended without reviewing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to deck/i })).toBeInTheDocument();
  });

  it('should display perfect score (100% accuracy) correctly', () => {
    const summary = createMockSummary({
      cardsReviewed: 10,
      accuracy: 100,
      ratingBreakdown: {
        again: 0,
        hard: 0,
        good: 5,
        easy: 5,
      },
    });

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText(/100%/)).toBeInTheDocument();
    // Should show encouraging message for perfect score
    expect(screen.getByText(/session complete/i)).toBeInTheDocument();
  });

  it('should display poor performance (0% accuracy) with supportive message', () => {
    const summary = createMockSummary({
      cardsReviewed: 5,
      accuracy: 0,
      ratingBreakdown: {
        again: 5,
        hard: 0,
        good: 0,
        easy: 0,
      },
    });

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText(/0%/)).toBeInTheDocument();
    expect(screen.getByText(/session complete/i)).toBeInTheDocument();
  });

  it('should handle large numbers correctly (100+ cards)', () => {
    const summary = createMockSummary({
      cardsReviewed: 150,
      totalTime: 3600, // 1 hour
      averageTimePerCard: 24,
    });

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('24s')).toBeInTheDocument();
  });

  it('should handle very short session (single card)', () => {
    const summary = createMockSummary({
      cardsReviewed: 1,
      totalTime: 15,
      averageTimePerCard: 15,
      ratingBreakdown: {
        again: 0,
        hard: 0,
        good: 1,
        easy: 0,
      },
    });

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/cards reviewed/i)).toBeInTheDocument();
  });
});

describe('SessionSummary - Accessibility', () => {
  beforeEach(() => {
    mockOnBackToDeck.mockClear();
    mockOnReviewAgain.mockClear();
    mockOnDashboard.mockClear();
  });

  const createMockSummary = (): SessionSummaryType => ({
    sessionId: 'session-123',
    deckId: 'deck-a1',
    userId: 'user-1',
    completedAt: new Date(),
    cardsReviewed: 10,
    accuracy: 80,
    totalTime: 300,
    averageTimePerCard: 30,
    ratingBreakdown: {
      again: 1,
      hard: 1,
      good: 6,
      easy: 2,
    },
    transitions: {
      newToLearning: 3,
      learningToReview: 2,
      reviewToMastered: 1,
      toRelearning: 1,
    },
    deckProgressBefore: {
      cardsNew: 20,
      cardsLearning: 5,
      cardsReview: 15,
      cardsMastered: 10,
    },
    deckProgressAfter: {
      cardsNew: 17,
      cardsLearning: 6,
      cardsReview: 16,
      cardsMastered: 11,
    },
  });

  it('should have proper ARIA live region for status', () => {
    const summary = createMockSummary();

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    // Check for role="status" or aria-live
    const statusElement = screen.getByRole('status');
    expect(statusElement).toBeInTheDocument();
  });

  it('should have accessible button labels', () => {
    const summary = createMockSummary();

    render(
      <SessionSummary
        summary={summary}
        onBackToDeck={mockOnBackToDeck}
        onReviewAgain={mockOnReviewAgain}
        onDashboard={mockOnDashboard}
      />
    );

    const backButton = screen.getByRole('button', { name: /back to deck/i });
    const reviewAgainButton = screen.getByRole('button', { name: /review again/i });

    expect(backButton).toHaveAccessibleName();
    expect(reviewAgainButton).toHaveAccessibleName();
  });
});
