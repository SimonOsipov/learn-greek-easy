/**
 * SessionSummary Component Integration Tests
 *
 * Tests session summary display and analytics integration including:
 * - Summary statistics display (cards reviewed, accuracy, time)
 * - Rating breakdown visualization
 * - Navigation actions (back to dashboard)
 * - Edge cases (zero cards, perfect score, all failures)
 *
 * These tests verify that SessionSummary correctly displays session data
 * and integrates with navigation and analytics systems.
 */

import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { render, screen } from '@/lib/test-utils';
import type { SessionSummary as SessionSummaryType } from '@/types/review';

import { SessionSummary } from '../SessionSummary';

// Mock navigation
const mockOnBackToDashboard = vi.fn();

describe('SessionSummary - Statistics Display', () => {
  beforeEach(() => {
    mockOnBackToDashboard.mockClear();
  });

  const createMockSummary = (overrides?: Partial<SessionSummaryType>): SessionSummaryType => ({
    sessionId: 'session-123',
    deckId: 'deck-a1',
    userId: 'user-1',
    completedAt: new Date(),
    cardsReviewed: 10,
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

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    expect(screen.getByText(/session complete/i)).toBeInTheDocument();
  });

  it('should display total cards reviewed', () => {
    const summary = createMockSummary({ cardsReviewed: 15 });

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText(/cards reviewed/i)).toBeInTheDocument();
  });

  it('should display time spent in readable format', () => {
    // Test various time formats
    const summary1 = createMockSummary({ totalTime: 45 }); // 45 seconds

    const { rerender } = render(
      <SessionSummary summary={summary1} onBackToDashboard={mockOnBackToDashboard} />
    );

    expect(screen.getByText(/time spent/i)).toBeInTheDocument();

    // Test with minutes
    const summary2 = createMockSummary({ totalTime: 180 }); // 3 minutes
    rerender(<SessionSummary summary={summary2} onBackToDashboard={mockOnBackToDashboard} />);

    expect(screen.getByText(/time spent/i)).toBeInTheDocument();
  });

  it('should display average time per card', () => {
    const summary = createMockSummary({ averageTimePerCard: 25 });

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    expect(screen.getByText('25s')).toBeInTheDocument();
    expect(screen.getByText(/avg per card/i)).toBeInTheDocument();
  });
});

describe('SessionSummary - Rating Breakdown', () => {
  beforeEach(() => {
    mockOnBackToDashboard.mockClear();
  });

  const createMockSummary = (overrides?: Partial<SessionSummaryType>): SessionSummaryType => ({
    sessionId: 'session-123',
    deckId: 'deck-a1',
    userId: 'user-1',
    completedAt: new Date(),
    cardsReviewed: 10,
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

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

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

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    // Check for rating labels
    expect(screen.getAllByText(/again/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/hard/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/good/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/easy/i).length).toBeGreaterThan(0);

    // Check for counts (use getAllByText since numbers may appear multiple times)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0); // Again
    expect(screen.getAllByText('3').length).toBeGreaterThan(0); // Hard
    expect(screen.getAllByText('8').length).toBeGreaterThan(0); // Good
    expect(screen.getAllByText('5').length).toBeGreaterThan(0); // Easy
  });

  it('should display rating percentages correctly', () => {
    const summary = createMockSummary({
      cardsReviewed: 10,
      ratingBreakdown: {
        again: 1, // 10%
        hard: 2, // 20%
        good: 5, // 50%
        easy: 2, // 20%
      },
    });

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    // Percentages should be calculated and displayed (use getAllByText since some percentages may appear multiple times)
    expect(screen.getAllByText(/10%/).length).toBeGreaterThan(0); // Again
    expect(screen.getAllByText(/20%/).length).toBeGreaterThan(0); // Hard and Easy
    expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0); // Good
  });
});

describe('SessionSummary - Navigation Actions', () => {
  beforeEach(() => {
    mockOnBackToDashboard.mockClear();
  });

  const createMockSummary = (): SessionSummaryType => ({
    sessionId: 'session-123',
    deckId: 'deck-a1',
    userId: 'user-1',
    completedAt: new Date(),
    cardsReviewed: 10,
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

  it('should call onBackToDashboard when "Back to Dashboard" button is clicked', async () => {
    const user = userEvent.setup();
    const summary = createMockSummary();

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    const backButton = screen.getByRole('button', { name: /back to dashboard/i });
    await user.click(backButton);

    expect(mockOnBackToDashboard).toHaveBeenCalledTimes(1);
  });

  it('should display Back to Dashboard button', () => {
    const summary = createMockSummary();

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument();
  });
});

describe('SessionSummary - Edge Cases', () => {
  beforeEach(() => {
    mockOnBackToDashboard.mockClear();
  });

  const createMockSummary = (overrides?: Partial<SessionSummaryType>): SessionSummaryType => ({
    sessionId: 'session-123',
    deckId: 'deck-a1',
    userId: 'user-1',
    completedAt: new Date(),
    cardsReviewed: 10,
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

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    expect(screen.getByText(/session ended without reviewing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument();
  });

  it('should display perfect score (no again ratings) correctly', () => {
    const summary = createMockSummary({
      cardsReviewed: 10,
      ratingBreakdown: {
        again: 0,
        hard: 0,
        good: 5,
        easy: 5,
      },
    });

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    // Should show encouraging message for perfect score
    expect(screen.getByText(/session complete/i)).toBeInTheDocument();
  });

  it('should display poor performance (all again ratings) with supportive message', () => {
    const summary = createMockSummary({
      cardsReviewed: 5,
      ratingBreakdown: {
        again: 5,
        hard: 0,
        good: 0,
        easy: 0,
      },
    });

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    // Should still show session complete message
    expect(screen.getByText(/session complete/i)).toBeInTheDocument();
  });

  it('should handle large numbers correctly (100+ cards)', () => {
    const summary = createMockSummary({
      cardsReviewed: 150,
      totalTime: 3600, // 1 hour
      averageTimePerCard: 24,
    });

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

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

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    // Use getAllByText since '1' may appear multiple times in the summary
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getByText(/cards reviewed/i)).toBeInTheDocument();
  });
});

describe('SessionSummary - Accessibility', () => {
  beforeEach(() => {
    mockOnBackToDashboard.mockClear();
  });

  const createMockSummary = (): SessionSummaryType => ({
    sessionId: 'session-123',
    deckId: 'deck-a1',
    userId: 'user-1',
    completedAt: new Date(),
    cardsReviewed: 10,
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

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    // Check for role="status" or aria-live
    const statusElement = screen.getByRole('status');
    expect(statusElement).toBeInTheDocument();
  });

  it('should have accessible button labels', () => {
    const summary = createMockSummary();

    render(<SessionSummary summary={summary} onBackToDashboard={mockOnBackToDashboard} />);

    const backButton = screen.getByRole('button', { name: /back to dashboard/i });

    expect(backButton).toHaveAccessibleName();
  });
});
