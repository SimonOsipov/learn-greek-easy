/**
 * useDashboard — composition hook that assembles all dashboard data sources
 * into a single typed view model.
 *
 * No JSX, no network calls beyond the composed hooks.
 */

import { useProgressDashboard } from '@/hooks/use-progress-dashboard';
import { useWeekTrends } from '@/hooks/use-week-trends';
import { useDeckProgress } from '@/hooks/use-deck-progress';
import { useNews } from '@/hooks/use-news';
import { useSituations } from '@/hooks/use-situations';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useDecks } from '@/hooks/use-decks';
import { useUserSettings } from '@/hooks/use-user-settings';

import { greetingForHour, pickResumeDeck, isNewUser, buildHeatmap } from '@/lib/dashboard/derive';
import type { DashboardViewModel, DeckWithProgress } from '@/types/dashboard';

export function useDashboard(): DashboardViewModel {
  // -------------------------------------------------------------------------
  // Underlying queries
  // -------------------------------------------------------------------------
  const progressQuery = useProgressDashboard();
  const trendsQuery = useWeekTrends();
  const deckProgressQuery = useDeckProgress();
  const newsQuery = useNews();
  const situationsQuery = useSituations();
  const profileQuery = useUserProfile();
  const decksQuery = useDecks();
  // useUserSettings shares the ['me'] cache key; consume it for settings data.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _settingsQuery = useUserSettings();

  // -------------------------------------------------------------------------
  // Aggregate loading / error states
  // Critical = progressQuery; all others are supplementary.
  // -------------------------------------------------------------------------
  const isLoading = progressQuery.isLoading;

  const isError =
    progressQuery.isError ||
    trendsQuery.isError ||
    deckProgressQuery.isError ||
    newsQuery.isError ||
    situationsQuery.isError ||
    profileQuery.isError ||
    decksQuery.isError;

  // -------------------------------------------------------------------------
  // Greeting — derived from the *local* hour, read inside the hook.
  // -------------------------------------------------------------------------
  const greeting = greetingForHour(new Date().getHours());

  // -------------------------------------------------------------------------
  // isNewUser — withheld (undefined) until progressQuery resolves.
  // Both mastered and streak must be 0 for a brand-new user.
  // -------------------------------------------------------------------------
  const isNewUserValue: boolean | undefined = progressQuery.data
    ? isNewUser(
        progressQuery.data.overview.total_cards_mastered,
        progressQuery.data.streak.current_streak,
      )
    : undefined;

  // -------------------------------------------------------------------------
  // Resume deck
  // -------------------------------------------------------------------------
  const resumeDeck = pickResumeDeck(deckProgressQuery.data?.decks ?? []);

  // -------------------------------------------------------------------------
  // Heatmap (7-day activity buckets)
  // -------------------------------------------------------------------------
  const heatmap = buildHeatmap(trendsQuery.data?.daily_stats ?? []);

  // -------------------------------------------------------------------------
  // 2×2 stat values
  // -------------------------------------------------------------------------
  const masteredCards = progressQuery.data?.overview.total_cards_mastered ?? 0;
  const studyTimeSeconds = progressQuery.data?.overview.total_study_time_seconds ?? 0;
  const currentStreak = progressQuery.data?.streak.current_streak ?? 0;
  const cardsDueToday = progressQuery.data?.today.cards_due ?? 0;
  const reviewedToday = progressQuery.data?.today.reviews_completed ?? 0;

  // -------------------------------------------------------------------------
  // Decks joined with per-deck progress
  // -------------------------------------------------------------------------
  const progressByDeckId = new Map(
    (deckProgressQuery.data?.decks ?? []).map((p) => [p.deck_id, p]),
  );

  const decks: DeckWithProgress[] = (decksQuery.data?.decks ?? []).map((deck) => ({
    ...deck,
    progress: progressByDeckId.get(deck.id),
  }));

  // -------------------------------------------------------------------------
  // News + Situations
  // -------------------------------------------------------------------------
  const news = newsQuery.data?.items ?? [];
  const situations = situationsQuery.data?.items ?? [];

  // -------------------------------------------------------------------------
  // What's New counts
  // -------------------------------------------------------------------------
  const whatsNew = {
    audio_count: newsQuery.data?.audio_count ?? 0,
    country_counts: newsQuery.data?.country_counts ?? { cyprus: 0, greece: 0, world: 0 },
    newDialogsComingSoon: true as const,
  };

  // -------------------------------------------------------------------------
  // First name from profile
  // -------------------------------------------------------------------------
  const firstName = profileQuery.data?.full_name
    ? (profileQuery.data.full_name.split(' ')[0] ?? null)
    : null;

  // -------------------------------------------------------------------------
  // refetchAll — awaits all underlying query refetches in parallel
  // -------------------------------------------------------------------------
  async function refetchAll(): Promise<void> {
    await Promise.allSettled([
      progressQuery.refetch(),
      trendsQuery.refetch(),
      deckProgressQuery.refetch(),
      newsQuery.refetch(),
      situationsQuery.refetch(),
      profileQuery.refetch(),
      decksQuery.refetch(),
    ]);
  }

  // -------------------------------------------------------------------------
  // Per-section error flags (section-level degradation for DASH-10)
  // -------------------------------------------------------------------------
  const newsError = newsQuery.isError;
  const situationsError = situationsQuery.isError;
  const decksError = decksQuery.isError;

  // -------------------------------------------------------------------------
  // Return view model
  // -------------------------------------------------------------------------
  return {
    greeting,
    isNewUser: isNewUserValue,
    resumeDeck,
    heatmap,
    masteredCards,
    studyTimeSeconds,
    currentStreak,
    cardsDueToday,
    reviewedToday,
    decks,
    news,
    situations,
    whatsNew,
    firstName,
    isLoading,
    isError,
    newsError,
    situationsError,
    decksError,
    refetchAll,
  };
}
