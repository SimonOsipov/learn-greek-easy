import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { WeakAreaCTA } from '../WeakAreaCTA';
import type { CategoryReadiness } from '@/services/cultureDeckAPI';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockTrack = vi.fn();
vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCategory = (
  category: string,
  pct: number,
  mastered = 10,
  total = 20,
  deckIds = ['deck-1']
): CategoryReadiness => ({
  category: category as CategoryReadiness['category'],
  readiness_percentage: pct,
  questions_mastered: mastered,
  questions_total: total,
  deck_ids: deckIds,
  accuracy_percentage: null,
  needs_reinforcement: false,
});

const renderComponent = (props: { categories: CategoryReadiness[]; isLoading?: boolean }) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <WeakAreaCTA categories={props.categories} isLoading={props.isLoading ?? false} />
      </MemoryRouter>
    </I18nextProvider>
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WeakAreaCTA', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a button with the correct practice label including category and percentage', () => {
    const categories = [makeCategory('history', 40), makeCategory('geography', 80)];
    renderComponent({ categories });
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('History');
    expect(button.textContent).toContain('40');
  });

  it('uses the translated category name in the button label', () => {
    const categories = [makeCategory('geography', 35)];
    renderComponent({ categories });
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('Geography');
  });

  it('navigates to the culture practice route when clicked', async () => {
    const categories = [makeCategory('politics', 25, 5, 20, ['deck-xyz'])];
    renderComponent({ categories });
    await userEvent.click(screen.getByRole('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/culture/deck-xyz/practice');
  });

  it('fires the PostHog tracking event on click', async () => {
    const categories = [makeCategory('history', 30, 6, 20, ['deck-abc'])];
    renderComponent({ categories });
    await userEvent.click(screen.getByRole('button'));
    expect(mockTrack).toHaveBeenCalledWith(
      'culture_weak_area_cta_clicked',
      expect.objectContaining({ target_category: 'history' })
    );
  });

  it('shows loading skeleton when isLoading is true', () => {
    const categories = [makeCategory('history', 30)];
    const { container } = renderComponent({ categories, isLoading: true });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render when categories array is empty', () => {
    const { container } = renderComponent({ categories: [] });
    expect(container.firstChild).toBeNull();
  });

  it('rounds the readiness percentage in the button label', () => {
    const categories = [makeCategory('culture', 33.7)];
    renderComponent({ categories });
    const button = screen.getByRole('button');
    // Math.round(33.7) = 34
    expect(button.textContent).toContain('34');
  });

  it('renders the button as disabled when deck_ids is empty', () => {
    const categories = [makeCategory('history', 25, 5, 20, [])];
    renderComponent({ categories });
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('re-renders with updated category after prop change', () => {
    const initialCategories = [makeCategory('history', 30)];
    const { rerender } = renderComponent({ categories: initialCategories });
    expect(screen.getByRole('button').textContent).toContain('History');

    const updatedCategories = [makeCategory('geography', 15)];
    rerender(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <WeakAreaCTA categories={updatedCategories} isLoading={false} />
        </MemoryRouter>
      </I18nextProvider>
    );
    expect(screen.getByRole('button').textContent).toContain('Geography');
  });
});
