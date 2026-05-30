// src/features/practice/pf/ProgressBar.tsx
//
// Segmented progress bar for the practice session top bar.
// Renders one tick per card; the current tick pulses with the family accent.
// Rated ticks are recoloured via data-rate: forgot/tough/ok/easy.
// Followed by a count reading "{idx+1} / {total}".
//
// Design-system: all colours via .pf-seg[data-rate] CSS rules in pf.css.
// No raw hex or arbitrary Tailwind values.

import type { StudyQueueCard } from '@/services/studyAPI';
import type { RatingKey } from '@/stores/v2PracticeStore';

import { familyForCardType } from './families';

export interface ProgressBarProps {
  /** All cards in the session queue. */
  cards: StudyQueueCard[];
  /** Zero-based index of the current card (optimistically advanced). */
  currentIndex: number;
  /** Per-card rating outcomes from the store. */
  ratings: (RatingKey | null)[];
}

/**
 * ProgressBar — one segment tick per session card.
 *
 * Tick states:
 * - Unrated, not current  → muted grey (default .pf-seg)
 * - Current               → family-colour pulse (.is-current)
 * - Rated                 → recoloured by data-rate attribute
 *
 * The family class (.pf-fam-{family}) is set for CSS hooks in later subtasks.
 * Visual colouring is handled by `.is-current` + CSS `var(--pf-c)` injected
 * by PracticeApp for the current tick.
 */
export function ProgressBar({ cards, currentIndex, ratings }: ProgressBarProps) {
  const total = cards.length;

  return (
    <div className="pf-progress" aria-label="Session progress">
      <div
        className="pf-seg-track"
        role="progressbar"
        aria-valuenow={Math.min(currentIndex + 1, total)}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        {cards.map((card, idx) => {
          const rating = ratings[idx] ?? null;
          const isCurrent = idx === currentIndex;
          const family = familyForCardType(card.card_type);

          let cls = `pf-seg pf-fam-${family}`;
          if (isCurrent) cls += ' is-current';

          return (
            <span
              key={card.card_record_id}
              className={cls}
              data-rate={rating ?? undefined}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <span className="pf-progress-count">
        <b>{Math.min(currentIndex + 1, total)}</b> / {total}
      </span>
    </div>
  );
}
