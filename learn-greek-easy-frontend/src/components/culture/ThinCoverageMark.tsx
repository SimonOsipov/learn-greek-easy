import type { FC } from 'react';

import type { CultureTopic } from '@/types/culture';

/**
 * ThinCoverageMark (WEDGE-05-02) — SKELETON, authored by QA (RED phase).
 *
 * Real render logic lands in Stage 3 (executor). Contract (see
 * src/components/culture/__tests__/ThinCoverageMark.test.tsx for the pinned
 * expectations):
 *   - When `thin` is true: renders a lucide `AlertTriangle` inside a Radix
 *     `Tooltip` (trigger testid="thin-coverage-mark"), with a localized
 *     `aria-label` (`mockExam:coverage.thinMark.label`) on the trigger and
 *     `mockExam:coverage.thinMark.tooltip` as the tooltip content.
 *   - When `thin` is false: renders `null` (nothing).
 *   - This component is a standalone leaf that may be rendered outside any
 *     ancestor `TooltipProvider` (e.g. in isolation via the shared test
 *     render helper, which does not wrap one — see
 *     src/lib/test-utils.tsx). Follow the WordEntryCards.tsx convention
 *     (src/components/admin/WordEntryCards.tsx:284) and wrap its own
 *     `<TooltipProvider>` internally rather than assuming App.tsx's global
 *     one is an ancestor. Nested TooltipProviders are harmless.
 *   - `topic` is accepted for future use (e.g. topic-scoped analytics /
 *     testid suffixing) but is not asserted on by the current test spec.
 */
export interface ThinCoverageMarkProps {
  topic: CultureTopic;
  thin: boolean;
}

export const ThinCoverageMark: FC<ThinCoverageMarkProps> = () => null;
