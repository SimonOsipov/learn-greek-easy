/**
 * DashboardView Component Tests (DASH-05)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ContentStatsResponse } from '@/services/adminAPI';

import DashboardView from '../DashboardView';

const fullStats: ContentStatsResponse = {
  total_decks: 7,
  total_cards: 134,
  total_vocabulary_decks: 5,
  total_vocabulary_cards: 100,
  total_culture_decks: 2,
  total_culture_questions: 34,
};

describe('DashboardView', () => {
  it('renders without throwing when stats is null', () => {
    expect(() => render(<DashboardView stats={null} setActiveTab={vi.fn()} />)).not.toThrow();
  });

  it('renders all 4 stat-card titles', () => {
    render(<DashboardView stats={null} setActiveTab={vi.fn()} />);
    expect(screen.getByText('Decks')).toBeTruthy();
    expect(screen.getByText('News')).toBeTruthy();
    expect(screen.getByText('Situations')).toBeTruthy();
    expect(screen.getByText('Exercises')).toBeTruthy();
  });

  it('displays "—" as the big number on all 4 cards when stats is null', () => {
    const { container } = render(<DashboardView stats={null} setActiveTab={vi.fn()} />);
    const statNs = container.querySelectorAll('.stat-n');
    expect(statNs).toHaveLength(4);
    statNs.forEach((el) => {
      expect(el.textContent).toBe('—');
    });
  });

  it('binds Decks card to stats; other 3 cards stay "—"', () => {
    const { container } = render(<DashboardView stats={fullStats} setActiveTab={vi.fn()} />);
    const decksCard = screen.getByText('Decks').closest('.stat-card');
    expect(decksCard).toBeTruthy();
    expect(decksCard!.querySelector('.stat-n')!.textContent).toBe('7');
    expect(decksCard!.querySelector('.stat-sub')!.textContent).toBe('134 cards');

    const allBigNumbers = Array.from(container.querySelectorAll('.stat-n')).map(
      (el) => el.textContent
    );
    expect(allBigNumbers).toEqual(['7', '—', '—', '—']);
  });

  it('clicks on each StatCard call setActiveTab with the right tab key', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<DashboardView stats={null} setActiveTab={setActiveTab} />);

    await user.click(screen.getByText('Decks').closest('.stat-card')!);
    expect(setActiveTab).toHaveBeenLastCalledWith('decks');

    await user.click(screen.getByText('News').closest('.stat-card')!);
    expect(setActiveTab).toHaveBeenLastCalledWith('news');

    await user.click(screen.getByText('Situations').closest('.stat-card')!);
    expect(setActiveTab).toHaveBeenLastCalledWith('situations');

    await user.click(screen.getByText('Exercises').closest('.stat-card')!);
    expect(setActiveTab).toHaveBeenLastCalledWith('exercises');

    expect(setActiveTab).toHaveBeenCalledTimes(4);
  });

  it('exposes role="button" and tabIndex=0 on every StatCard', () => {
    const { container } = render(<DashboardView stats={null} setActiveTab={vi.fn()} />);
    const cards = container.querySelectorAll('.stat-card');
    expect(cards).toHaveLength(4);
    cards.forEach((card) => {
      expect(card.getAttribute('role')).toBe('button');
      expect(card.getAttribute('tabindex')).toBe('0');
    });
  });

  it('renders all three empty-state card headings', () => {
    render(<DashboardView stats={null} setActiveTab={vi.fn()} />);
    expect(screen.getByText("Today's inbox")).toBeTruthy();
    expect(screen.getByText('Recent activity')).toBeTruthy();
    expect(screen.getByText('Content pipeline')).toBeTruthy();
  });

  it('View all → button routes to inbox tab', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<DashboardView stats={null} setActiveTab={setActiveTab} />);

    const viewAll = screen.getByRole('button', { name: /View all/i });
    await user.click(viewAll);

    expect(setActiveTab).toHaveBeenCalledTimes(1);
    expect(setActiveTab).toHaveBeenCalledWith('inbox');
  });
});
