import React from 'react';

import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { MasteryDots } from './MasteryDots';

export interface MasteryDotsLegendProps {
  /** i18n namespace: 'culture' or 'deck' */
  namespace: 'culture' | 'deck';
  /** i18n key path for the legend text (e.g. 'deck.masteryDotsLegend') */
  legendKey: string;
  /** i18n key path for the trigger button aria-label (e.g. 'deck.masteryDotsInfo') */
  ariaLabelKey: string;
}

export const MasteryDotsLegend: React.FC<MasteryDotsLegendProps> = ({
  namespace,
  legendKey,
  ariaLabelKey,
}) => {
  const { t } = useTranslation(namespace);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t(ariaLabelKey)}
          data-testid="mastery-dots-legend-trigger"
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs" data-testid="mastery-dots-legend-content">
        <div className="mb-2 flex items-center gap-2">
          <MasteryDots filled={2} />
        </div>
        <p className="text-sm text-muted-foreground">{t(legendKey)}</p>
      </PopoverContent>
    </Popover>
  );
};

MasteryDotsLegend.displayName = 'MasteryDotsLegend';
