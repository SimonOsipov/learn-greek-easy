import * as React from 'react';

import { cn } from '@/lib/utils';

export interface CompletionPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Section name, e.g. "EN", "Pron", "Audio", "Dialog". */
  label: string;
  /**
   * Display value. The caller derives this — examples: "2/2", "✓", "—".
   */
  value: string;
  /**
   * Auto-greens the pill. Caller derives (e.g. `n === total`, `value === "✓"`).
   * The atom does NOT parse `value`.
   */
  done: boolean;
}

export const CompletionPill = React.forwardRef<HTMLSpanElement, CompletionPillProps>(
  ({ label, value, done, className, ...rest }, ref) => (
    <span ref={ref} className={cn('dk-pill', done ? 'is-done' : 'is-todo', className)} {...rest}>
      {label} {value}
    </span>
  )
);

CompletionPill.displayName = 'CompletionPill';
