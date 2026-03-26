import React from 'react';

import { useTranslation } from 'react-i18next';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type DotStatus = 'none' | 'studied' | 'mastered';

export interface TypedDot {
  labelKey: string;
  status: DotStatus;
}

export interface MasteryDotsProps {
  /** Legacy mode: total dot count */
  count?: number;
  /** Legacy mode: filled dot count */
  filled?: number;
  /** New mode: per-type dots with status */
  dots?: TypedDot[];
  /** Optional additional CSS classes */
  className?: string;
}

const DOT_COLORS: Record<DotStatus, string> = {
  none: 'bg-muted-foreground/30',
  studied: 'bg-blue-500',
  mastered: 'bg-green-500',
};

export const MasteryDots: React.FC<MasteryDotsProps> = ({
  count = 4,
  filled = 0,
  dots,
  className,
}) => {
  // New mode: typed dots with popover
  if (dots && dots.length > 0) {
    return <TypedMasteryDots dots={dots} className={className} />;
  }

  // Legacy mode: simple filled/unfilled
  return (
    <div
      data-testid="mastery-dots"
      className={cn('flex gap-1', className)}
      aria-label={`Progress: ${filled} of ${count}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-2 w-2 rounded-full',
            i < filled ? 'bg-primary' : 'bg-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
};

MasteryDots.displayName = 'MasteryDots';

// --- Typed dots with popover ---

const STATUS_LABELS: Record<DotStatus, string> = {
  none: 'notStarted',
  studied: 'inProgress',
  mastered: 'mastered',
};

const TypedMasteryDots: React.FC<{ dots: TypedDot[]; className?: string }> = ({
  dots,
  className,
}) => {
  const { t } = useTranslation('deck');

  const masteredCount = dots.filter((d) => d.status === 'mastered').length;
  const ariaLabel = `Type progress: ${masteredCount} of ${dots.length} mastered`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="mastery-dots"
          className={cn(
            'flex cursor-pointer gap-1 rounded-sm p-0.5 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
          )}
          aria-label={ariaLabel}
          onClick={(e) => e.stopPropagation()}
        >
          {dots.map((dot, i) => (
            <div key={i} className={cn('h-2 w-2 rounded-full', DOT_COLORS[dot.status])} />
          ))}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3" data-testid="mastery-dots-popover">
        <div className="space-y-2">
          {dots.map((dot, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t(dot.labelKey)}</span>
              <div className="flex items-center gap-1.5">
                <div className={cn('h-2 w-2 rounded-full', DOT_COLORS[dot.status])} />
                <span className="text-muted-foreground">
                  {t(`v2Practice.typeProgress.${STATUS_LABELS[dot.status]}`)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
