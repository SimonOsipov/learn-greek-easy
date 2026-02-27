import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { CategoryBreakdown } from '../CategoryBreakdown';
import type { CategoryReadiness } from '@/services/cultureDeckAPI';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => ({ track: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCategory = (
  category: string,
  pct: number,
  mastered = 10,
  total = 20,
  deckIds = ['deck-1'],
  accuracy: number | null = null,
  needs = false
): CategoryReadiness => ({
  category: category as CategoryReadiness['category'],
  readiness_percentage: pct,
  questions_mastered: mastered,
  questions_total: total,
  deck_ids: deckIds,
  accuracy_percentage: accuracy,
  needs_reinforcement: needs,
});

const renderComponent = (props: { categories: CategoryReadiness[]; isLoading?: boolean }) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <CategoryBreakdown categories={props.categories} isLoading={props.isLoading ?? false} />
      </MemoryRouter>
    </I18nextProvider>
  );

// ---------------------------------------------------------------------------
// Base tests (8)
// ---------------------------------------------------------------------------

describe('CategoryBreakdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a row for each category in the list', () => {
    const categories = [
      makeCategory('history', 60),
      makeCategory('geography', 40),
      makeCategory('politics', 80),
      makeCategory('culture', 20),
    ];
    renderComponent({ categories });
    expect(screen.getByTestId('category-row-history')).toBeInTheDocument();
    expect(screen.getByTestId('category-row-geography')).toBeInTheDocument();
    expect(screen.getByTestId('category-row-politics')).toBeInTheDocument();
    expect(screen.getByTestId('category-row-culture')).toBeInTheDocument();
  });

  it('applies correct progress bar color classes based on readiness percentage', () => {
    const categories = [
      makeCategory('history', 90), // >= 85 → emerald
      makeCategory('geography', 65), // >= 60 → green
      makeCategory('politics', 45), // >= 40 → orange
      makeCategory('culture', 20), // < 40 → red
    ];
    const { container } = renderComponent({ categories });
    expect(container.querySelector('.bg-emerald-500')).not.toBeNull();
    expect(container.querySelector('.bg-green-500')).not.toBeNull();
    expect(container.querySelector('.bg-orange-500')).not.toBeNull();
    expect(container.querySelector('.bg-red-500')).not.toBeNull();
  });

  it('preserves the order of categories as provided', () => {
    const categories = [
      makeCategory('culture', 30),
      makeCategory('history', 70),
      makeCategory('geography', 50),
    ];
    const { container } = renderComponent({ categories });
    const rows = container.querySelectorAll('[data-testid^="category-row-"]');
    expect(rows[0].getAttribute('data-testid')).toBe('category-row-culture');
    expect(rows[1].getAttribute('data-testid')).toBe('category-row-history');
    expect(rows[2].getAttribute('data-testid')).toBe('category-row-geography');
  });

  it('navigates to the first deck_id when a category row is clicked', async () => {
    const categories = [makeCategory('history', 60, 10, 20, ['deck-abc'])];
    renderComponent({ categories });
    await userEvent.click(screen.getByTestId('category-row-history'));
    expect(mockNavigate).toHaveBeenCalledWith('/culture/decks/deck-abc');
  });

  it('shows loading skeletons when isLoading is true', () => {
    const { container } = renderComponent({ categories: [], isLoading: true });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders zero percentage rows correctly (0% readiness)', () => {
    const categories = [makeCategory('politics', 0, 0, 20)];
    renderComponent({ categories });
    const row = screen.getByTestId('category-row-politics');
    expect(row).toBeInTheDocument();
    expect(row.textContent).toContain('0');
  });

  it('progressbar elements have correct ARIA attributes', () => {
    const categories = [makeCategory('history', 65)];
    renderComponent({ categories });
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '65');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders nothing for category rows when categories array is empty', () => {
    const { container } = renderComponent({ categories: [] });
    const rows = container.querySelectorAll('[data-testid^="category-row-"]');
    expect(rows.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Accuracy feature tests (10)
  // ---------------------------------------------------------------------------

  describe('accuracy features', () => {
    it('renders "Accuracy: 65%" when accuracy_percentage is 65', () => {
      const categories = [makeCategory('history', 60, 10, 20, ['deck-1'], 65)];
      renderComponent({ categories });
      expect(screen.getByText('Accuracy: 65%')).toBeInTheDocument();
    });

    it('renders "Accuracy: No attempts yet" when accuracy_percentage is null', () => {
      const categories = [makeCategory('history', 60, 10, 20, ['deck-1'], null)];
      renderComponent({ categories });
      expect(screen.getByText('Accuracy: No attempts yet')).toBeInTheDocument();
    });

    it('shows "Needs Review" badge when needs_reinforcement is true', () => {
      const categories = [makeCategory('history', 80, 16, 20, ['deck-1'], 45, true)];
      renderComponent({ categories });
      expect(screen.getByText('Needs Review')).toBeInTheDocument();
    });

    it('does not show "Needs Review" badge when needs_reinforcement is false', () => {
      const categories = [makeCategory('history', 80, 16, 20, ['deck-1'], 75, false)];
      renderComponent({ categories });
      expect(screen.queryByText('Needs Review')).not.toBeInTheDocument();
    });

    it('applies green color class for accuracy >= 70', () => {
      const categories = [makeCategory('history', 60, 10, 20, ['deck-1'], 75)];
      const { container } = renderComponent({ categories });
      const accuracyEl = container.querySelector('.text-green-600');
      expect(accuracyEl).not.toBeNull();
    });

    it('applies orange color class for accuracy between 50 and 69', () => {
      const categories = [makeCategory('history', 60, 10, 20, ['deck-1'], 55)];
      const { container } = renderComponent({ categories });
      const accuracyEl = container.querySelector('.text-orange-500');
      expect(accuracyEl).not.toBeNull();
    });

    it('applies red color class for accuracy below 50', () => {
      const categories = [makeCategory('history', 60, 10, 20, ['deck-1'], 30)];
      const { container } = renderComponent({ categories });
      const accuracyEl = container.querySelector('.text-red-500');
      expect(accuracyEl).not.toBeNull();
    });

    it('applies muted color class when accuracy is null', () => {
      const categories = [makeCategory('history', 60, 10, 20, ['deck-1'], null)];
      const { container } = renderComponent({ categories });
      const accuracyEl = container.querySelector('.text-muted-foreground');
      expect(accuracyEl).not.toBeNull();
    });

    it('badge has tooltip aria-label for screen readers', () => {
      const categories = [makeCategory('history', 85, 17, 20, ['deck-1'], 40, true)];
      const { container } = renderComponent({ categories });
      // The badge span has an aria-label attribute
      const badge = container.querySelector('[aria-label]');
      expect(badge).not.toBeNull();
      expect(badge?.getAttribute('aria-label')).toContain('High mastery');
    });

    it('handles multiple categories with mixed accuracy values', () => {
      const categories = [
        makeCategory('history', 80, 16, 20, ['deck-1'], 75, false),
        makeCategory('geography', 50, 10, 20, ['deck-2'], 45, true),
        makeCategory('politics', 30, 6, 20, ['deck-3'], null, false),
      ];
      renderComponent({ categories });
      expect(screen.getByText('Accuracy: 75%')).toBeInTheDocument();
      expect(screen.getByText('Accuracy: 45%')).toBeInTheDocument();
      expect(screen.getByText('Accuracy: No attempts yet')).toBeInTheDocument();
      expect(screen.getByText('Needs Review')).toBeInTheDocument();
    });
  });
});
