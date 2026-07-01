import { useEffect } from 'react';

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
 * stack and the dashboard feed cards — without first visiting /decks.
 *
 * `ensureDecksFresh()` de-dupes (freshness gate + in-flight guard), so mounting
 * this alongside the dashboard's own fetch never double-fetches. Persistence
 * paints instantly from localStorage; this call keeps data + presigned URLs
 * fresh (stale-while-revalidate).
 */
export function useWarmDeckCovers(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const ensureDecksFresh = useDeckStore((s) => s.ensureDecksFresh);

  useEffect(() => {
    if (!isAuthenticated) return;
    ensureDecksFresh().catch((error) => {
      reportAPIError(error, { operation: 'warmDeckCovers', endpoint: '/decks' });
    });
  }, [isAuthenticated, ensureDecksFresh]);
}
