// CER-53 — CardErrorStatusBadge i18n tests
// Tests all 4 statuses in EN and RU locales (AC #6 and #7).

import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/lib/test-utils';

import { CardErrorStatusBadge } from '../CardErrorStatusBadge';

// Reset to EN after each test so RU assertions don't leak
afterEach(async () => {
  await i18n.changeLanguage('en');
});

// Exact strings copied from the locale files to prevent typos defeating the test
const CASES = [
  { status: 'PENDING' as const, en: 'Pending', ru: 'В ожидании' },
  { status: 'REVIEWED' as const, en: 'Reviewed', ru: 'Рассмотрено' },
  { status: 'FIXED' as const, en: 'Fixed', ru: 'Исправлено' },
  { status: 'DISMISSED' as const, en: 'Dismissed', ru: 'Отклонено' },
] as const;

describe('CardErrorStatusBadge (CER-53)', () => {
  // AC #6: correct EN label for all 4 statuses
  describe('EN locale', () => {
    it.each(CASES)('renders "$en" for status $status', async ({ status, en }) => {
      await i18n.changeLanguage('en');
      renderWithProviders(<CardErrorStatusBadge status={status} />);
      const badge = screen.getByTestId('card-error-status-badge');
      expect(badge).toHaveTextContent(en);
    });
  });

  // AC #7: correct RU label for all 4 statuses after i18n.changeLanguage('ru')
  describe('RU locale', () => {
    it.each(CASES)('renders "$ru" for status $status in RU', async ({ status, ru }) => {
      await i18n.changeLanguage('ru');
      renderWithProviders(<CardErrorStatusBadge status={status} />);
      const badge = screen.getByTestId('card-error-status-badge');
      expect(badge).toHaveTextContent(ru);
    });
  });
});
