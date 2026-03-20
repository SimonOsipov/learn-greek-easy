import React from 'react';

import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PracticeHeaderProps {
  onExit: () => void;
  exitLabel?: string;
  rightSlot?: React.ReactNode;
  className?: string;
  exitTestId?: string;
}

export const PracticeHeader: React.FC<PracticeHeaderProps> = ({
  onExit,
  exitLabel = 'Exit',
  rightSlot,
  className,
  exitTestId = 'practice-exit-button',
}) => {
  return (
    <div
      className={cn('flex items-center justify-between px-4 py-3', className)}
      data-testid="practice-header"
    >
      <Button variant="ghost" size="sm" onClick={onExit} data-testid={exitTestId}>
        <ChevronLeft className="mr-1 h-4 w-4" />
        {exitLabel}
      </Button>
      <div className="flex items-center gap-2">{rightSlot}</div>
    </div>
  );
};
