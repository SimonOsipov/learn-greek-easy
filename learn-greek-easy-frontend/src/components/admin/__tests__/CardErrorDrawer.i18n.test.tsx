/**
 * CER-24 — Drawer status badge i18n regression test
 *
 * Context: In RU mode, the drawer header rendered the status pill in English
 * while the list-card pill correctly showed the RU label.
 * Root cause fix was in CER-47 (CardErrorStatusBadge reads from i18n).
 * This spec is the regression net: asserts all 8 cases (4 statuses × 2 locales).
 *
 * If the root-cause fix is in place (CER-47 done), all 8 should pass.
 * If CER-47 is NOT done, the 4 RU cases will fail — expected signal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/lib/test-utils';
import i18n from '@/i18n';
import type { AdminCardErrorResponse } from '@/types/cardError';
import type { CardErrorStatus } from '@/types/cardError';

import { CardErrorDrawer } from '../CardErrorDrawer';

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    updateCardError: vi.fn(),
  },
}));

// ── Factory ───────────────────────────────────────────────────────────────────

function makeReport(status: CardErrorStatus): AdminCardErrorResponse {
  return {
    id: 'abcdef12-3456-7890-abcd-ef1234567890',
    card_id: 'card-uuid-001',
    card_type: 'WORD',
    user_id: 'user-uuid-001',
    description: 'Something looks wrong here.',
    status,
    admin_notes: null,
    resolved_by: null,
    resolved_at: null,
    reporter: { id: 'user-uuid-001', full_name: 'Test Reporter' },
    resolver: null,
    card: null,
    deck: null,
    created_at: '2026-05-14T10:18:00.000Z',
    updated_at: '2026-05-14T10:18:00.000Z',
  };
}

// ── Test cases ────────────────────────────────────────────────────────────────

const CASES = [
  { status: 'PENDING' as const, en: 'Pending', ru: 'В ожидании' },
  { status: 'REVIEWED' as const, en: 'Reviewed', ru: 'Рассмотрено' },
  { status: 'FIXED' as const, en: 'Fixed', ru: 'Исправлено' },
  { status: 'DISMISSED' as const, en: 'Dismissed', ru: 'Отклонено' },
] as const;

// ── Spec ──────────────────────────────────────────────────────────────────────

describe('CardErrorDrawer status badge i18n (CER-24)', () => {
  describe.each(['en', 'ru'] as const)('locale = %s', (locale) => {
    beforeEach(async () => {
      await i18n.changeLanguage(locale);
    });

    it.each(CASES)('renders $status label correctly', ({ status, en, ru }) => {
      const expectedLabel = locale === 'en' ? en : ru;
      const report = makeReport(status);

      renderWithProviders(
        <CardErrorDrawer open onOpenChange={vi.fn()} report={report} onUpdate={vi.fn()} />
      );

      // CER-37 added a second status badge in the footer; the header badge is first.
      const badges = screen.getAllByTestId('card-error-status-badge');
      expect(badges[0]).toHaveTextContent(expectedLabel);
    });
  });
});
