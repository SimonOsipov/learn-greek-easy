import * as React from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type BadgeTone = 'blue' | 'violet' | 'amber' | 'green' | 'red' | 'cyan' | 'gray';

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * Admin v2.4 tone. When set, renders via the `.badge.b-{tone}` CSS classes
   * and ignores `variant`. Composes with `onPhoto` for frosted backing.
   */
  tone?: BadgeTone;
  /** Frosted card backing for badges placed over photos. Composes with `tone`. */
  onPhoto?: boolean;
}

function Badge({ className, variant, tone, onPhoto, ...props }: BadgeProps) {
  if (tone) {
    return (
      <div className={cn('badge', `b-${tone}`, onPhoto && 'on-photo', className)} {...props} />
    );
  }
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
