import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide singleton QueryClient.
 *
 * Importable from non-React code (Zustand stores, event callbacks, SSE
 * handlers) so they can call `queryClient.invalidateQueries(...)` or
 * `queryClient.removeQueries(...)` without going through React context.
 *
 * Global defaults are deliberately conservative — per-hook overrides
 * remain the exception, not the rule.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: 1,
      // PERF-08: disabled globally — culture/study payloads are large (12 k/9.8 k calls
      // were driven by per-focus refetches). Enable per-hook where real-time freshness
      // is required (e.g. admin mutation flows that invalidate on success).
      refetchOnWindowFocus: false,
      refetchInterval: false,
    },
  },
});
