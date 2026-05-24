// CER-54 — CardErrorDrawer unit tests
// Covers container behavior, three tab panels, footer, delete confirmation.
// Note: CardErrorDrawer renders via a Radix portal into document.body,
// so we use screen.* and document.querySelector for CSS-class queries.

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';
import type { AdminCardErrorResponse } from '@/types/cardError';

import { CardErrorDrawer } from '../CardErrorDrawer';

// ── Mocks ─────────────────────────────────────────────────────────────name──

const mockDeleteError = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    updateCardError: vi.fn(),
    deleteCardError: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/adminCardErrorStore', () => ({
  useAdminCardErrorStore: vi.fn((selector) => {
    const state = { deleteError: mockDeleteError };
    return selector(state);
  }),
}));

beforeEach(() => {
  mockDeleteError.mockClear();
  mockDeleteError.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Factory ───────────────────────────────────────────────────────────────────

function makeFakeError(overrides: Partial<AdminCardErrorResponse> = {}): AdminCardErrorResponse {
  return {
    id: '7c1fabcd-1234-5678-abcd-ef1234567890',
    card_id: 'card-uuid-abc123',
    card_type: 'WORD',
    user_id: 'user-uuid-001',
    description: 'This word looks wrong.',
    status: 'PENDING',
    admin_notes: null,
    resolved_by: null,
    resolved_at: null,
    reporter: { id: 'user-uuid-001', full_name: 'Maria' },
    resolver: null,
    card: {
      word: 'αδερφή',
      article: 'η',
      translation_en: 'sister',
      translation_ru: 'сестра',
      gender: 'f',
    },
    deck: { id: 'deck-001', name: 'A1 Basics' },
    created_at: '2026-05-14T10:00:00Z',
    updated_at: '2026-05-14T10:00:00Z',
    ...overrides,
  };
}

// ── Container behavior ────────────────────────────────────────────────────────

describe('CardErrorDrawer — container', () => {
  // AC #1: H2 literal "Error report"
  it('renders H2 with text "Error report"', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    const headings = screen.getAllByRole('heading', { level: 2 });
    // The visible h2 has class drawer-h and contains "Error report"
    const visibleH2 = headings.find((h) => h.classList.contains('drawer-h'));
    expect(visibleH2 ?? headings[0]).toHaveTextContent('Error report');
  });

  // AC #3: breadcrumb contains the short ID
  it('breadcrumb text contains #<shortId>', () => {
    const report = makeFakeError();
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={report} onUpdate={vi.fn()} />
    );
    const shortId = report.id.slice(0, 8);
    // drawer-bcrumb renders inside the portal (document.body)
    const breadcrumb = document.querySelector('.drawer-bcrumb');
    expect(breadcrumb).not.toBeNull();
    expect(breadcrumb?.textContent).toContain(`#${shortId}`);
  });

  // AC #4: three tabs in order Review / The card / Meta, Review active by default
  it('renders three tabs with Review active', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    const reviewTab = screen.getByTestId('card-error-drawer-tab-review');
    const theCardTab = screen.getByTestId('card-error-drawer-tab-theCard');
    const metaTab = screen.getByTestId('card-error-drawer-tab-meta');

    expect(reviewTab).toBeInTheDocument();
    expect(theCardTab).toBeInTheDocument();
    expect(metaTab).toBeInTheDocument();

    expect(reviewTab.className).toContain('is-active');
    expect(theCardTab.className).not.toContain('is-active');
    expect(metaTab.className).not.toContain('is-active');

    expect(screen.getByTestId('drawer-tab-review')).toBeInTheDocument();
  });

  // Tab switching
  it('clicking tab buttons switches the active panel', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );

    expect(screen.getByTestId('drawer-tab-review')).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-tab-theCard')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('card-error-drawer-tab-theCard'));
    expect(screen.queryByTestId('drawer-tab-review')).not.toBeInTheDocument();
    expect(screen.getByTestId('drawer-tab-theCard')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('card-error-drawer-tab-meta'));
    expect(screen.getByTestId('drawer-tab-meta')).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-tab-theCard')).not.toBeInTheDocument();
  });

  // AC #5: copy card ID — clipboard called + button label flips
  it('Copy card ID writes to clipboard and flips button label', async () => {
    const clipboardMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardMock },
      configurable: true,
    });

    const report = makeFakeError();

    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={report} onUpdate={vi.fn()} />
    );

    const copyBtn = screen.getByTestId('copy-card-id-button');
    expect(copyBtn).toHaveTextContent('Copy card ID');

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    // Clipboard should have been called with the card_id
    expect(clipboardMock).toHaveBeenCalledWith(report.card_id);

    // Button should show "Copied" after the async clipboard write resolves
    await waitFor(() => {
      expect(screen.getByTestId('copy-card-id-button')).toHaveTextContent('Copied');
    });
  });

  // AC #2: ESC closes drawer
  it('ESC key calls onOpenChange(false)', async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <CardErrorDrawer
        open
        onOpenChange={onOpenChange}
        report={makeFakeError()}
        onUpdate={vi.fn()}
      />
    );
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ── Footer ────────────────────────────────────────────────────────────────────

describe('CardErrorDrawer — footer', () => {
  it('shows reporter name in caption when unresolved', () => {
    renderWithProviders(
      <CardErrorDrawer
        open
        onOpenChange={vi.fn()}
        report={makeFakeError({ resolved_at: null, reporter: { id: 'u1', full_name: 'Maria' } })}
        onUpdate={vi.fn()}
      />
    );
    const caption = screen.getByTestId('foot-caption');
    expect(caption.textContent).toContain('Maria');
  });

  it('shows resolver name in caption when resolved', () => {
    renderWithProviders(
      <CardErrorDrawer
        open
        onOpenChange={vi.fn()}
        report={makeFakeError({
          resolved_at: '2026-05-20T10:00:00Z',
          resolver: { id: 'a1', full_name: 'Sam' },
        })}
        onUpdate={vi.fn()}
      />
    );
    const caption = screen.getByTestId('foot-caption');
    expect(caption.textContent).toContain('Sam');
  });

  // AC #9: Delete button has text-destructive class (design-system drift guard)
  it('Delete button has text-destructive class', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    const deleteBtn = screen.getByTestId('delete-button');
    expect(deleteBtn.className).toContain('text-destructive');
  });
});

// ── Delete confirmation ───────────────────────────────────────────────────────

describe('CardErrorDrawer — delete confirmation', () => {
  it('clicking Delete opens AlertDialog', async () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    fireEvent.click(screen.getByTestId('delete-button'));
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  it('cancel closes AlertDialog without calling drawer onOpenChange', async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <CardErrorDrawer
        open
        onOpenChange={onOpenChange}
        report={makeFakeError()}
        onUpdate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('delete-button'));
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    // Cancel button is the one that's NOT the confirm button
    const alertDialog = screen.getByRole('alertdialog');
    const buttons = alertDialog.querySelectorAll('button');
    const cancelBtn = Array.from(buttons).find(
      (b) => b.getAttribute('data-testid') !== 'delete-confirm-button'
    );
    expect(cancelBtn).not.toBeUndefined();
    fireEvent.click(cancelBtn!);

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('confirming delete calls deleteError and closes drawer', async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <CardErrorDrawer
        open
        onOpenChange={onOpenChange}
        report={makeFakeError()}
        onUpdate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('delete-button'));
    await waitFor(() => {
      expect(screen.getByTestId('delete-confirm-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-confirm-button'));

    await waitFor(
      () => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      },
      { timeout: 3000 }
    );
    expect(mockDeleteError).toHaveBeenCalledTimes(1);
  });
});

// ── Review tab ────────────────────────────────────────────────────────────────

describe('CardErrorDrawer — Review tab', () => {
  it('renders reporter thread with reporter name', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    expect(screen.getByText('Maria')).toBeInTheDocument();
  });

  it('renders compact CardPreview (is-compact class) in review tab', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    // Portal content is in document.body
    expect(document.querySelector('.ce-preview-word.is-compact')).not.toBeNull();
  });

  it('renders status grid', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    expect(document.querySelector('.admin-status-grid')).not.toBeNull();
  });

  it('renders admin notes textarea', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    expect(screen.getByTestId('admin-notes-textarea')).toBeInTheDocument();
  });

  it('renders canned reply pills container', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    // CannedReplyPills uses .admin-canned wrapper class
    expect(document.querySelector('.admin-canned')).not.toBeNull();
  });

  it('shows resolved banner when resolved_at is set', () => {
    renderWithProviders(
      <CardErrorDrawer
        open
        onOpenChange={vi.fn()}
        report={makeFakeError({ resolved_at: '2026-05-20T10:00:00Z' })}
        onUpdate={vi.fn()}
      />
    );
    expect(screen.getByTestId('resolved-banner')).toBeInTheDocument();
  });

  it('does not show resolved banner when resolved_at is null', () => {
    renderWithProviders(
      <CardErrorDrawer
        open
        onOpenChange={vi.fn()}
        report={makeFakeError({ resolved_at: null })}
        onUpdate={vi.fn()}
      />
    );
    expect(screen.queryByTestId('resolved-banner')).not.toBeInTheDocument();
  });
});

// ── The card tab ──────────────────────────────────────────────────────────────

describe('CardErrorDrawer — The card tab', () => {
  it('renders full (non-compact) CardPreview after switching to The card tab', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    fireEvent.click(screen.getByTestId('card-error-drawer-tab-theCard'));
    // Full preview: .ce-preview-word present, without is-compact
    const preview = document.querySelector('.ce-preview-word');
    expect(preview).not.toBeNull();
    expect(preview?.classList.contains('is-compact')).toBe(false);
  });

  it('renders Copy button and Open-in-deck button', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    fireEvent.click(screen.getByTestId('card-error-drawer-tab-theCard'));
    expect(screen.getByTestId('the-card-copy-button')).toBeInTheDocument();
    expect(screen.getByTestId('the-card-open-deck-button')).toBeInTheDocument();
  });

  it('Card-ID element (ce-id) contains the card uuid', () => {
    renderWithProviders(
      <CardErrorDrawer open onOpenChange={vi.fn()} report={makeFakeError()} onUpdate={vi.fn()} />
    );
    fireEvent.click(screen.getByTestId('card-error-drawer-tab-theCard'));
    const codeEl = document.querySelector('.ce-id');
    expect(codeEl).not.toBeNull();
    expect(codeEl?.textContent).toBe('card-uuid-abc123');
  });
});

// ── Meta tab ──────────────────────────────────────────────────────────────────

describe('CardErrorDrawer — Meta tab', () => {
  it('renders 7 meta rows when resolved_at is set', () => {
    renderWithProviders(
      <CardErrorDrawer
        open
        onOpenChange={vi.fn()}
        report={makeFakeError({ resolved_at: '2026-05-20T10:00:00Z' })}
        onUpdate={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('card-error-drawer-tab-meta'));
    const rows = document.querySelectorAll('.admin-meta-row');
    expect(rows.length).toBe(7);
  });

  it('renders 6 meta rows when resolved_at is null', () => {
    renderWithProviders(
      <CardErrorDrawer
        open
        onOpenChange={vi.fn()}
        report={makeFakeError({ resolved_at: null })}
        onUpdate={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('card-error-drawer-tab-meta'));
    const rows = document.querySelectorAll('.admin-meta-row');
    expect(rows.length).toBe(6);
  });
});
