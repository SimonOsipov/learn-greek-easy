// src/features/practice/pf/__tests__/RatingRow.test.tsx
//
// Tests for RatingRow.tsx:
//   - 4 buttons rendered (Forgot/Tough/OK/Easy)           [PRACT2-1-07]
//   - Click fires onRate(1|2|3|4)                         [PRACT2-1-07]
//   - Buttons disabled when isFlipped=false               [PRACT2-1-07]
//   - Interval hints rendered per rating when previews provided [PRACT2-3-06]
//   - Graceful absence: no hint when previews omitted         [PRACT2-3-06]
//   - Identical-interval hint suppression                 [PRACT2-9-01]

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { RatingRow } from '../RatingRow';
import { formatReviewInterval } from '../Toast';

import type { RatingPreview } from '@/services/studyAPI';

describe('RatingRow', () => {
  it('renders 4 rating buttons', () => {
    render(<RatingRow onRate={vi.fn()} />);
    expect(screen.getByTestId('pf-rating-btn-forgot')).toBeInTheDocument();
    expect(screen.getByTestId('pf-rating-btn-tough')).toBeInTheDocument();
    expect(screen.getByTestId('pf-rating-btn-ok')).toBeInTheDocument();
    expect(screen.getByTestId('pf-rating-btn-easy')).toBeInTheDocument();
  });

  it('calls onRate(1) when Forgot is clicked', () => {
    const onRate = vi.fn();
    render(<RatingRow onRate={onRate} isFlipped={true} />);
    fireEvent.click(screen.getByTestId('pf-rating-btn-forgot'));
    expect(onRate).toHaveBeenCalledWith(1);
  });

  it('calls onRate(2) when Tough is clicked', () => {
    const onRate = vi.fn();
    render(<RatingRow onRate={onRate} isFlipped={true} />);
    fireEvent.click(screen.getByTestId('pf-rating-btn-tough'));
    expect(onRate).toHaveBeenCalledWith(2);
  });

  it('calls onRate(3) when OK is clicked', () => {
    const onRate = vi.fn();
    render(<RatingRow onRate={onRate} isFlipped={true} />);
    fireEvent.click(screen.getByTestId('pf-rating-btn-ok'));
    expect(onRate).toHaveBeenCalledWith(3);
  });

  it('calls onRate(4) when Easy is clicked', () => {
    const onRate = vi.fn();
    render(<RatingRow onRate={onRate} isFlipped={true} />);
    fireEvent.click(screen.getByTestId('pf-rating-btn-easy'));
    expect(onRate).toHaveBeenCalledWith(4);
  });

  it('disables all buttons when isFlipped=false', () => {
    render(<RatingRow onRate={vi.fn()} isFlipped={false} />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });

  it('enables all buttons when isFlipped=true', () => {
    render(<RatingRow onRate={vi.fn()} isFlipped={true} />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn).not.toBeDisabled();
    }
  });

  it('has data-tone attributes matching each rating', () => {
    render(<RatingRow onRate={vi.fn()} isFlipped={true} />);
    expect(screen.getByTestId('pf-rating-btn-forgot').getAttribute('data-tone')).toBe('forgot');
    expect(screen.getByTestId('pf-rating-btn-tough').getAttribute('data-tone')).toBe('tough');
    expect(screen.getByTestId('pf-rating-btn-ok').getAttribute('data-tone')).toBe('ok');
    expect(screen.getByTestId('pf-rating-btn-easy').getAttribute('data-tone')).toBe('easy');
  });
});

// ── PRACT2-3-06: Rating previews (interval hints) ────────────────────────────

/** Build a RatingPreview for the given rating with the specified interval. */
function makePreview(rating: 1 | 2 | 3 | 4, interval: number): RatingPreview {
  const qualityMap: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5 };
  return {
    rating,
    quality: qualityMap[rating],
    interval,
    next_review_date: '2026-06-05',
    new_status: 'learning',
  };
}

describe('RatingRow — interval hints (PRACT2-3-06)', () => {
  const toneMap: Record<number, string> = { 1: 'forgot', 2: 'tough', 3: 'ok', 4: 'easy' };

  // ── AC-1: suppresses all hints when all four formatted intervals are identical
  // [PRACT2-9-01] RED: current component renders hints regardless of identity;
  // after implementation it must suppress them when allHintsIdentical=true.
  it('suppresses all hints when all four formatted intervals are identical', () => {
    // All four previews have interval=1 → formatReviewInterval(1) = "1 day" for all
    const previews: RatingPreview[] = [1, 2, 3, 4].map((r) => makePreview(r as 1 | 2 | 3 | 4, 1));

    const { container } = render(
      <RatingRow onRate={vi.fn()} isFlipped={true} previews={previews} />
    );

    // After implementation: zero hints when all four format identically
    expect(container.querySelectorAll('.pf-rating-btn__hint')).toHaveLength(0);
  });

  // ── AC-1: treats intervals that format to the same string as identical
  // [PRACT2-9-01] RED: 30 days → "1 month", 31 days → "1 month" (Math.round(30/30)=1,
  // Math.round(31/30)=1), so all four format-collide → suppression must trigger.
  it('treats intervals that format to the same string as identical (format-collision)', () => {
    // Intervals 30, 31, 30, 31 all produce "1 month" via formatReviewInterval
    const intervalsByRating: Record<1 | 2 | 3 | 4, number> = { 1: 30, 2: 31, 3: 30, 4: 31 };
    const previews: RatingPreview[] = [1, 2, 3, 4].map((r) =>
      makePreview(r as 1 | 2 | 3 | 4, intervalsByRating[r as 1 | 2 | 3 | 4])
    );

    // Verify the formatter actually produces the same string for all four
    // (documents the invariant so a future formatter change doesn't silently break this test)
    const formatted = [30, 31, 30, 31].map(formatReviewInterval);
    expect(new Set(formatted).size).toBe(1); // must all be the same string

    const { container } = render(
      <RatingRow onRate={vi.fn()} isFlipped={true} previews={previews} />
    );

    // All four format to the same string → hints must be suppressed
    expect(container.querySelectorAll('.pf-rating-btn__hint')).toHaveLength(0);
  });

  // ── AC-2: shows hints when only one rating differs after formatting
  // [PRACT2-9-01] RED: intervals 1,1,1,8 → "1 day","1 day","1 day","1 week"
  // (not all identical) → all four hints must render.
  it('shows all four hints when only one rating differs after formatting', () => {
    // rating=4 has interval=8 → formatReviewInterval(8) = "1 week" (7≤8<14 → count=1)
    // ratings 1,2,3 have interval=1 → "1 day" — not all identical → show hints
    const intervalsByRating: Record<1 | 2 | 3 | 4, number> = { 1: 1, 2: 1, 3: 1, 4: 8 };
    const previews: RatingPreview[] = [1, 2, 3, 4].map((r) =>
      makePreview(r as 1 | 2 | 3 | 4, intervalsByRating[r as 1 | 2 | 3 | 4])
    );

    const { container } = render(
      <RatingRow onRate={vi.fn()} isFlipped={true} previews={previews} />
    );

    // Not all identical → all four hints must render
    expect(container.querySelectorAll('.pf-rating-btn__hint')).toHaveLength(4);
  });

  // ── AC-2 (edge): incomplete previews render available hints, not suppressed
  // [PRACT2-9-01] RED: when fewer than 4 previews are provided (here: only ratings
  // 1 and 2), the suppression logic must NOT fire even if those two happen to be
  // identical. Exactly 2 hints should render for the 2 buttons that have previews.
  it('renders available hints without suppression when previews are incomplete (<4)', () => {
    // Only ratings 1 and 2 provided, both interval=1 → "1 day"
    // Incomplete set → suppression must not trigger → 2 hints rendered
    const previews: RatingPreview[] = [makePreview(1, 1), makePreview(2, 1)];

    const { container } = render(
      <RatingRow onRate={vi.fn()} isFlipped={true} previews={previews} />
    );

    expect(container.querySelectorAll('.pf-rating-btn__hint')).toHaveLength(2);
  });

  // ── AC-2 / AC-3 (regression-guard): renders all four hints AND keeps structure
  // when intervals diverge. EXTENDS the original PRACT2-3-06 divergent test with
  // structural assertions. This test stays GREEN both before and after implementation.
  it('renders correct interval text per rating using formatReviewInterval', () => {
    // Use varied intervals to assert each matches the formatter output
    const intervalsByRating: Record<1 | 2 | 3 | 4, number> = { 1: 1, 2: 1, 3: 6, 4: 15 };
    const previews: RatingPreview[] = [1, 2, 3, 4].map((r) =>
      makePreview(r as 1 | 2 | 3 | 4, intervalsByRating[r as 1 | 2 | 3 | 4])
    );

    render(<RatingRow onRate={vi.fn()} isFlipped={true} previews={previews} />);

    // rating=1 → interval=1 → "1 day"
    const forgotBtn = screen.getByTestId('pf-rating-btn-forgot');
    expect(forgotBtn.querySelector('.pf-rating-btn__hint')?.textContent).toBe(
      formatReviewInterval(1)
    );

    // rating=3 → interval=6 → "6 days"
    const okBtn = screen.getByTestId('pf-rating-btn-ok');
    expect(okBtn.querySelector('.pf-rating-btn__hint')?.textContent).toBe(formatReviewInterval(6));

    // rating=4 → interval=15 → "2 weeks"
    const easyBtn = screen.getByTestId('pf-rating-btn-easy');
    expect(easyBtn.querySelector('.pf-rating-btn__hint')?.textContent).toBe(
      formatReviewInterval(15)
    );

    // AC-3 structural coverage: each button still has bar, keycap, and label
    for (const rating of [1, 2, 3, 4] as const) {
      const btn = screen.getByTestId(`pf-rating-btn-${toneMap[rating]}`);
      expect(btn.querySelector('.pf-rating-btn__bar')).not.toBeNull();
      expect(btn.querySelector('.pf-rating-btn__key')).not.toBeNull();
      expect(btn.querySelector('.pf-rating-btn__label')).not.toBeNull();
    }
  });

  // ── AC-3: tone bar, keycap, and label remain in suppressed state
  // [PRACT2-9-01] RED: with identical intervals, hints are suppressed, but
  // bar/key/label and data-tone must still render correctly on all four buttons.
  it('keeps tone bar, keycap, and label on every button when hints are suppressed', () => {
    // All identical → hints suppressed, but structural elements must survive
    const previews: RatingPreview[] = [1, 2, 3, 4].map((r) => makePreview(r as 1 | 2 | 3 | 4, 1));

    render(<RatingRow onRate={vi.fn()} isFlipped={true} previews={previews} />);

    const expectedTones = ['forgot', 'tough', 'ok', 'easy'] as const;
    for (const tone of expectedTones) {
      const btn = screen.getByTestId(`pf-rating-btn-${tone}`);
      expect(btn.querySelector('.pf-rating-btn__bar')).not.toBeNull();
      expect(btn.querySelector('.pf-rating-btn__key')).not.toBeNull();
      expect(btn.querySelector('.pf-rating-btn__label')).not.toBeNull();
      expect(btn.getAttribute('data-tone')).toBe(tone);
    }
  });

  it('renders no .pf-rating-btn__hint when previews prop is omitted', () => {
    render(<RatingRow onRate={vi.fn()} isFlipped={true} />);
    const hints = document.querySelectorAll('.pf-rating-btn__hint');
    expect(hints).toHaveLength(0);
  });

  it('renders no .pf-rating-btn__hint when previews is an empty array', () => {
    render(<RatingRow onRate={vi.fn()} isFlipped={true} previews={[]} />);
    const hints = document.querySelectorAll('.pf-rating-btn__hint');
    expect(hints).toHaveLength(0);
  });
});
