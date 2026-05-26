// src/components/admin/__tests__/AdminCardErrorSection.test.tsx
//
// Vitest + RTL tests for AdminCardErrorSection.
// Covers: smoke render + .news-seg-l regression (TBR2-25-14).

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { AdminCardErrorSection } from '../AdminCardErrorSection';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

vi.mock('@/stores/adminCardErrorStore', () => ({
  useAdminCardErrorStore: vi.fn((selector) => {
    const state = {
      errorList: [],
      selectedError: null,
      page: 1,
      total: 0,
      totalPages: 1,
      filters: { status: null, cardType: null },
      isLoading: false,
      error: null,
      fetchErrorList: vi.fn(),
      setFilters: vi.fn(),
      clearFilters: vi.fn(),
      setPage: vi.fn(),
      setSelectedError: vi.fn(),
      updateError: vi.fn(),
      deleteError: vi.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

// Mock child components to avoid pulling in their dependency trees
vi.mock('../AdminCardErrorCard', () => ({
  AdminCardErrorCard: () => null,
}));

vi.mock('../CardErrorDrawer', () => ({
  CardErrorDrawer: () => null,
}));

// ── Render helper ──────────────────────────────────────────────────────────────

function renderSection() {
  return render(
    <MemoryRouter>
      <AdminCardErrorSection />
    </MemoryRouter>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AdminCardErrorSection', () => {
  it('renders without crashing', () => {
    const { container } = renderSection();
    expect(container.querySelector('[data-testid="admin-card-error-section"]')).toBeInTheDocument();
  });

  it('toolbar does not render visible SegControl group labels', () => {
    const { container } = renderSection();
    expect(container.querySelectorAll('.news-seg-l')).toHaveLength(0);
  });
});
