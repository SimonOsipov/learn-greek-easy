// src/features/practice/pf/__tests__/RatingRow.test.tsx
//
// Tests for RatingRow.tsx (PRACT2-1-07):
//   - 4 buttons rendered (Forgot/Tough/OK/Easy)
//   - Click fires onRate(1|2|3|4)
//   - Buttons disabled when isFlipped=false

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { RatingRow } from '../RatingRow';

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
