import React from 'react';

import { cn } from '@/lib/utils';

export interface ProgressIndicatorProps {
  current: number;
  total: number;
  label: string;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  current,
  total,
  label,
  className,
}) => {
  return (
    <p
      className={cn('text-center text-sm text-muted-foreground', className)}
      data-testid="progress-indicator"
    >
      {label} {current} of {total}
    </p>
  );
};
