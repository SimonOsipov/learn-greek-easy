/**
 * DeckDetailScreen — /decks/[deckId] (MOB-07, design_handoff_decks › Deck detail).
 *
 * A pushed root-stack route (no tab bar — registered in src/app/_layout.tsx
 * inside the signed-in Stack.Protected block). Blocks, top to bottom:
 *   1. Cover hero — full-bleed deck gradient, Greek monogram watermark,
 *      circular back button, "LEVEL · N CARDS" kicker, title, Greek subtitle,
 *      one-line description.
 *   2. StatsStrip (Due / Mastered / Cards) overlapping the hero by 12px.
 *   3. "Words in this deck" heading + word count.
 *   4. Word list — bordered card of WordRows (article badge, lemma,
 *      pronunciation + gloss, NEW/LEARNING/MASTERED status).
 *   5. Sticky "Practice N cards" CTA over a bottom fade.
 *
 * Coming-soon placeholders (red-dot convention + toast):
 *   - The card-review flow the CTA launches is a follow-up ticket — the CTA
 *     carries a "Coming soon" dot label and fires the toast.
 *   - Per-word detail is out of scope — word rows fire the toast.
 *
 * Data: useDeck + useDeckWords + useDeckWordMastery, plus useDeckProgress for
 * the same due/mastered counts the dashboard and library use.
 */
import { useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Play } from 'lucide-react-native';

import { useDeck, useDeckWords, useDeckWordMastery } from '@/hooks/use-deck-detail';
import { useDeckProgress } from '@/hooks/use-deck-progress';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics';
import { coverForDeckId, CTA_GRADIENT, wordStatus } from '@/lib/decks/presentation';
import { StatsStrip } from '@/components/decks/stats-strip';
import { WordRow } from '@/components/decks/word-row';
import { ComingSoonDot } from '@/components/dashboard/coming-soon-dot';

// on-photo white at fixed alphas — over-gradient hero text (MOB-13: no /NN modifiers)
const HERO_WHITE = 'rgba(255,255,255,0.96)';

export default function DeckDetailScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showComingSoonToast } = useToast();

  const deckQuery = useDeck(deckId);
  const wordsQuery = useDeckWords(deckId);
  const masteryQuery = useDeckWordMastery(deckId);
  const progressQuery = useDeckProgress();

  const deck = deckQuery.data;
  const words = wordsQuery.data ?? [];
  const masteryById = new Map(
    (masteryQuery.data?.items ?? []).map((m) => [m.word_entry_id, m]),
  );
  const progress = (progressQuery.data?.decks ?? []).find((p) => p.deck_id === deckId);

  // ── Analytics: deck_detail_viewed (once per mount, after the deck resolves) ──
  const viewedFired = useRef(false);
  useEffect(() => {
    if (deck && !viewedFired.current) {
      viewedFired.current = true;
      track('deck_detail_viewed', { deck_id: deck.id, level: deck.level });
    }
  }, [deck]);

  const handleWordPress = useCallback(() => {
    track('deck_word_tapped', { deck_id: deckId, coming_soon: true });
    showComingSoonToast();
  }, [deckId, showComingSoonToast]);

  const handlePractice = useCallback(() => {
    track('deck_practice_tapped', { deck_id: deckId, coming_soon: true });
    showComingSoonToast();
  }, [deckId, showComingSoonToast]);

  // ── Error state (deck fetch failed) ──
  if (deckQuery.isError && !deckQuery.isLoading) {
    return (
      <View
        testID="deck-detail-error"
        className="flex-1 bg-bg items-center justify-center px-8"
      >
        <Text className="text-fg2 text-[15px] text-center mb-5">
          Couldn&apos;t load this deck.
        </Text>
        <Pressable
          testID="deck-detail-retry"
          onPress={() => deckQuery.refetch()}
          className="px-6 py-3 rounded-xl bg-card border border-line active:opacity-70"
        >
          <Text className="text-primary text-[14px] font-semibold">Retry</Text>
        </Pressable>
        <Pressable
          testID="deck-detail-error-back"
          onPress={() => router.back()}
          className="mt-3 px-6 py-3 active:opacity-70"
        >
          <Text className="text-fg3 text-[14px]">Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Loading state ──
  if (!deck) {
    return (
      <View testID="deck-detail-loading" className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const cover = coverForDeckId(deck.id) as unknown as [string, string];
  const mark = (deck.name_el ?? deck.name).slice(0, 2);
  const due = progress?.cards_due ?? 0;
  // Mastered WORDS (not typed cards) — same unit as the Cards stat and the
  // same word-mastery source the list statuses below use. progress.cards_mastered
  // counts V2 typed cards and can exceed card_count (verified on-sim).
  const mastered = (masteryQuery.data?.items ?? []).filter(
    (m) => wordStatus(m) === 'mastered',
  ).length;

  return (
    <View testID="deck-detail-screen" className="flex-1 bg-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        {/* ── Cover hero ── */}
        <LinearGradient
          testID="deck-detail-hero"
          colors={cover}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 10,
            paddingHorizontal: 18,
            paddingBottom: 34,
            overflow: 'hidden',
          }}
        >
          {/* Watermark monogram */}
          <Text
            className="absolute text-on-photo-14 text-[220px] leading-none tracking-tight"
            style={{ fontFamily: 'InterTight_700Bold', right: -30, top: 30 }}
          >
            {mark}
          </Text>

          {/* Back button */}
          <Pressable
            testID="deck-detail-back"
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-on-photo-scrim-42 items-center justify-center mb-[18px] active:opacity-70"
          >
            <ChevronLeft size={20} color={HERO_WHITE} strokeWidth={2.2} />
          </Pressable>

          <Text
            testID="deck-detail-kicker"
            className="text-on-photo-78 text-[11px] font-bold tracking-[0.12em] uppercase"
            style={{ fontFamily: 'SpaceMono_400Regular' }}
          >
            {deck.level} · {deck.card_count} cards
          </Text>
          <Text
            testID="deck-detail-title"
            className="text-on-photo-96 text-[32px] font-bold tracking-tight leading-tight mt-1.5"
            style={{ fontFamily: 'InterTight_700Bold' }}
          >
            {deck.name}
          </Text>
          {deck.name_el ? (
            <Text
              testID="deck-detail-title-el"
              className="text-on-photo-85 text-[17px] mt-1"
              style={{ fontFamily: 'NotoSerif_400Regular' }}
            >
              {deck.name_el}
            </Text>
          ) : null}
          {deck.description ? (
            <Text
              testID="deck-detail-desc"
              className="text-on-photo-92 text-[14px] leading-[21px] mt-3.5 max-w-[320px]"
            >
              {deck.description}
            </Text>
          ) : null}
        </LinearGradient>

        {/* ── Stats strip (overlaps hero by 12px) ── */}
        <View className="mx-3.5 -mt-3">
          <StatsStrip due={due} mastered={mastered} cards={deck.card_count} />
        </View>

        {/* ── Words heading ── */}
        <View className="px-[18px] pt-6 pb-2.5 flex-row items-baseline justify-between">
          <Text
            className="text-fg text-[17px] font-bold tracking-tight"
            style={{ fontFamily: 'InterTight_700Bold' }}
          >
            Words in this deck
          </Text>
          <Text testID="deck-detail-word-count" className="text-fg3 text-[12px]">
            {words.length} {words.length === 1 ? 'word' : 'words'}
          </Text>
        </View>

        {/* ── Word list ── */}
        <View className="mx-3.5">
          {wordsQuery.isLoading ? (
            <View
              testID="deck-words-loading"
              className="bg-card border border-line rounded-2xl items-center py-8"
            >
              <ActivityIndicator />
            </View>
          ) : wordsQuery.isError ? (
            <View className="bg-card border border-line rounded-2xl items-center py-6 px-4">
              <Text className="text-fg2 text-[13px] mb-3">Couldn&apos;t load the words.</Text>
              <Pressable
                testID="deck-words-retry"
                onPress={() => wordsQuery.refetch()}
                className="active:opacity-70"
              >
                <Text className="text-primary text-[13px] font-semibold">Retry</Text>
              </Pressable>
            </View>
          ) : words.length === 0 ? (
            <View className="bg-card border border-line rounded-2xl items-center py-6 px-4">
              <Text testID="deck-words-empty" className="text-fg3 text-[13px]">
                No words in this deck yet
              </Text>
            </View>
          ) : (
            <View className="bg-card border border-line rounded-2xl overflow-hidden">
              {words.map((word, index) => (
                <WordRow
                  key={word.id}
                  word={word}
                  status={wordStatus(masteryById.get(word.id))}
                  showDivider={index < words.length - 1}
                  onPress={handleWordPress}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky bottom CTA ── */}
      <View
        className="absolute left-0 right-0 bottom-0 bg-bg px-[18px] pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {/* Review flow is a follow-up ticket — honest coming-soon marker */}
        <View className="flex-row items-center justify-center gap-1.5 mb-2">
          <ComingSoonDot />
          <Text
            testID="deck-cta-coming-soon"
            className="text-danger text-[10px] uppercase tracking-widest"
            style={{ fontFamily: 'SpaceMono_400Regular' }}
          >
            Coming soon
          </Text>
        </View>
        <Pressable
          testID="deck-practice-cta"
          accessibilityRole="button"
          onPress={handlePractice}
          className="active:opacity-80"
        >
          <LinearGradient
            colors={CTA_GRADIENT as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              height: 52,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Play size={16} color={HERO_WHITE} fill={HERO_WHITE} />
            <Text className="text-on-photo-96 text-[16px] font-bold tracking-tight">
              Practice {deck.card_count} cards
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
