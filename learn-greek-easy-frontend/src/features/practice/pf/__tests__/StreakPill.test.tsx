/**
 * pf/StreakPill.tsx — unit tests (PRACT2-1-02)
 *
 * Covers:
 * - Renders streak count when showStreak is true
 * - Hidden (renders null) when showStreak is false
 * - Has role="status" for accessibility
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { StreakPill } from '../StreakPill';

describe('StreakPill', () => {
  it('renders streak count when showStreak is true', () => {
    const { container } = render(<StreakPill streak={7} showStreak={true} />);
    expect(container.querySelector('.pf-streak')).not.toBeNull();
    expect(screen.getByText('7', { exact: false })).not.toBeNull();
  });

  it('renders nothing when showStreak is false', () => {
    const { container } = render(<StreakPill streak={7} showStreak={false} />);
    expect(container.querySelector('.pf-streak')).toBeNull();
  });

  it('has role="status" for accessibility', () => {
    render(<StreakPill streak={3} showStreak={true} />);
    expect(screen.getByRole('status')).not.toBeNull();
  });

  it('shows streak count 0', () => {
    const { container } = render(<StreakPill streak={0} showStreak={true} />);
    expect(container.querySelector('.pf-streak')).not.toBeNull();
  });

  it('shows updated streak count', () => {
    const { rerender } = render(<StreakPill streak={2} showStreak={true} />);
    expect(screen.getByText('2', { exact: false })).not.toBeNull();
    rerender(<StreakPill streak={3} showStreak={true} />);
    expect(screen.getByText('3', { exact: false })).not.toBeNull();
  });
});
