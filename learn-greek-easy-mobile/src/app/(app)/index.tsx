/**
 * HomeScreen — the main dashboard screen (DASH-09).
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
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpen, Trophy } from 'lucide-react-native';

import { useDashboard } from '@/hooks/use-dashboard';
import { useToast } from '@/components/ui/toast';

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

  const {
    greeting,
    firstName,
    currentStreak,
    cardsDueToday,
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
  } = useDashboard();

  // ── Loading state ──
  // While isLoading is true, isNewUser is undefined. Render nothing
  // to prevent a flash of the wrong layout branch.
  if (isLoading || isNewUser === undefined) {
    return (
      <SafeAreaView testID="home-loading" className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator />
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
        >
          {/* Block 1: Greeting (streak = 0 for new user) */}
          <GreetingHeader
            greeting={greeting}
            firstName={firstName}
            streak={0}
            initials={initialsFromName(firstName)}
            onAvatarPress={() => router.push('/(app)/you')}
          />

          {/* New-user chooser block */}
          <NewUserStart
            onPickDeck={() => router.push('/(app)/decks')}
            onReadArticle={() => router.push('/(app)/culture')}
            onTryConversation={() => router.push('/(app)/practice')}
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

  // ReviewGoalPair data — read daily_goal from the progress model (cardsDueToday
  // is the raw due count; daily_goal comes from progressQuery.data.today.daily_goal,
  // but useDashboard doesn't expose it directly — use cardsDueToday as done count
  // and a static fallback; actual daily_goal surfaced via the hook's cardsDueToday).
  // NOTE: useDashboard exposes cardsDueToday as the count of cards due today.
  // The daily_goal field from the backend today.daily_goal is not separately
  // surfaced in the view model. Per the design spec the goal card reads
  // "{cardsDueToday} / {daily_goal} cards today". We use cardsDueToday for both
  // the "done" value and expose 0 as the reviewed count (no separate tracking
  // yet). The daily_goal value isn't in the DashboardViewModel — we show
  // cardsDueToday as the daily target and streak as the stat.
  const reviewedToday = 0; // reviewed count not in VM; placeholder until a future subtask

  return (
    <SafeAreaView testID="home-returning" className="flex-1 bg-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 }}
      >
        {/* ── Block 1: Greeting header ── */}
        <View testID="block-greeting">
          <GreetingHeader
            greeting={greeting}
            firstName={firstName}
            streak={currentStreak}
            initials={initialsFromName(firstName)}
            onAvatarPress={() => router.push('/(app)/you')}
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
            onNewsPress={() => router.push('/(app)/culture')}
            onAudioPress={() => router.push('/(app)/culture')}
            onComingSoon={showComingSoonToast}
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
        {news.length > 0 ? (
          <View testID="block-shelf-news">
            <Shelf
              kicker="NEWS"
              title="Today's news"
              subtitle="With audio at your level"
              seeAllLabel="All news"
              onSeeAll={() => router.push('/(app)/culture')}
              data={news}
              renderItem={({ item }) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  onPress={() => {
                    // News detail screen not yet built — toast
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
        {situations.length > 0 ? (
          <View testID="block-shelf-situations">
            <Shelf
              kicker="PRACTICE"
              title="Practice situations"
              subtitle="Real Greek conversations"
              seeAllLabel="All situations"
              onSeeAll={() => router.push('/(app)/practice')}
              data={situations}
              renderItem={({ item }) => (
                <SituationCard
                  key={item.id}
                  item={item}
                  onPress={() => {
                    // Situation detail screen not yet built — toast
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
        {decks.length > 0 ? (
          <View testID="block-shelf-decks">
            <Shelf
              kicker="YOUR DECKS"
              title="Your decks"
              subtitle="Continue where you left off"
              seeAllLabel="All decks"
              onSeeAll={() => router.push('/(app)/decks')}
              data={decks}
              renderItem={({ item }) => (
                <DeckCard
                  key={item.id}
                  deck={item}
                  onPress={() => {
                    // Deck review/study screen not yet built — toast
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
