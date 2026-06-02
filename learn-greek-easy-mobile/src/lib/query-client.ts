import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide singleton QueryClient for the mobile app. Mirrors the web defaults
 * (learn-greek-easy-frontend/src/lib/queryClient.ts): conservative staleness,
 * single retry, no window-focus refetch.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
