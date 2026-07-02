import { useEffect } from 'react';

import { useLocation } from 'react-router-dom';

import { reportAPIError } from '@/lib/errorReporting';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';

/**
 * Warm the deck-cover cache once per authenticated session.
 *
 * Deck cover images (`coverImageUrl`) live on the in-memory deckStore, which is
 * only populated when a page calls `fetchDecks()` (historically just /decks and
 * the dashboard). This hook calls `ensureDecksFresh()` as soon as auth is
 * confirmed, so covers are available everywhere — the deck-detail hero's sibling
 * stack — without first visiting /decks.
 *
 * `ensureDecksFresh()` de-dupes (freshness gate + in-flight guard), so mounting
 * this on route change never double-fetches. Persistence paints instantly from
 * localStorage; this call keeps data + presigned URLs fresh (stale-while-revalidate).
 *
 * PERF-15-06: skipped on `/dashboard` — the dashboard now sources its decks
 * (and their covers) entirely from `GET /dashboard/summary`
 * (`useDashboardSummary`), so warming deckStore there would just be a
 * redundant duplicate `/decks` fetch on the dashboard's cold load. Still
 * runs on every other protected route exactly as before.
 */
export function useWarmDeckCovers(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const ensureDecksFresh = useDeckStore((s) => s.ensureDecksFresh);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (pathname.startsWith('/dashboard')) return;
    ensureDecksFresh().catch((error) => {
      reportAPIError(error, { operation: 'warmDeckCovers', endpoint: '/decks' });
    });
  }, [isAuthenticated, ensureDecksFresh, pathname]);
}
