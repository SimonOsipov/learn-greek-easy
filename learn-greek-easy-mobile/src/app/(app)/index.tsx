/**
 * HomeScreen — the main dashboard screen (DASH-09 / DASH-10).
 *
 * Assembles all dashboard blocks in the spec-mandated order:
 *   1. GreetingHeader
 *   2. ProgressBand + WeekHeatmap
 *   3. ContinueHero
 *   4. ReviewGoalPair (violet review card + amber goal card)
 *   5. WhatsNewChips
 *   6. StatGrid (2×2)
 *   7. Shelves: news → situations → decks → quick-wins
 *
 * DASH-10 additions:
 *   - Pull-to-refresh via RefreshControl → refetchAll()
 *   - Initial load shows DashboardSkeleton instead of bare ActivityIndicator
 *   - Per-section graceful degradation: a failed shelf shows SectionError
 *     inline WITHOUT blanking sibling sections or crashing full-screen
 *   - Reduced-motion aware: shimmer/animation gated via useReducedMotion()
 *   - 401/403 handled by queryClient (no retry) + Stack.Protected gate (MOB-04)
 *
 * While isNewUser is undefined (progress query still loading), renders nothing
 * to prevent a flash of the wrong branch.
 *
 * When isNewUser is true, renders: GreetingHeader + NewUserStart.
 * When isNewUser is false, renders the full returning-user layout above.
 *
 * All card presses either route to a real tab or fire showComingSoonToast()
 * when the destination screen doesn't exist yet.
 *
 * Dark is the default theme (controlled by NativeWind + app _layout).
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpen, Trophy } from 'lucide-react-native';

import { useDashboard } from '@/hooks/use-dashboard';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics';

import { GreetingHeader } from '@/components/dashboard/greeting-header';
import { ProgressBand } from '@/components/dashboard/progress-band';
import { ContinueHero } from '@/components/dashboard/continue-hero';
import { ReviewGoalPair } from '@/components/dashboard/entry-card';
import { WhatsNewChips } from '@/components/dashboard/whats-new-chips';
import { StatGrid } from '@/components/dashboard/stat-grid';
import { Shelf } from '@/components/dashboard/shelf';
import { NewsCard } from '@/components/dashboard/news-card';
import { SituationCard } from '@/components/dashboard/situation-card';
import { DeckCard } from '@/components/dashboard/deck-card';
import { QuickWinsShelf } from '@/components/dashboard/quick-wins-shelf';
import { NewUserStart } from '@/components/dashboard/new-user-start';
import { DashboardSkeleton, SectionError } from '@/components/dashboard/dashboard-skeleton';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Local weekday index — Monday = 0, Sunday = 6.
 * Converts JS Date's Sunday-first getDay() (0 = Sun) to Monday-first index.
 */
function todayWeekIndex(): number {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  return day === 0 ? 6 : day - 1;
}

/**
 * Derive initials (up to 2 chars) from a first name.
 * Falls back to '?' when null/empty.
 */
function initialsFromName(firstName: string | null): string {
  if (!firstName) return '?';
  return firstName.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const { showComingSoonToast } = useToast();
  const reduceMotion = useReducedMotion();

  const {
    greeting,
    firstName,
    currentStreak,
    cardsDueToday,
    reviewedToday,
    masteredCards,
    studyTimeSeconds,
    heatmap,
    resumeDeck,
    decks,
    news,
    situations,
    whatsNew,
    isNewUser,
    isLoading,
    isError,
    newsError,
    situationsError,
    decksError,
    refetchAll,
  } = useDashboard();

  // ── Pull-to-refresh state ──
  // We track a local refreshing flag tied to refetchAll. The spinner shows
  // until the queries settle (isLoading goes false) — we stop refreshing once
  // the critical progress query is no longer loading.
  const [refreshing, setRefreshing] = useState(false);

  const isRefreshing = useRef(false);
  const handleRefresh = useCallback(async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      isRefreshing.current = false;
      setRefreshing(false);
    }
  }, [refetchAll]);

  // ── Analytics: home_screen_viewed ──
  // Fire once after isNewUser resolves (not while undefined / loading).
  // Ref guard prevents double-fire in React StrictMode.
  const viewedFired = useRef(false);
  useEffect(() => {
    if (isNewUser !== undefined && !viewedFired.current) {
      viewedFired.current = true;
      track('home_screen_viewed', { state: isNewUser ? 'new_user' : 'returning' });
    }
  }, [isNewUser]);

  // ── Critical-error state ──
  // If the progress query errors, isLoading becomes false but isNewUser stays
  // undefined — the skeleton guard below would show indefinitely. Catch it here
  // first and show a page-level error + retry affordance instead.
  if (isError && !isLoading) {
    return (
      <SafeAreaView testID="home-error" className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-fg2 text-[15px] text-center mb-5">
          Couldn&apos;t load your dashboard.
        </Text>
        <Pressable
          testID="home-error-retry"
          onPress={refetchAll}
          className="px-6 py-3 rounded-xl bg-card border border-line active:opacity-70"
        >
          <Text className="text-primary text-[14px] font-semibold">Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Loading state ──
  // While isLoading is true, isNewUser is undefined. Show per-section
  // skeletons instead of a bare ActivityIndicator.
  if (isLoading || isNewUser === undefined) {
    return (
      <SafeAreaView testID="home-loading" className="flex-1 bg-bg">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 90 }}
        >
          <DashboardSkeleton reduceMotion={reduceMotion} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── New-user branch ──
  if (isNewUser) {
    return (
      <SafeAreaView testID="home-new-user" className="flex-1 bg-bg">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 90 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Block 1: Greeting (streak = 0 for new user) */}
          <GreetingHeader
            greeting={greeting}
            firstName={firstName}
            streak={0}
            initials={initialsFromName(firstName)}
            onAvatarPress={() => {
              track('home_card_tapped', { section: 'greeting', target: 'profile', coming_soon: false });
              router.push('/(app)/you');
            }}
          />

          {/* New-user chooser block */}
          <NewUserStart
            onPickDeck={() => {
              track('home_card_tapped', { section: 'new-user', target: 'decks', coming_soon: false });
              router.push('/(app)/decks');
            }}
            onReadArticle={() => {
              track('home_card_tapped', { section: 'new-user', target: 'culture', coming_soon: false });
              router.push('/(app)/culture');
            }}
            onTryConversation={() => {
              track('home_card_tapped', { section: 'new-user', target: 'practice', coming_soon: false });
              router.push('/(app)/practice');
            }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Returning-user branch ──

  // ContinueHero derived values
  const heroProgress =
    resumeDeck && resumeDeck.cards_mastered > 0
      ? resumeDeck.mastery_percentage / 100
      : 0;
  const heroCardsDone = resumeDeck?.cards_mastered ?? 0;
  const heroCardsTotal =
    resumeDeck
      ? Math.round(
          resumeDeck.cards_mastered /
            Math.max(resumeDeck.mastery_percentage / 100, 0.001),
        )
      : 0;
  const heroDueNow = resumeDeck?.cards_due ?? 0;

  // ReviewGoalPair — reviewedToday comes from today.reviews_completed in the
  // progress dashboard response, surfaced via useDashboard().reviewedToday.
  // cardsDueToday acts as the daily goal target (today.cards_due from the backend).

  return (
    <SafeAreaView testID="home-returning" className="flex-1 bg-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* ── Block 1: Greeting header ── */}
        <View testID="block-greeting">
          <GreetingHeader
            greeting={greeting}
            firstName={firstName}
            streak={currentStreak}
            initials={initialsFromName(firstName)}
            onAvatarPress={() => {
              track('home_card_tapped', { section: 'greeting', target: 'profile', coming_soon: false });
              router.push('/(app)/you');
            }}
          />
        </View>

        {/* ── Block 2: Progress band + week heatmap ── */}
        <View testID="block-progress">
          <ProgressBand
            dueToday={cardsDueToday}
            heat={heatmap}
            todayIndex={todayWeekIndex()}
          />
        </View>

        {/* ── Block 3: Continue hero ── */}
        {resumeDeck ? (
          <View testID="block-continue-hero" className="mt-3.5">
            <ContinueHero
              deck={resumeDeck}
              progress={heroProgress}
              cardsDone={heroCardsDone}
              cardsTotal={heroCardsTotal}
              dueNow={heroDueNow}
              onResume={() => {
                // Deck-review detail screen not yet built — toast
                track('home_card_tapped', { section: 'continue', target: 'deck-review', coming_soon: true });
                showComingSoonToast();
              }}
            />
          </View>
        ) : (
          // Reserve nothing when no resume deck — hero simply absent
          <View testID="block-continue-hero-empty" />
        )}

        {/* ── Block 4: ReviewGoalPair ── */}
        <View testID="block-review-goal">
          <ReviewGoalPair
            reviewProps={{
              kicker: "TODAY'S REVIEW",
              icon: <BookOpen size={13} />,
              title: `${cardsDueToday} cards due`,
              body: 'Your active decks are queued up.',
              stat: { value: reviewedToday, label: 'reviewed today' },
            }}
            goalProps={{
              kicker: 'DAILY GOAL',
              icon: <Trophy size={13} />,
              title: `${reviewedToday} / ${cardsDueToday} cards today`,
              body: `${Math.max(0, cardsDueToday - reviewedToday)} more cards to hit your goal.`,
              progress: cardsDueToday > 0 ? reviewedToday / cardsDueToday : 0,
              stat: { value: currentStreak, label: 'day streak 🔥' },
            }}
          />
        </View>

        {/* ── Block 5: What's-new chips ── */}
        <View testID="block-whats-new">
          <WhatsNewChips
            counts={whatsNew}
            onNewsPress={() => {
              track('home_card_tapped', { section: 'whats-new', target: 'culture', coming_soon: false });
              router.push('/(app)/culture');
            }}
            onAudioPress={() => {
              track('home_card_tapped', { section: 'whats-new', target: 'culture-audio', coming_soon: false });
              router.push('/(app)/culture');
            }}
            onComingSoon={() => {
              track('home_card_tapped', { section: 'whats-new', target: 'dialogs', coming_soon: true });
              showComingSoonToast();
            }}
          />
        </View>

        {/* ── Block 6: 2×2 stat grid ── */}
        <View testID="block-stat-grid">
          <StatGrid
            currentStreak={currentStreak}
            masteredCards={masteredCards}
            studyTimeSeconds={studyTimeSeconds}
            cardsDueToday={cardsDueToday}
          />
        </View>

        {/* ── Block 7a: News shelf ── */}
        {newsError ? (
          <View testID="block-shelf-news">
            <SectionError
              testID="section-error-news"
              label="news"
              onRetry={refetchAll}
            />
          </View>
        ) : news.length > 0 ? (
          <View testID="block-shelf-news">
            <Shelf
              kicker="NEWS"
              title="Today's news"
              subtitle="With audio at your level"
              seeAllLabel="All news"
              onSeeAll={() => {
                track('home_card_tapped', { section: 'news', target: 'culture', coming_soon: false });
                router.push('/(app)/culture');
              }}
              data={news}
              renderItem={({ item }) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  onPress={() => {
                    // News detail screen not yet built — toast
                    track('home_card_tapped', { section: 'news', target: 'news-detail', coming_soon: true });
                    showComingSoonToast();
                  }}
                />
              )}
              keyExtractor={(item) => item.id}
              cardWidth={260}
            />
          </View>
        ) : null}

        {/* ── Block 7b: Situations shelf ── */}
        {situationsError ? (
          <View testID="block-shelf-situations">
            <SectionError
              testID="section-error-situations"
              label="practice situations"
              onRetry={refetchAll}
            />
          </View>
        ) : situations.length > 0 ? (
          <View testID="block-shelf-situations">
            <Shelf
              kicker="PRACTICE"
              title="Practice situations"
              subtitle="Real Greek conversations"
              seeAllLabel="All situations"
              onSeeAll={() => {
                track('home_card_tapped', { section: 'situations', target: 'practice', coming_soon: false });
                router.push('/(app)/practice');
              }}
              data={situations}
              renderItem={({ item }) => (
                <SituationCard
                  key={item.id}
                  item={item}
                  onPress={() => {
                    // Situation detail screen not yet built — toast
                    track('home_card_tapped', { section: 'situations', target: 'situation-detail', coming_soon: true });
                    showComingSoonToast();
                  }}
                />
              )}
              keyExtractor={(item) => item.id}
              cardWidth={240}
            />
          </View>
        ) : null}

        {/* ── Block 7c: Decks shelf ── */}
        {decksError ? (
          <View testID="block-shelf-decks">
            <SectionError
              testID="section-error-decks"
              label="decks"
              onRetry={refetchAll}
            />
          </View>
        ) : decks.length > 0 ? (
          <View testID="block-shelf-decks">
            <Shelf
              kicker="YOUR DECKS"
              title="Your decks"
              subtitle="Continue where you left off"
              seeAllLabel="All decks"
              onSeeAll={() => {
                track('home_card_tapped', { section: 'decks', target: 'decks', coming_soon: false });
                router.push('/(app)/decks');
              }}
              data={decks}
              renderItem={({ item }) => (
                <DeckCard
                  key={item.id}
                  deck={item}
                  onPress={() => {
                    // Deck review/study screen not yet built — toast
                    track('home_card_tapped', { section: 'decks', target: 'deck-review', coming_soon: true });
                    showComingSoonToast();
                  }}
                />
              )}
              keyExtractor={(item) => item.id}
              cardWidth={170}
            />
          </View>
        ) : null}

        {/* ── Block 7d: Quick wins shelf ── */}
        <View testID="block-shelf-quick-wins">
          <QuickWinsShelf />
        </View>

        {/* Bottom spacer text for visual orientation (dev only) */}
        {__DEV__ ? (
          <Text className="text-fg3 text-[10px] text-center mt-2 mb-1">
            Dashboard · {decks.length} decks · {news.length} news · {situations.length} situations
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
