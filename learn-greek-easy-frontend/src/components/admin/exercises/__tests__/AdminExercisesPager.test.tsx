/**
 * AdminExercisesPager unit tests (TBR2-25-08)
 *
 * Covers:
 * - "Showing X–Y of Z" text via i18n
 * - Previous button disabled on first page
 * - Next button disabled on last page
 * - Click handlers call setPage with correct value
 * - Page counter renders correct i18n text
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { AdminExercisesPager } from '../AdminExercisesPager';

function renderPager(overrides: {
  page?: number;
  totalPages?: number;
  showingFrom?: number;
  showingTo?: number;
  total?: number;
  setPage?: (p: number) => void;
}) {
  const defaults = {
    page: 1,
    totalPages: 14,
    showingFrom: 1,
    showingTo: 20,
    total: 262,
    setPage: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<AdminExercisesPager {...props} />), setPage: props.setPage };
}

describe('AdminExercisesPager — showing text', () => {
  it('renders Showing X–Y of Z from i18n', () => {
    renderPager({ showingFrom: 1, showingTo: 20, total: 262 });
    expect(screen.getByText('Showing 1–20 of 262')).toBeTruthy();
  });
});

describe('AdminExercisesPager — previous button', () => {
  it('is disabled when page === 1', () => {
    renderPager({ page: 1 });
    const btn = screen.getByText('‹ Previous').closest('button');
    expect(btn).toBeTruthy();
    expect(btn!.disabled).toBe(true);
    expect(btn!.getAttribute('aria-disabled')).toBe('true');
    expect(btn!.tabIndex).toBe(-1);
  });

  it('is enabled when page > 1', () => {
    renderPager({ page: 2 });
    const btn = screen.getByText('‹ Previous').closest('button');
    expect(btn!.disabled).toBe(false);
    expect(btn!.getAttribute('aria-disabled')).toBe('false');
    expect(btn!.tabIndex).toBe(0);
  });

  it('calls setPage(page - 1) when clicked', () => {
    const setPage = vi.fn();
    renderPager({ page: 3, setPage });
    fireEvent.click(screen.getByText('‹ Previous'));
    expect(setPage).toHaveBeenCalledWith(2);
  });
});

describe('AdminExercisesPager — next button', () => {
  it('is disabled when page >= totalPages', () => {
    renderPager({ page: 14, totalPages: 14 });
    const btn = screen.getByText('Next ›').closest('button');
    expect(btn!.disabled).toBe(true);
    expect(btn!.getAttribute('aria-disabled')).toBe('true');
    expect(btn!.tabIndex).toBe(-1);
  });

  it('is enabled when page < totalPages', () => {
    renderPager({ page: 1, totalPages: 14 });
    const btn = screen.getByText('Next ›').closest('button');
    expect(btn!.disabled).toBe(false);
    expect(btn!.getAttribute('aria-disabled')).toBe('false');
    expect(btn!.tabIndex).toBe(0);
  });

  it('calls setPage(page + 1) when clicked', () => {
    const setPage = vi.fn();
    renderPager({ page: 2, totalPages: 14, setPage });
    fireEvent.click(screen.getByText('Next ›'));
    expect(setPage).toHaveBeenCalledWith(3);
  });
});

describe('AdminExercisesPager — page counter', () => {
  it('renders page counter with correct i18n text', () => {
    renderPager({ page: 3, totalPages: 14 });
    expect(screen.getByText('Page 3 of 14')).toBeTruthy();
  });
});
