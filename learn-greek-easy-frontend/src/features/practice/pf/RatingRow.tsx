// src/features/practice/pf/RatingRow.tsx
//
// 4-button rating row: Forgot / Tough / OK / Easy (ratings 1-4).
//
// Each button has:
//   - A tone bar (coloured by the rating's semantic colour)
//   - A label (Forgot / Tough / OK / Easy)
//   - A keyboard keycap hint (1 / 2 / 3 / 4)
//
// The keyboard handler is NOT added here; it already lives in
// usePracticeKeyboard (V2FlashcardPracticePage.tsx:204-232), gated on
// isFlipped. Clicks call onRate(1|2|3|4) which maps to the same handleRate
// path. Do NOT add a second key listener.
//
// Tone mapping (design-system compliant):
//   Forgot  → hsl(var(--danger))
//   Tough   → hsl(25 95% 53%)  [Deviation Justification: sanctioned literal]
//   OK      → hsl(var(--success))
//   Easy    → hsl(var(--accent))

export interface RatingRowProps {
  /** Callback fired when a rating button is clicked. */
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  /** Whether the card is flipped (buttons disabled when not flipped). */
  isFlipped?: boolean;
}

interface RatingOption {
  rating: 1 | 2 | 3 | 4;
  label: string;
  tone: 'forgot' | 'tough' | 'ok' | 'easy';
}

const RATING_OPTIONS: RatingOption[] = [
  { rating: 1, label: 'Forgot', tone: 'forgot' },
  { rating: 2, label: 'Tough', tone: 'tough' },
  { rating: 3, label: 'OK', tone: 'ok' },
  { rating: 4, label: 'Easy', tone: 'easy' },
];

/**
 * RatingRow — 4 rating buttons displayed after card flip.
 *
 * Keyboard shortcuts (1-4) are handled by usePracticeKeyboard in the page.
 * This component only handles click interactions.
 */
export function RatingRow({ onRate, isFlipped = true }: RatingRowProps) {
  return (
    <div className="pf-rating-row" role="group" aria-label="Rate this card" data-testid="pf-rating-row">
      {RATING_OPTIONS.map(({ rating, label, tone }) => (
        <button
          key={rating}
          className={`pf-rating-btn pf-rating-btn--${tone}`}
          data-tone={tone}
          data-testid={`pf-rating-btn-${tone}`}
          onClick={() => onRate(rating)}
          disabled={!isFlipped}
          aria-label={`${label} (key ${rating})`}
          type="button"
        >
          {/* Tone bar at the top */}
          <span className="pf-rating-btn__bar" aria-hidden="true" />
          {/* Label */}
          <span className="pf-rating-btn__label">{label}</span>
          {/* Keycap hint */}
          <kbd className="pf-rating-btn__key" aria-hidden="true">{rating}</kbd>
        </button>
      ))}
    </div>
  );
}
