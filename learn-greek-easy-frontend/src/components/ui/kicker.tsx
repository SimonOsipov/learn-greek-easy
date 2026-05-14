import * as React from 'react';

import { cn } from '@/lib/utils';

export type KickerTone = 'primary' | 'amber' | 'violet' | 'cyan' | 'green' | 'red' | 'gray';

export interface KickerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Color of the leading dot. Defaults to 'primary'. */
  dot?: KickerTone;
  children: React.ReactNode;
}

export const Kicker = React.forwardRef<HTMLDivElement, KickerProps>(
  ({ dot = 'primary', className, children, ...rest }, ref) => (
    <div ref={ref} className={cn('kicker-atom', className)} {...rest}>
      <span className="kicker-dot" data-tone={dot} aria-hidden="true" />
      {children}
    </div>
  )
);

Kicker.displayName = 'Kicker';
