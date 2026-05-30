// src/features/practice/pf/__tests__/Done.test.tsx
//
// RTL tests for the Done session-complete screen.
//
// Covers:
//   - Check mark rendered
//   - "{n} cards reviewed" from summary.cardsReviewed
//   - 4-up tally from summary.ratingBreakdown
//   - Back to deck invokes onBackToDeck
//   - Practice again invokes onPracticeAgain

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { render, screen } from '@/lib/test-utils';

import { Done } from '../Done';
import type { DoneProps } from '../Done';

// Minimal V2SessionSummary fixture
const makeSummary = (overrides?: Partial<DoneProps['summary']>): DoneProps['summary'] => ({
  sessionId: 'sess-test',
  deckId: 'deck-123',
  cardsReviewed: 12,
  totalTimeSeconds: 180,
  avgTimePerCard: 15,
  ratingBreakdown: { again: 2, hard: 3, good: 5, easy: 2 },
  newStarted: 4,
  cardsMastered: 2,
  ...overrides,
});

describe('Done', () => {
  const onBackToDeck = vi.fn();
  const onPracticeAgain = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the check mark container', () => {
    render(
      <Done summary={makeSummary()} onBackToDeck={onBackToDeck} onPracticeAgain={onPracticeAgain} />
    );
    expect(screen.getByTestId('pf-done')).toBeInTheDocument();
    // The mark container is aria-hidden; check SVG presence via role
    // lucide renders an svg
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders "{n} cards reviewed" from cardsReviewed', () => {
    render(
      <Done
        summary={makeSummary({ cardsReviewed: 7 })}
        onBackToDeck={onBackToDeck}
        onPracticeAgain={onPracticeAgain}
      />
    );
    expect(screen.getByTestId('pf-done-cards-reviewed')).toHaveTextContent('7 cards reviewed');
  });

  it('renders 4-up tally with counts from ratingBreakdown', () => {
    render(
      <Done
        summary={makeSummary({
          ratingBreakdown: { again: 1, hard: 4, good: 6, easy: 3 },
        })}
        onBackToDeck={onBackToDeck}
        onPracticeAgain={onPracticeAgain}
      />
    );

    const tally = screen.getByTestId('pf-done-tally');
    expect(tally).toBeInTheDocument();

    // Each cell testid
    expect(screen.getByTestId('pf-done-tally-forgot')).toHaveTextContent('1');
    expect(screen.getByTestId('pf-done-tally-tough')).toHaveTextContent('4');
    expect(screen.getByTestId('pf-done-tally-ok')).toHaveTextContent('6');
    expect(screen.getByTestId('pf-done-tally-easy')).toHaveTextContent('3');

    // Labels
    expect(screen.getByTestId('pf-done-tally-forgot')).toHaveTextContent('Forgot');
    expect(screen.getByTestId('pf-done-tally-tough')).toHaveTextContent('Tough');
    expect(screen.getByTestId('pf-done-tally-ok')).toHaveTextContent('OK');
    expect(screen.getByTestId('pf-done-tally-easy')).toHaveTextContent('Easy');
  });

  it('calls onBackToDeck when Back to deck button is clicked', () => {
    render(
      <Done summary={makeSummary()} onBackToDeck={onBackToDeck} onPracticeAgain={onPracticeAgain} />
    );
    screen.getByTestId('pf-done-back-to-deck').click();
    expect(onBackToDeck).toHaveBeenCalledTimes(1);
    expect(onPracticeAgain).not.toHaveBeenCalled();
  });

  it('calls onPracticeAgain when Practice again button is clicked', () => {
    render(
      <Done summary={makeSummary()} onBackToDeck={onBackToDeck} onPracticeAgain={onPracticeAgain} />
    );
    screen.getByTestId('pf-done-practice-again').click();
    expect(onPracticeAgain).toHaveBeenCalledTimes(1);
    expect(onBackToDeck).not.toHaveBeenCalled();
  });

  it('renders time stats when totalTimeSeconds > 0', () => {
    render(
      <Done
        summary={makeSummary({ totalTimeSeconds: 90, avgTimePerCard: 9 })}
        onBackToDeck={onBackToDeck}
        onPracticeAgain={onPracticeAgain}
      />
    );
    expect(screen.getByText('Total time')).toBeInTheDocument();
    expect(screen.getByText('Avg / card')).toBeInTheDocument();
  });

  it('does not render time stats when totalTimeSeconds is 0', () => {
    render(
      <Done
        summary={makeSummary({ totalTimeSeconds: 0, avgTimePerCard: 0 })}
        onBackToDeck={onBackToDeck}
        onPracticeAgain={onPracticeAgain}
      />
    );
    expect(screen.queryByText('Total time')).not.toBeInTheDocument();
    expect(screen.queryByText('Avg / card')).not.toBeInTheDocument();
  });
});
