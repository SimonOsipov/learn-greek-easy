import type { FC } from 'react';

/**
 * CoverageChip (WEDGE-05-02) — SKELETON, authored by QA (RED phase).
 *
 * Real render logic lands in Stage 3 (executor). Contract (see
 * src/components/culture/__tests__/CoverageChip.test.tsx for the pinned
 * expectations):
 *   - Renders a `Badge` (data-testid="coverage-chip") with the localized
 *     `mockExam:coverage.chip_*` string ("{{count}} questions · updated
 *     {{date}}") when `updatedAt` is non-null, using CLDR plural keys
 *     (`chip_one` / `chip_other` for EN; `chip_one/_few/_many/_other` for RU)
 *     via `t('coverage.chip', { count: questionCount, date })`.
 *   - Switches to `coverage.chipNoDate_*` (no "updated {{date}}" segment)
 *     when `updatedAt` is null.
 *   - `date` is computed via
 *     `new Date(updatedAt).toLocaleDateString(i18n.language, { day:
 *     'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })` — MUST
 *     pass `timeZone: 'UTC'` so the rendered calendar day matches the UTC
 *     instant `updatedAt` encodes, not the viewer's local offset.
 */
export interface CoverageChipProps {
  questionCount: number;
  updatedAt: string | null;
}

export const CoverageChip: FC<CoverageChipProps> = () => null;
