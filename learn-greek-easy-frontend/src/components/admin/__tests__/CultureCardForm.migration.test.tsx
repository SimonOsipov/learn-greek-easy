// src/components/admin/__tests__/CultureCardForm.migration.test.tsx
//
// RED tests for ADMIN2-38-05 — C13 integration contract:
//   CultureDrawerBody Add-question dialog → submit → handleCreate →
//   adminAPI.createCultureQuestion (CultureDrawerBody.tsx:114,303).
//
// C13 UNIT + AC-4e tests (which need the REAL CultureCardForm) are in:
//   CultureCardForm.migration.unit.test.tsx
//
// This file mocks both CultureCardForm (to isolate drawer wiring) and
// adminAPI (to spy on createCultureQuestion).
//
// The C13 integration test is currently GREEN (wiring already correct).
// It becomes a REGRESSION GUARD: must stay GREEN after the migration.
// If the executor breaks the onSubmit→handleCreate→API chain, it goes RED.

import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import type { UnifiedDeckItem } from '@/services/adminAPI';

// ── Module-level mocks (hoisted) ──────────────────────────────────────────────

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    listCultureQuestions: vi.fn(),
    createCultureQuestion: vi.fn(),
    deleteCultureQuestion: vi.fn(),
    updateCultureQuestion: vi.fn(),
  },
}));

vi.mock('@/components/admin/CultureCardForm', () => ({
  CultureCardForm: ({
    onSubmit,
    deckId,
    initialData,
    isSubmitting,
  }: {
    onSubmit: (data: unknown) => Promise<void>;
    deckId?: string;
    initialData?: unknown;
    isSubmitting?: boolean;
  }) => (
    <div data-testid="culture-card-form">
      <span data-testid="culture-card-form-deck-id">{deckId ?? ''}</span>
      {initialData !== undefined && (
        <span data-testid="culture-card-form-has-initial-data">has-initial-data</span>
      )}
      <span data-testid="culture-card-form-submitting">{String(isSubmitting ?? false)}</span>
      <button data-testid="culture-card-form-submit" onClick={() => onSubmit({ deck_id: deckId })}>
        Submit
      </button>
    </div>
  ),
}));

vi.mock('@/components/admin/CardDeleteDialog', () => ({
  CardDeleteDialog: () => null,
}));

// Import after vi.mock
import { adminAPI } from '@/services/adminAPI';
import { CultureDrawerBody } from '../decks/CultureDrawerBody';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDeck(overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem {
  return {
    id: 'deck-int-1',
    name: { el: 'Test', en: 'Test', ru: 'Test' },
    name_en: 'Test',
    name_ru: 'Test',
    type: 'culture',
    level: null,
    category: 'culture',
    item_count: 0,
    is_active: true,
    is_premium: false,
    is_system_deck: null,
    created_at: '2026-01-01T00:00:00Z',
    owner_id: null,
    owner_name: null,
    ...overrides,
  };
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// ── C13 integration suite ─────────────────────────────────────────────────────

describe('CultureDrawerBody + CultureCardForm — C13 integration: Add-question wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('C13 integration: Add-question dialog submit triggers handleCreate → adminAPI.createCultureQuestion', async () => {
    // This test verifies the onSubmit→handleCreate→API chain that must be
    // preserved through the AC-4c/F4.8 migration.
    //
    // CultureDrawerBody.tsx:303 passes onSubmit={handleCreate} to CultureCardForm.
    // handleCreate at :114 calls adminAPI.createCultureQuestion.
    // After migration: the in-Card Save in CultureCardForm calls onSubmit prop
    // (= handleCreate) — the chain must remain intact.
    //
    // Currently GREEN (wiring is already correct).
    // Becomes a REGRESSION GUARD: must stay GREEN after the migration.

    (adminAPI.listCultureQuestions as Mock).mockResolvedValue({
      questions: [],
      total: 0,
      page: 1,
      page_size: 20,
      deck_id: 'deck-int-1',
    });
    (adminAPI.createCultureQuestion as Mock).mockResolvedValue({ id: 'new-q' });

    const user = userEvent.setup();

    const queryClient = makeQueryClient();
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(
      <MemoryRouter initialEntries={[`/admin?edit=deck-int-1`]}>
        <Routes>
          {/* addOpen=true simulates the DeckDrawer having opened the add dialog */}
          <Route
            path="*"
            element={
              <CultureDrawerBody deck={makeDeck()} addOpen={true} onAddOpenChange={vi.fn()} />
            }
          />
        </Routes>
      </MemoryRouter>,
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(screen.getByTestId('culture-card-form')).toBeInTheDocument();
    });

    // Verify deckId is passed (no initialData in create mode)
    expect(screen.getByTestId('culture-card-form-deck-id')).toHaveTextContent('deck-int-1');
    expect(screen.queryByTestId('culture-card-form-has-initial-data')).not.toBeInTheDocument();

    // Trigger onSubmit via mock submit button
    const formContainer = screen.getByTestId('culture-card-form');
    await user.click(within(formContainer).getByTestId('culture-card-form-submit'));

    await waitFor(() => {
      expect(adminAPI.createCultureQuestion).toHaveBeenCalledTimes(1);
      expect(adminAPI.createCultureQuestion).toHaveBeenCalledWith(
        expect.objectContaining({ deck_id: 'deck-int-1' })
      );
    });
  });
});
