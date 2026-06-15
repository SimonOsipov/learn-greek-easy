// src/features/practice/pf/RatingRow.tsx
//
// 4-button rating row: Forgot / Tough / OK / Easy (ratings 1-4).
//
// Each button has:
//   - A tone bar (coloured by the rating's semantic colour)
//   - A label (Forgot / Tough / OK / Easy)
//   - A keyboard keycap hint (1 / 2 / 3 / 4)
//   - An interval hint (projected next review, via rating_previews from PRACT2-3-05)
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

import { useTranslation } from 'react-i18next';

import type { RatingPreview } from '@/services/studyAPI';

import { formatReviewInterval } from './Toast';

export interface RatingRowProps {
  /** Callback fired when a rating button is clicked. */
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  /** Whether the card is flipped (buttons disabled when not flipped). */
  isFlipped?: boolean;
  /** Projected SM-2 intervals per rating, from PRACT2-3-05. When absent, no hint is shown. */
  previews?: RatingPreview[];
}

interface RatingOption {
  rating: 1 | 2 | 3 | 4;
  /** i18n key suffix under deck:practice.rating.* (also the design-system tone). */
  tone: 'forgot' | 'tough' | 'ok' | 'easy';
}

const RATING_OPTIONS: RatingOption[] = [
  { rating: 1, tone: 'forgot' },
  { rating: 2, tone: 'tough' },
  { rating: 3, tone: 'ok' },
  { rating: 4, tone: 'easy' },
];

/**
 * RatingRow — 4 rating buttons displayed after card flip.
 *
 * Keyboard shortcuts (1-4) are handled by usePracticeKeyboard in the page.
 * This component only handles click interactions.
 *
 * When `previews` is provided (PRACT2-3-05), each button shows the real
 * projected next-review interval below the label via `.pf-rating-btn__hint`.
 * When absent, buttons render label-only (pre-PRACT2-3 behavior).
 */
export function RatingRow({ onRate, isFlipped = true, previews }: RatingRowProps) {
  const { t } = useTranslation('deck');

  // PRACT2-9-01: Suppress hints when all four formatted intervals are identical.
  // Comparison is on the formatted string (not the raw interval number) so that
  // two intervals that render the same (e.g. 30 and 31 → "1 month") are treated
  // as identical. Only suppresses when all four ratings have a preview.
  const allHintsIdentical = (() => {
    const formattedStrings = ([1, 2, 3, 4] as const).map((r) => {
      const p = previews?.find((preview) => preview.rating === r);
      return p ? formatReviewInterval(p.interval) : null;
    });
    if (formattedStrings.some((s) => s === null)) return false;
    return new Set(formattedStrings).size === 1;
  })();

  return (
    <div
      className="pf-rating-row"
      role="group"
      aria-label={t('practice.rating.groupLabel')}
      data-testid="pf-rating-row"
    >
      {RATING_OPTIONS.map(({ rating, tone }) => {
        const preview = previews?.find((p) => p.rating === rating);
        const label = t(`practice.rating.${tone}`);
        return (
          <button
            key={rating}
            className={`pf-rating-btn pf-rating-btn--${tone}`}
            data-tone={tone}
            data-testid={`pf-rating-btn-${tone}`}
            onClick={() => onRate(rating)}
            disabled={!isFlipped}
            aria-label={`${label} (${t('practice.rating.ariaKey', { n: rating })})`}
            type="button"
          >
            {/* Tone bar at the top */}
            <span className="pf-rating-btn__bar" aria-hidden="true" />
            {/* Label */}
            <span className="pf-rating-btn__label">{label}</span>
            {/* Projected interval hint (PRACT2-3-06) — suppressed when all four are identical */}
            {preview && !allHintsIdentical && (
              <span className="pf-rating-btn__hint" aria-hidden="true">
                {formatReviewInterval(preview.interval)}
              </span>
            )}
            {/* Keycap hint */}
            <kbd className="pf-rating-btn__key" aria-hidden="true">
              {rating}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}
