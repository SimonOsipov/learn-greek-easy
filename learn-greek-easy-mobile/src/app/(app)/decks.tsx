/**
 * DecksScreen — the Decks tab: a filterable 2-up library of deck covers
 * (MOB-07, design_handoff_decks › Decks index).
 *
 * Blocks:
 *   1. Header — mono kicker "YOUR LIBRARY", "Decks" title (Inter Tight 30),
 *      count line "N decks · M active" (active = 0 < progress < 1).
 *   2. FilterRail — All · Active · A1 · A2 · B1 · B2; local UI state, filters
 *      the already-fetched list in place.
 *   3. 2-up deck grid (FlatList numColumns=2) of DeckGridCards.
 *
 * Data: useDecks() joined with useDeckProgress() — the same two reads the
 * dashboard deck shelf uses. Pull-to-refresh refetches both. Tapping a card
 * pushes the deck-detail route (/decks/[deckId], root stack — no tab bar).
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useDecks } from '@/hooks/use-decks';
import { useDeckProgress } from '@/hooks/use-deck-progress';
import { track } from '@/lib/analytics';
import {
  deckProgressRatio,
  filterDecks,
  type DeckFilter,
} from '@/lib/decks/presentation';
import { DeckGridCard } from '@/components/decks/deck-grid-card';
import { FilterRail } from '@/components/decks/filter-rail';
import type { DeckResponse } from '@/types/deck';
import type { DeckProgressSummary } from '@/types/dashboard';

interface LibraryItem {
  deck: DeckResponse;
  progressRatio: number;
  due: number;
}

/** Empty-state copy per filter (handoff: "No decks at this level yet"). */
function emptyCopyFor(filter: DeckFilter): string {
  if (filter === 'All') return 'No decks yet';
  if (filter === 'Active') return 'No decks in progress yet';
  return 'No decks at this level yet';
}

export default function DecksScreen() {
  const router = useRouter();
  const decksQuery = useDecks();
  const progressQuery = useDeckProgress();

  const [filter, setFilter] = useState<DeckFilter>('All');

  // ── Join decks with per-deck progress ──
  const items: LibraryItem[] = useMemo(() => {
    const progressById = new Map<string, DeckProgressSummary>(
      (progressQuery.data?.decks ?? []).map((p) => [p.deck_id, p]),
    );
    return (decksQuery.data?.decks ?? []).map((deck) => {
      const progress = progressById.get(deck.id);
      return {
        deck,
        progressRatio: deckProgressRatio(deck, progress),
        due: progress?.cards_due ?? 0,
      };
    });
  }, [decksQuery.data, progressQuery.data]);

  const activeCount = items.filter((i) => i.progressRatio > 0 && i.progressRatio < 1).length;
  const filtered = filterDecks(items, filter);
  // Pad odd-length lists with an invisible spacer so the last real card keeps
  // its half-row width instead of stretching across the full row (numColumns=2).
  const gridData: (LibraryItem | null)[] =
    filtered.length % 2 === 1 ? [...filtered, null] : filtered;

  // ── Pull-to-refresh ──
  const [refreshing, setRefreshing] = useState(false);
  const isRefreshing = useRef(false);
  const handleRefresh = useCallback(async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;
    setRefreshing(true);
    try {
      await Promise.allSettled([decksQuery.refetch(), progressQuery.refetch()]);
    } finally {
      isRefreshing.current = false;
      setRefreshing(false);
    }
  }, [decksQuery, progressQuery]);

  // ── Analytics: decks_screen_viewed (once, after the list resolves) ──
  const viewedFired = useRef(false);
  useEffect(() => {
    if (decksQuery.data && !viewedFired.current) {
      viewedFired.current = true;
      track('decks_screen_viewed', { deck_count: decksQuery.data.decks.length });
    }
  }, [decksQuery.data]);

  const handleFilterSelect = useCallback((next: DeckFilter) => {
    setFilter(next);
    track('decks_filter_changed', { filter: next });
  }, []);

  const handleCardPress = useCallback(
    (id: string) => {
      track('deck_card_tapped', { deck_id: id, source: 'library' });
      router.push(`/decks/${id}`);
    },
    [router],
  );

  // ── Error state (deck list failed — nothing to render) ──
  if (decksQuery.isError && !decksQuery.isLoading) {
    return (
      <SafeAreaView testID="decks-error" className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-fg2 text-[15px] text-center mb-5">
          Couldn&apos;t load your decks.
        </Text>
        <Pressable
          testID="decks-error-retry"
          onPress={() => decksQuery.refetch()}
          className="px-6 py-3 rounded-xl bg-card border border-line active:opacity-70"
        >
          <Text className="text-primary text-[14px] font-semibold">Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Loading state — quiet cover-shaped placeholders ──
  if (decksQuery.isLoading) {
    return (
      <SafeAreaView testID="decks-loading" className="flex-1 bg-bg">
        <View className="px-[18px] pt-4">
          <View className="w-24 h-3 rounded-full bg-bg-2" />
          <View className="w-32 h-8 rounded-lg bg-bg-2 mt-2" />
          <View className="flex-row gap-3 mt-6">
            <View className="flex-1 rounded-2xl bg-bg-2" style={{ aspectRatio: 1 / 1.05 }} />
            <View className="flex-1 rounded-2xl bg-bg-2" style={{ aspectRatio: 1 / 1.05 }} />
          </View>
          <View className="flex-row gap-3 mt-3">
            <View className="flex-1 rounded-2xl bg-bg-2" style={{ aspectRatio: 1 / 1.05 }} />
            <View className="flex-1 rounded-2xl bg-bg-2" style={{ aspectRatio: 1 / 1.05 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="decks-screen" className="flex-1 bg-bg" edges={['top']}>
      <FlatList
        testID="decks-grid"
        data={gridData}
        keyExtractor={(item, index) => item?.deck.id ?? `spacer-${index}`}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 18 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          <View>
            {/* ── Header ── */}
            <View className="px-[18px] pt-2">
              <Text
                className="text-fg3 text-[10.5px] font-bold tracking-[0.12em] uppercase"
                style={{ fontFamily: 'SpaceMono_400Regular' }}
              >
                Your library
              </Text>
              <Text
                testID="decks-title"
                className="text-fg text-[30px] font-bold tracking-tight leading-tight mt-1"
                style={{ fontFamily: 'InterTight_700Bold' }}
              >
                Decks
              </Text>
              <Text testID="decks-count" className="text-fg2 text-[13px] mt-1.5">
                {items.length} {items.length === 1 ? 'deck' : 'decks'} · {activeCount} active
              </Text>
            </View>

            {/* ── Filter rail ── */}
            <FilterRail selected={filter} onSelect={handleFilterSelect} />
            <View className="h-2" />
          </View>
        }
        ListEmptyComponent={
          <Text testID="decks-empty" className="text-fg3 text-[13px] px-[18px] pt-4">
            {emptyCopyFor(filter)}
          </Text>
        }
        renderItem={({ item }) =>
          item ? (
            <DeckGridCard
              deck={item.deck}
              progressRatio={item.progressRatio}
              due={item.due}
              onPress={handleCardPress}
            />
          ) : (
            <View className="flex-1" />
          )
        }
      />
    </SafeAreaView>
  );
}
