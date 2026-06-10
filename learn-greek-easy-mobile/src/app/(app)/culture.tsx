/**
 * CultureScreen — the Culture tab: Cyprus naturalization exam hub (MOB-10).
 *
 * Blocks (top to bottom):
 *   1. Header — mono kicker "CYPRUS NATURALIZATION", "Culture Exam" title (Inter Tight 30),
 *      summary line: "N past exams · M topic areas · target 60% to pass".
 *   2. Readiness card — gradient donut + verdict label + weakest-topics sentence +
 *      "Take mock exam" CTA (coming soon).
 *   3. By topic — CategoryBars for each readiness category.
 *   4. Past exam decks — horizontal rail of ExamDeckCards (each tapped = coming soon).
 *   5. Drill by topic — TopicDrillRows (each tapped = coming soon).
 *
 * Data: useCultureReadiness() + useCultureDecks(). Pull-to-refresh refetches both.
 * Navigation stubs: mock exam, deck detail, drill topics → showComingSoonToast() + analytics.
 *
 * Dark is the product default (controlled by app _layout + NativeWind).
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCultureReadiness } from '@/hooks/use-culture-readiness';
import { useCultureDecks } from '@/hooks/use-culture-decks';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics';
import {
  tintForDeckId,
  verdictLabel,
  weakestTopicLabels,
  categoryLabel,
  SUBTOPICS,
} from '@/lib/culture/presentation';

import { ReadinessDonut } from '@/components/culture/readiness-donut';
import { CategoryBar } from '@/components/culture/category-bar';
import { ExamDeckCard } from '@/components/culture/exam-deck-card';
import { TopicDrillRow } from '@/components/culture/topic-drill-row';

// ---------------------------------------------------------------------------
// CultureScreen
// ---------------------------------------------------------------------------

export default function CultureScreen() {
  const { showComingSoonToast } = useToast();
  const reduceMotion = useReducedMotion();

  const readinessQuery = useCultureReadiness();
  const decksQuery = useCultureDecks();

  // ── Pull-to-refresh ──
  const [refreshing, setRefreshing] = useState(false);
  const isRefreshing = useRef(false);
  const handleRefresh = useCallback(async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;
    setRefreshing(true);
    try {
      await Promise.all([readinessQuery.refetch(), decksQuery.refetch()]);
    } finally {
      isRefreshing.current = false;
      setRefreshing(false);
    }
  }, [readinessQuery, decksQuery]);

  // ── Analytics: culture_screen_viewed (once, after data resolves) ──
  const viewedFired = useRef(false);
  useEffect(() => {
    if (readinessQuery.data && !viewedFired.current) {
      viewedFired.current = true;
      track('culture_screen_viewed', {
        overall_pct: readinessQuery.data.readiness_percentage,
        verdict: readinessQuery.data.verdict,
      });
    }
  }, [readinessQuery.data]);

  // ── Coming-soon handlers ──
  const handleMockExamPress = useCallback(() => {
    track('culture_mock_exam_tapped', { coming_soon: true });
    showComingSoonToast();
  }, [showComingSoonToast]);

  const handleDeckPress = useCallback(
    (id: string) => {
      track('culture_exam_deck_tapped', { deck_id: id, coming_soon: true });
      showComingSoonToast();
    },
    [showComingSoonToast],
  );

  const handleDrillPress = useCallback(
    (id: string) => {
      track('culture_drill_topic_tapped', { topic_id: id, coming_soon: true });
      showComingSoonToast();
    },
    [showComingSoonToast],
  );

  const isLoading = readinessQuery.isLoading || decksQuery.isLoading;
  const isError = (readinessQuery.isError || decksQuery.isError) && !isLoading;

  // ── Error state ──
  if (isError) {
    return (
      <SafeAreaView
        testID="culture-error"
        className="flex-1 bg-bg items-center justify-center px-8"
      >
        <Text className="text-fg2 text-[15px] text-center mb-5">
          Couldn&apos;t load exam data.
        </Text>
        <Pressable
          testID="culture-error-retry"
          onPress={() => {
            void readinessQuery.refetch();
            void decksQuery.refetch();
          }}
          className="px-6 py-3 rounded-xl bg-card border border-line active:opacity-70"
        >
          <Text className="text-primary text-[14px] font-semibold">Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <SafeAreaView testID="culture-loading" className="flex-1 bg-bg">
        <View className="px-[18px] pt-14 gap-3">
          <View className="w-32 h-3 rounded-full bg-bg-2" />
          <View className="w-36 h-8 rounded-lg bg-bg-2" />
          <View className="rounded-[20px] bg-bg-2" style={{ height: 160 }} />
          <View className="rounded-[16px] bg-bg-2" style={{ height: 120 }} />
        </View>
      </SafeAreaView>
    );
  }

  const readiness = readinessQuery.data!;
  const decks = decksQuery.data?.decks ?? [];

  // Normalize overall from 0–100 → 0–1
  const overallPct = readiness.readiness_percentage / 100;
  const verdict = verdictLabel(readiness.verdict);
  const weakest = weakestTopicLabels(readiness.categories);
  const weakestSentence =
    weakest.length >= 2
      ? `Focus on ${weakest[0]} and ${weakest[1]} — your two weakest topics.`
      : weakest.length === 1
        ? `Focus on ${weakest[0]} — your weakest topic.`
        : 'Keep practising all topics.';

  return (
    <SafeAreaView testID="culture-screen" className="flex-1 bg-bg" edges={['top']}>
      <ScrollView
        testID="culture-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* ── Block 1: Header ── */}
        <View className="px-[18px] pt-14 pb-0">
          <Text
            className="text-fg3"
            style={{
              fontFamily: 'SpaceMono_400Regular',
              fontSize: 10.5,
              fontWeight: '700',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}
          >
            Cyprus naturalization
          </Text>
          <Text
            testID="culture-title"
            className="text-fg mt-1"
            style={{
              fontFamily: 'InterTight_700Bold',
              fontSize: 30,
              fontWeight: '700',
              letterSpacing: -0.6,
              lineHeight: 34,
            }}
          >
            Culture Exam
          </Text>
          <Text
            testID="culture-subtitle"
            className="text-fg2 mt-1.5"
            style={{ fontSize: 13.5, lineHeight: 20, maxWidth: 320 }}
          >
            {decks.length} past exams · {readiness.categories.length} topic areas · target 60% to pass
          </Text>
        </View>

        {/* ── Block 2: Readiness card ── */}
        <View className="px-[18px] pt-5">
          <View
            testID="culture-readiness-card"
            className="p-5 bg-card border border-line rounded-[20px] flex-row gap-[18px] items-center"
          >
            <ReadinessDonut pct={overallPct} reduceMotion={reduceMotion} />
            <View className="flex-1 min-w-0">
              <Text
                className="text-fg3 mb-1"
                style={{
                  fontFamily: 'SpaceMono_400Regular',
                  fontSize: 10.5,
                  fontWeight: '700',
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                Exam readiness
              </Text>
              <Text
                testID="culture-verdict"
                className="text-fg mb-2"
                style={{
                  fontFamily: 'InterTight_700Bold',
                  fontSize: 19,
                  fontWeight: '700',
                  letterSpacing: -0.4,
                  lineHeight: 23,
                }}
              >
                {verdict}
              </Text>
              <Text
                className="text-fg2 mb-[14px]"
                style={{ fontSize: 12.5, lineHeight: 18 }}
              >
                {weakestSentence}
              </Text>
              <Pressable
                testID="culture-mock-exam-cta"
                onPress={handleMockExamPress}
                className="self-start flex-row items-center gap-1.5 px-[14px] rounded-full bg-primary active:opacity-75"
                style={{ height: 36 }}
              >
                <Text
                  style={{
                    color: 'rgb(255,255,255)',
                    fontFamily: 'SplineSans_600SemiBold',
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  Take mock exam
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Block 3: By topic ── */}
        <View className="px-[18px] pt-5">
          <Text
            className="text-fg mb-[14px]"
            style={{
              fontFamily: 'InterTight_700Bold',
              fontSize: 17,
              fontWeight: '700',
              letterSpacing: -0.2,
            }}
          >
            By topic
          </Text>
          <View
            testID="culture-category-bars"
            className="px-[18px] py-4 bg-card border border-line rounded-[16px] gap-[14px]"
          >
            {readiness.categories.map((cat) => (
              <CategoryBar
                key={cat.category}
                label={categoryLabel(cat.category)}
                pct={cat.readiness_percentage / 100}
              />
            ))}
          </View>
        </View>

        {/* ── Block 4: Past exam decks ── */}
        {decks.length > 0 && (
          <View className="pt-6">
            <View className="px-[18px] pb-3 flex-row items-baseline justify-between">
              <Text
                className="text-fg"
                style={{
                  fontFamily: 'InterTight_700Bold',
                  fontSize: 17,
                  fontWeight: '700',
                  letterSpacing: -0.2,
                }}
              >
                Past exam decks
              </Text>
              <Text className="text-fg3" style={{ fontSize: 12 }}>
                {decks.length} decks
              </Text>
            </View>
            <ScrollView
              testID="culture-decks-rail"
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 18, paddingBottom: 4 }}
            >
              {decks.map((deck) => (
                <ExamDeckCard
                  key={deck.id}
                  deck={deck}
                  tint={tintForDeckId(deck.id)}
                  onPress={handleDeckPress}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Block 5: Drill by topic ── */}
        <View className="px-[18px] pt-6">
          <Text
            className="text-fg mb-3"
            style={{
              fontFamily: 'InterTight_700Bold',
              fontSize: 17,
              fontWeight: '700',
              letterSpacing: -0.2,
            }}
          >
            Drill by topic
          </Text>
          <View testID="culture-drill-rows" className="gap-[10px]">
            {SUBTOPICS.map((subtopic) => (
              <TopicDrillRow
                key={subtopic.id}
                subtopic={subtopic}
                onPress={handleDrillPress}
              />
            ))}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
