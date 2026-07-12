import type { FC } from 'react';

import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CultureTopic } from '@/types/culture';

/**
 * ThinCoverageMark (WEDGE-05-02) — a small warning glyph + tooltip shown next
 * to a topic when its bank coverage is thin. Renders nothing when `thin` is
 * false. Self-wraps its own `TooltipProvider` since it's a standalone leaf
 * that may be rendered without an ancestor provider (see WordEntryCards.tsx
 * for the same convention); nested providers are harmless.
 */
export interface ThinCoverageMarkProps {
  topic: CultureTopic;
  thin: boolean;
}

export const ThinCoverageMark: FC<ThinCoverageMarkProps> = ({ thin }) => {
  const { t } = useTranslation('mockExam');

  if (!thin) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span aria-label={t('coverage.thinMark.label')} data-testid="thin-coverage-mark">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5 text-warning" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {t('coverage.thinMark.tooltip')}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
