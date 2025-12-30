import { lazy, type ComponentType } from 'react';

interface LazyWithRetryOptions {
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelay?: number;
  /** Max delay in ms (default: 10000) */
  maxDelay?: number;
}

/**
 * lazyWithRetry - Enhanced React.lazy() with automatic retry on failure
 *
 * Use this instead of React.lazy() for route-level code splitting.
 * Automatically retries failed chunk loads with exponential backoff.
 *
 * @example
 * // For named exports (most pages in this codebase):
 * const Dashboard = lazyWithRetry(
 *   () => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard }))
 * );
 *
 * @example
 * // For default exports:
 * const AdminPage = lazyWithRetry(() => import('@/pages/AdminPage'));
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyWithRetryOptions = {}
): React.LazyExoticComponent<T> {
  const { retries = 3, baseDelay = 1000, maxDelay = 10000 } = options;

  return lazy(async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importFn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on last attempt
        if (attempt < retries) {
          // Exponential backoff with max delay
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    throw lastError;
  });
}

/**
 * Helper to transform named exports for lazy loading
 *
 * @example
 * const Dashboard = lazyWithRetry(
 *   namedExport(() => import('@/pages/Dashboard'), 'Dashboard')
 * );
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function namedExport<T extends ComponentType<any>>(
  importFn: () => Promise<Record<string, T>>,
  exportName: string
): () => Promise<{ default: T }> {
  return () => importFn().then((module) => ({ default: module[exportName] }));
}
