// src/features/practice/pf/Card.tsx
//
// .pf-card shell for the practice session redesign.
//
// Key behaviours:
//   - Per-card.id remount (key={card.id} on the page) replays pf-card-in on
//     every new card without JS.
//   - ::before accent bar is coloured by --pf-c (set by PracticeApp parent).
//   - Transform-only enter animation (pf-card-in in pf.css) — opacity is
//     never gated so the card is always visible even under reduced-motion.
//   - .pf-body (question) / .pf-foot (answer) have stable min-heights so
//     layout never shifts between question and answer phase.
//
// PRACT2-3-02: .pf-foot__inner carries data-hidden/inert/aria-hidden so the
//   .pf-foot wrapper can hold both the hidden content AND the absolutely-
//   positioned .pf-reveal-cta overlay without any height change on reveal.

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface CardProps {
  /** Question phase content (shown before flip). */
  body: ReactNode;
  /** Answer phase content (shown after flip, null when not yet flipped). */
  foot?: ReactNode | null;
  /** Whether the card is in the flipped/answer state. */
  isFlipped?: boolean;
  /** Click handler for the question phase (flip trigger). */
  onClick?: () => void;
  /** Extra class names applied to the .pf-card root. */
  className?: string;
}

/**
 * Card — `.pf-card` shell with top accent bar, rounded corners, elevation,
 * and stable min-heights for both question and answer zones.
 *
 * The parent (V2FlashcardPracticePage) passes `key={currentCard.id}` on this
 * component so every card change causes a DOM remount and replays pf-card-in.
 */
export function Card({ body, foot = null, isFlipped = false, onClick, className }: CardProps) {
  return (
    <div
      className={cn('pf-card', className)}
      data-testid="pf-card"
      role={!isFlipped ? 'button' : undefined}
      tabIndex={!isFlipped ? 0 : undefined}
      onClick={!isFlipped ? onClick : undefined}
      onKeyDown={
        !isFlipped
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={!isFlipped ? 'Practice card — tap to reveal answer' : undefined}
    >
      {/* Question zone */}
      <div className="pf-body">{body}</div>

      {/* Answer zone — .pf-foot is position:relative; .pf-foot__inner carries the
          visibility attrs so the content stays in the DOM reserving natural height.
          .pf-reveal-cta is absolutely-positioned inside .pf-foot (sibling of
          .pf-foot__inner) and shown only pre-flip with pointer-events:none so
          clicks fall through to the card-root flip handler.
          getBoundingClientRect().height on .pf-card is identical before and after
          flip (PRACT2-2-01 invariant preserved). */}
      {foot != null && (
        <div className="pf-foot">
          {/* Pre-flip reveal CTA — absolutely positioned, pointer-events:none */}
          {!isFlipped && (
            <div className="pf-reveal-cta" aria-hidden="true">
              <span>Tap or press </span>
              <kbd className="pf-kbd">Space</kbd>
              <span> to reveal answer</span>
            </div>
          )}
          {/* Inner wrapper carries the visibility attributes (PRACT2-2-01) */}
          <div
            className="pf-foot__inner"
            data-hidden={!isFlipped ? 'true' : undefined}
            inert={!isFlipped}
            aria-hidden={!isFlipped ? true : undefined}
          >
            {foot}
          </div>
        </div>
      )}
    </div>
  );
}
