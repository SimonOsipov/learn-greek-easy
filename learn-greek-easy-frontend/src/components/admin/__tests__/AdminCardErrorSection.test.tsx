// src/components/admin/__tests__/AdminCardErrorSection.test.tsx
//
// Vitest + RTL tests for AdminCardErrorSection.
// Covers: smoke render + .news-seg-l regression (TBR2-25-14)
//       + ADMIN2-34-04: section hard-delete wiring (ConfirmDialog → deleteError).

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import * as adminCardErrorStoreModule from '@/stores/adminCardErrorStore';
import { AdminCardErrorSection } from '../AdminCardErrorSection';
import type { AdminCardErrorResponse } from '@/types/cardError';

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

// Store mock — useAdminCardErrorStore is a vi.fn() so tests can override the
// returned state via mockImplementation per describe block.
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

// AdminCardErrorCard mock — captures the onDelete prop so section delete tests
// can invoke it programmatically without needing to render the full card tree.
// lastCardProps is reset in beforeEach of the delete describe block.
let lastCardProps: {
  errorReport: AdminCardErrorResponse;
  onDelete?: (report: AdminCardErrorResponse) => void;
} | null = null;

vi.mock('../AdminCardErrorCard', () => ({
  AdminCardErrorCard: (props: {
    errorReport: AdminCardErrorResponse;
    onRespond: (report: AdminCardErrorResponse) => void;
    onDelete?: (report: AdminCardErrorResponse) => void;
  }) => {
    lastCardProps = props;
    return null;
  },
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

// ── Smoke tests ────────────────────────────────────────────────────────────────

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

// ── ADMIN2-34-04: Section hard-delete wiring ───────────────────────────────────
//
// These tests drive deleteError via the ConfirmDialog that the section owns.
// Because AdminCardErrorCard is mocked to null (to avoid its full dep tree),
// we simulate the trash click by calling the captured onDelete prop directly.

const REPORT_ID = 'abcdef12-3456-7890-abcd-ef1234567890';

const sampleReport: AdminCardErrorResponse = {
  id: REPORT_ID,
  card_id: 'card-uuid-001',
  card_type: 'WORD',
  user_id: 'user-uuid-001',
  description: 'Something looks wrong here.',
  status: 'PENDING',
  admin_notes: null,
  resolved_by: null,
  resolved_at: null,
  reporter: { id: 'user-uuid-001', full_name: 'Maria Papadopoulos' },
  resolver: null,
  card: {
    word: 'αδερφή',
    article: 'η',
    translation_en: 'sister',
    translation_ru: 'сестра',
    plural: 'αδερφές',
    ipa: '/aˈðeɾfi/',
    gender: 'f',
  },
  deck: { id: 'deck-001', name: 'A1 Basics' },
  created_at: '2026-05-20T10:00:00Z',
  updated_at: '2026-05-20T10:00:00Z',
};

const mockDeleteError = vi.fn().mockResolvedValue(undefined);

describe('AdminCardErrorSection — delete ConfirmDialog (ADMIN2-34-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastCardProps = null;

    // Override the store to return one real errorReport so AdminCardErrorCard
    // renders (even as null) and captures its onDelete prop.
    vi.mocked(adminCardErrorStoreModule.useAdminCardErrorStore).mockImplementation((selector) => {
      const state = {
        errorList: [sampleReport],
        selectedError: null,
        page: 1,
        total: 1,
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
        deleteError: mockDeleteError,
      };
      return typeof selector === 'function' ? selector(state) : state;
    });
  });

  // section_confirm_delete_calls_deleteError
  it('section_confirm_delete_calls_deleteError', async () => {
    const user = userEvent.setup();
    renderSection();

    // Simulate trash button click via the captured onDelete prop
    expect(lastCardProps).not.toBeNull();
    expect(lastCardProps!.onDelete).toBeDefined();
    lastCardProps!.onDelete!(sampleReport);

    // ConfirmDialog should now be open — confirm it
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(mockDeleteError).toHaveBeenCalledWith(REPORT_ID);
    });
  });

  // section_cancel_delete_noops
  it('section_cancel_delete_noops', async () => {
    const user = userEvent.setup();
    renderSection();

    // Trigger the delete confirm dialog via captured onDelete
    expect(lastCardProps).not.toBeNull();
    lastCardProps!.onDelete!(sampleReport);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
    });
    expect(mockDeleteError).not.toHaveBeenCalled();
  });
});
