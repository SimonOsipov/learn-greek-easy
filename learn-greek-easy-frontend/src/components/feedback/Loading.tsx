import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Props for the Loading component
 */
export interface LoadingProps {
  /** Loading variant to display */
  variant?: 'page' | 'inline' | 'overlay' | 'skeleton';
  /** Loading text to display (not shown for skeleton variant) */
  text?: string;
  /** Number of skeleton rows (only for skeleton variant) */
  rows?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading component with multiple display variants
 *
 * @example
 * ```tsx
 * // Full page loading
 * <Loading variant="page" text="Loading data..." />
 *
 * // Inline loader
 * <Loading variant="inline" text="Saving..." />
 *
 * // Loading overlay
 * <Loading variant="overlay" />
 *
 * // Skeleton placeholder
 * <Loading variant="skeleton" rows={5} />
 * ```
 */
export function Loading({
  variant = 'inline',
  text = 'Loading...',
  rows = 3,
  className
}: LoadingProps) {
  if (variant === 'page') {
    return (
      <div
        className={cn(
          'flex items-center justify-center min-h-[400px]',
          className
        )}
        role="status"
        aria-live="polite"
        aria-label={text}
      >
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">{text}</p>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={cn('flex items-center gap-2 text-muted-foreground text-sm', className)}
        role="status"
        aria-live="polite"
        aria-label={text}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>{text}</span>
      </div>
    );
  }

  if (variant === 'overlay') {
    return (
      <div
        className={cn(
          'absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50',
          className
        )}
        role="status"
        aria-live="polite"
        aria-label={text}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        {text && <span className="sr-only">{text}</span>}
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className={cn('space-y-3', className)} role="status" aria-label="Loading content">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  return null;
}

/**
 * Card skeleton component for loading card layouts
 *
 * @example
 * ```tsx
 * <CardSkeleton />
 * ```
 */
export function CardSkeleton() {
  return (
    <div className="p-4 border rounded-lg bg-card" role="status" aria-label="Loading card">
      <div className="space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Props for the ListSkeleton component
 */
export interface ListSkeletonProps {
  /** Number of list items to display */
  count?: number;
  /** Whether to show avatar placeholder */
  showAvatar?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * List skeleton component for loading list layouts
 *
 * @example
 * ```tsx
 * <ListSkeleton count={5} showAvatar />
 * ```
 */
export function ListSkeleton({ count = 3, showAvatar = true, className }: ListSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)} role="status" aria-label="Loading list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          {showAvatar && <Skeleton className="h-12 w-12 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
