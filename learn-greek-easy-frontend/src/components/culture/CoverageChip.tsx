import type { FC } from 'react';

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';

/**
 * CoverageChip (WEDGE-05-02) — renders "{{count}} questions · updated
 * {{date}}" (or, when `updatedAt` is null, just "{{count}} questions") with
 * CLDR-plural resolution via i18next (`_one/_other` for EN,
 * `_one/_few/_many/_other` for RU).
 */
export interface CoverageChipProps {
  questionCount: number;
  updatedAt: string | null;
}

export const CoverageChip: FC<CoverageChipProps> = ({ questionCount, updatedAt }) => {
  const { t, i18n } = useTranslation('mockExam');

  if (updatedAt === null) {
    return (
      <Badge variant="secondary" data-testid="coverage-chip">
        {t('coverage.chipNoDate', { count: questionCount })}
      </Badge>
    );
  }

  const date = new Date(updatedAt).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <Badge variant="secondary" data-testid="coverage-chip">
      {t('coverage.chip', { count: questionCount, date })}
    </Badge>
  );
};
