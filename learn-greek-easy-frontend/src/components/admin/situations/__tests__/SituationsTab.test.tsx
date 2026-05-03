import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n';
import { useAdminSituationStore } from '@/stores/adminSituationStore';
import type { SituationListItem } from '@/types/situation';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ currentLanguage: 'en' }),
}));

import { SituationsTab } from '../SituationsTab';

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

const initialState = useAdminSituationStore.getState();

const baseItem = (overrides: Partial<SituationListItem>): SituationListItem => ({
  id: '11111111-1111-1111-1111-111111111111',
  scenario_el: 'Σενάριο',
  scenario_en: 'Scenario',
  scenario_ru: 'Сценарий',
  status: 'draft',
  created_at: '2025-01-01T00:00:00Z',
  has_dialog: false,
  has_description: true,
  has_picture: false,
  has_dialog_audio: false,
  has_description_audio: false,
  description_timestamps_count: 0,
  dialog_exercises_count: 0,
  description_exercises_count: 0,
  picture_exercises_count: 0,
  ...overrides,
});

const seedStore = (items: SituationListItem[]) => {
  useAdminSituationStore.setState({
    ...initialState,
    situations: items,
    total: items.length,
    totalPages: 1,
    isLoading: false,
    error: null,
    fetchSituations: vi.fn().mockResolvedValue(undefined),
    setPage: vi.fn(),
    setStatusFilter: vi.fn(),
    setSearchQuery: vi.fn(),
  });
};

afterEach(() => {
  cleanup();
  useAdminSituationStore.setState(initialState, true);
});

describe('SituationsTab — exercise count badges', () => {
  it('renders 0 description-only counts (Fidias-shape: 0/4/0)', () => {
    const id = '22222222-2222-2222-2222-222222222222';
    seedStore([
      baseItem({
        id,
        dialog_exercises_count: 0,
        description_exercises_count: 4,
        picture_exercises_count: 0,
      }),
    ]);

    render(<SituationsTab />, { wrapper });

    const dialogBadge = screen.getByTestId(`situation-dialog-ex-badge-${id}`);
    const descBadge = screen.getByTestId(`situation-desc-ex-badge-${id}`);
    const picBadge = screen.getByTestId(`situation-pic-ex-badge-${id}`);

    expect(dialogBadge).toHaveTextContent('Dialog Ex 0');
    expect(dialogBadge.className).toContain('b-gray');
    expect(descBadge).toHaveTextContent('Desc Ex 4');
    expect(descBadge.className).toContain('b-green');
    expect(picBadge).toHaveTextContent('Pic Ex 0');
    expect(picBadge.className).toContain('b-gray');
  });

  it('renders all-three-sources counts (2/3/1) with green for each', () => {
    const id = '33333333-3333-3333-3333-333333333333';
    seedStore([
      baseItem({
        id,
        dialog_exercises_count: 2,
        description_exercises_count: 3,
        picture_exercises_count: 1,
      }),
    ]);

    render(<SituationsTab />, { wrapper });

    const dialogBadge = screen.getByTestId(`situation-dialog-ex-badge-${id}`);
    const descBadge = screen.getByTestId(`situation-desc-ex-badge-${id}`);
    const picBadge = screen.getByTestId(`situation-pic-ex-badge-${id}`);

    expect(dialogBadge).toHaveTextContent('Dialog Ex 2');
    expect(dialogBadge.className).toContain('b-green');
    expect(descBadge).toHaveTextContent('Desc Ex 3');
    expect(descBadge.className).toContain('b-green');
    expect(picBadge).toHaveTextContent('Pic Ex 1');
    expect(picBadge.className).toContain('b-green');
  });
});
