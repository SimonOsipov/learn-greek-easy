import { QueryClient } from "@tanstack/react-query";

import { APIRequestError } from "./api-client";

/**
 * App-wide singleton QueryClient for the mobile app. Mirrors the web defaults
 * (learn-greek-easy-frontend/src/lib/queryClient.ts): conservative staleness,
 * single retry, no window-focus refetch.
 *
 * Auth failures (401/403) are NOT retried — a 401 means Supabase auto-refresh
 * already failed, so re-auth is driven by the MOB-04 Stack.Protected gate.
 * Retrying would delay re-auth (and TanStack v5 retries thrown errors by default).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: (failureCount, error) => {
        if (
          error instanceof APIRequestError &&
          (error.status === 401 || error.status === 403)
        ) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});
