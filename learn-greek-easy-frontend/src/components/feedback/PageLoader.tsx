import { Loader2 } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Props for the PageLoader component
 */
export interface PageLoaderProps {
  /** Variant of the loader */
  variant?: 'default' | 'minimal' | 'skeleton';
  /** Custom loading text */
  text?: string;
}

/**
 * PageLoader - Suspense fallback component for lazy-loaded pages
 *
 * Used as the fallback for React.lazy() loaded route components.
 * Provides a consistent loading experience across the app.
 *
 * - default: Full page centered spinner with text
 * - minimal: Just the spinner (for smaller components)
 * - skeleton: Skeleton layout matching common page structure
 *
 * @example
 * ```tsx
 * <Suspense fallback={<PageLoader />}>
 *   <LazyLoadedPage />
 * </Suspense>
 *
 * <Suspense fallback={<PageLoader variant="skeleton" />}>
 *   <LazyLoadedPage />
 * </Suspense>
 * ```
 */
export function PageLoader({ variant = 'default', text = 'Loading...' }: PageLoaderProps) {
  if (variant === 'minimal') {
    return (
      <div
        className="flex items-center justify-center p-8"
        role="status"
        aria-busy="true"
        aria-label={text}
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div
        className="min-h-screen bg-background p-6"
        role="status"
        aria-busy="true"
        aria-label={text}
      >
        {/* Header skeleton */}
        <div className="mb-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        {/* Content skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-6">
              <Skeleton className="mb-4 h-6 w-32" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="mb-2 h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default variant - full page centered loader
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      role="status"
      aria-busy="true"
      aria-label={text}
    >
      <div className="space-y-4 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
