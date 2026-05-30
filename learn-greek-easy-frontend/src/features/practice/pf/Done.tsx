// src/features/practice/pf/Done.tsx
//
// Session-complete screen — `.pf-done` surface.
//
// Shows a green check mark, Inter Tight "Session complete" heading,
// "{n} cards reviewed" count, 4-up tally from ratingBreakdown, and two
// action buttons: Back to deck / Practice again.
//
// Presentational: no store or router access. The page wires callbacks.
//
// Data source: V2SessionSummary from v2PracticeStore.
//   ratingBreakdown.again  → Forgot  (danger)
//   ratingBreakdown.hard   → Tough   (--practice-hard)
//   ratingBreakdown.good   → OK      (success)
//   ratingBreakdown.easy   → Easy    (accent)

import { CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/timeFormatUtils';
import type { V2SessionSummary } from '@/stores/v2PracticeStore';

export interface DoneProps {
  /** The completed session summary from v2PracticeStore. */
  summary: V2SessionSummary;
  /** Navigate back to the originating deck. */
  onBackToDeck: () => void;
  /** Restart a fresh session over the queue. */
  onPracticeAgain: () => void;
}

interface TallyEntry {
  label: string;
  count: number;
  tone: 'forgot' | 'tough' | 'ok' | 'easy';
}

/**
 * Done — session-complete screen in the practice flow (.pf-done).
 *
 * Bound to V2SessionSummary; no store or router coupling inside this component.
 */
export function Done({ summary, onBackToDeck, onPracticeAgain }: DoneProps) {
  const tally: TallyEntry[] = [
    { label: 'Forgot', count: summary.ratingBreakdown.again, tone: 'forgot' },
    { label: 'Tough', count: summary.ratingBreakdown.hard, tone: 'tough' },
    { label: 'OK', count: summary.ratingBreakdown.good, tone: 'ok' },
    { label: 'Easy', count: summary.ratingBreakdown.easy, tone: 'easy' },
  ];

  return (
    <div className="pf-done" data-testid="pf-done">
      {/* Check mark */}
      <div className="pf-done__mark" aria-hidden="true">
        <CheckCircle className="pf-done__check-icon" />
      </div>

      {/* Heading */}
      <h2 className="pf-done__heading">Session complete</h2>

      {/* Cards reviewed count */}
      <p className="pf-done__count" data-testid="pf-done-cards-reviewed">
        {summary.cardsReviewed} cards reviewed
      </p>

      {/* 4-up tally by rating tone */}
      <div className="pf-done__tally" data-testid="pf-done-tally">
        {tally.map(({ label, count, tone }) => (
          <div
            key={tone}
            className={`pf-done__tally-cell pf-done__tally-cell--${tone}`}
            data-testid={`pf-done-tally-${tone}`}
          >
            <span className="pf-done__tally-count">{count}</span>
            <span className="pf-done__tally-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Optional time stats */}
      {summary.totalTimeSeconds > 0 && (
        <div className="pf-done__time-row">
          <span className="pf-done__time-item">
            <span className="pf-done__time-value">{formatDuration(summary.totalTimeSeconds)}</span>
            <span className="pf-done__time-label">Total time</span>
          </span>
          <span className="pf-done__time-sep" aria-hidden="true" />
          <span className="pf-done__time-item">
            <span className="pf-done__time-value">
              {formatDuration(Math.round(summary.avgTimePerCard))}
            </span>
            <span className="pf-done__time-label">Avg / card</span>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="pf-done__actions">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onBackToDeck}
          data-testid="pf-done-back-to-deck"
        >
          Back to deck
        </Button>
        <Button className="flex-1" onClick={onPracticeAgain} data-testid="pf-done-practice-again">
          Practice again
        </Button>
      </div>
    </div>
  );
}
