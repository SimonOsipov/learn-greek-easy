import React from 'react';

import { cn } from '@/lib/utils';

export interface MasteryDotsProps {
  /** Total number of dots (default: 4) */
  count?: number;
  /** Number of filled dots (0 to count) */
  filled: number;
  /** Optional additional CSS classes on the container */
  className?: string;
}

export const MasteryDots: React.FC<MasteryDotsProps> = ({ count = 4, filled, className }) => {
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
