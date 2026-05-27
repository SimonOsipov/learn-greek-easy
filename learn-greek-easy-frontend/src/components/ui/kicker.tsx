import * as React from 'react';

import { cn } from '@/lib/utils';

export type KickerTone =
  | 'primary'
  | 'blue'
  | 'amber'
  | 'violet'
  | 'cyan'
  | 'green'
  | 'red'
  | 'gray';

export interface KickerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Color of the leading dot. Defaults to 'primary'. */
  dot?: KickerTone;
  children: React.ReactNode;
}

const Kicker = React.forwardRef<HTMLDivElement, KickerProps>(
  ({ dot = 'primary', className, children, ...props }, ref) => (
    <div ref={ref} className={cn('kicker-atom', className)} {...props}>
      <span className="kicker-dot" data-tone={dot} />
      {children}
    </div>
  )
);
Kicker.displayName = 'Kicker';

export { Kicker };
