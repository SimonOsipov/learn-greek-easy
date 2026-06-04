// src/features/practice/pf/__tests__/RatingRow.test.tsx
//
// Tests for RatingRow.tsx:
//   - 4 buttons rendered (Forgot/Tough/OK/Easy)           [PRACT2-1-07]
//   - Click fires onRate(1|2|3|4)                         [PRACT2-1-07]
//   - Buttons disabled when isFlipped=false               [PRACT2-1-07]
//   - Interval hints rendered per rating when previews provided [PRACT2-3-06]
//   - Graceful absence: no hint when previews omitted         [PRACT2-3-06]

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

  it('renders .pf-rating-btn__hint with formatReviewInterval text for each button when previews provided', () => {
    const intervals = { 1: 1, 2: 1, 3: 1, 4: 1 };
    const previews: RatingPreview[] = [1, 2, 3, 4].map((r) =>
      makePreview(r as 1 | 2 | 3 | 4, intervals[r as 1 | 2 | 3 | 4])
    );

    render(<RatingRow onRate={vi.fn()} isFlipped={true} previews={previews} />);

    for (const rating of [1, 2, 3, 4] as const) {
      const btn = screen.getByTestId(`pf-rating-btn-${toneMap[rating]}`);
      const hint = btn.querySelector('.pf-rating-btn__hint');
      expect(hint).not.toBeNull();
      expect(hint?.textContent).toBe(formatReviewInterval(intervals[rating]));
    }
  });

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
