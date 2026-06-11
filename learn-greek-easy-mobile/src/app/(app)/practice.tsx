/**
 * PracticeScreen — the Practice tab: a filterable list of situation cards (MOB-08).
 *
 * Blocks:
 *   1. Header — mono kicker "REAL CONVERSATIONS", "Practice" title (Inter Tight 30),
 *      one-line description.
 *   2. SituationFilterRail — All · Ready · In progress · Completed; local UI state.
 *   3. Vertical stack of SituationCards, each pushing to the situation flow.
 *
 * Data: useSituations(). Pull-to-refresh refetches.
 * Tapping a card pushes the situation flow route (/situations/[situationId]).
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useSituations } from '@/hooks/use-situations';
import { track } from '@/lib/analytics';
import {
  clientStatusFor,
  type SituationFilter,
} from '@/lib/situations/presentation';
import { SituationFilterRail } from '@/components/situations/filter-rail';
import { SituationCard } from '@/components/situations/situation-card';
import type { SituationItem } from '@/types/situation';

function emptyCopyFor(filter: SituationFilter): string {
  if (filter === 'All') return 'No situations yet';
  if (filter === 'Ready') return 'No situations ready yet';
  if (filter === 'In progress') return 'No situations in progress yet';
  if (filter === 'Completed') return 'No completed situations yet';
  return 'No situations yet';
}

/**
 * Client-side filter — matches the SituationFilterRail pills.
 *
 * Only status-based filters are supported: All / Ready / In progress / Completed.
 * Level filters (B1/B2/A2) have been removed because LearnerSituationListItem
 * does not include a `level` field; adding them back requires a backend change.
 * analytics: practice_filter_changed payload key `filter` now uses these values.
 */
function filterSituations(items: SituationItem[], filter: SituationFilter): SituationItem[] {
  if (filter === 'All') return items;
  if (filter === 'Ready') {
    return items.filter(
      (s) => clientStatusFor(s.exercise_completed, s.exercise_total) === 'Ready',
    );
  }
  if (filter === 'In progress') {
    return items.filter(
      (s) => clientStatusFor(s.exercise_completed, s.exercise_total) === 'In progress',
    );
  }
  if (filter === 'Completed') {
    return items.filter(
      (s) => clientStatusFor(s.exercise_completed, s.exercise_total) === 'Completed',
    );
  }
  return items;
}

export default function PracticeScreen() {
  const router = useRouter();
  const situationsQuery = useSituations();

  const [filter, setFilter] = useState<SituationFilter>('All');

  const items = situationsQuery.data?.items ?? [];
  const filtered = filterSituations(items, filter);

  // ── Pull-to-refresh ──
  const [refreshing, setRefreshing] = useState(false);
  const isRefreshing = useRef(false);
  const handleRefresh = useCallback(async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;
    setRefreshing(true);
    try {
      await situationsQuery.refetch();
    } finally {
      isRefreshing.current = false;
      setRefreshing(false);
    }
  }, [situationsQuery]);

  // ── Analytics: practice_screen_viewed (once, after data resolves) ──
  const viewedFired = useRef(false);
  useEffect(() => {
    if (situationsQuery.data && !viewedFired.current) {
      viewedFired.current = true;
      track('practice_screen_viewed', { situation_count: situationsQuery.data.items.length });
    }
  }, [situationsQuery.data]);

  const handleFilterSelect = useCallback((next: SituationFilter) => {
    setFilter(next);
    track('practice_filter_changed', { filter: next });
  }, []);

  const handleCardPress = useCallback(
    (id: string) => {
      track('situation_card_tapped', { situation_id: id, source: 'practice_list' });
      router.push(`/situations/${id}`);
    },
    [router],
  );

  // ── Error state ──
  if (situationsQuery.isError && !situationsQuery.isLoading) {
    return (
      <SafeAreaView
        testID="practice-error"
        className="flex-1 bg-bg items-center justify-center px-8"
      >
        <Text className="text-fg2 text-[15px] text-center mb-5">
          Couldn&apos;t load situations.
        </Text>
        <Pressable
          testID="practice-error-retry"
          onPress={() => situationsQuery.refetch()}
          className="px-6 py-3 rounded-xl bg-card border border-line active:opacity-70"
        >
          <Text className="text-primary text-[14px] font-semibold">Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Loading state ──
  if (situationsQuery.isLoading) {
    return (
      <SafeAreaView testID="practice-loading" className="flex-1 bg-bg">
        <View className="px-[18px] pt-4 gap-3">
          <View className="w-28 h-3 rounded-full bg-bg-2" />
          <View className="w-32 h-8 rounded-lg bg-bg-2" />
          {[1, 2, 3].map((i) => (
            <View key={i} className="rounded-[18px] bg-bg-2" style={{ height: 100 }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="practice-screen" className="flex-1 bg-bg" edges={['top']}>
      <FlatList
        testID="practice-list"
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 18, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          <View>
            {/* ── Header ── */}
            <View className="pt-2 pb-0">
              <Text
                className="text-fg3 text-[10.5px] font-bold tracking-[0.12em] uppercase"
                style={{ fontFamily: 'SpaceMono_400Regular' }}
              >
                Real conversations
              </Text>
              <Text
                testID="practice-title"
                className="text-fg text-[30px] font-bold tracking-tight leading-tight mt-1"
                style={{ fontFamily: 'InterTight_700Bold' }}
              >
                Practice
              </Text>
              <Text className="text-fg2 text-[13.5px] leading-[20px] mt-1.5" style={{ maxWidth: 320 }}>
                Cyprus stories, retold at your level. Listen, read, then answer questions.
              </Text>
            </View>

            {/* ── Filter rail ── */}
            <View className="-mx-[18px]">
              <SituationFilterRail selected={filter} onSelect={handleFilterSelect} />
            </View>
            <View className="h-1" />
          </View>
        }
        ListEmptyComponent={
          <Text testID="practice-empty" className="text-fg3 text-[13px] pt-4">
            {emptyCopyFor(filter)}
          </Text>
        }
        renderItem={({ item }) => (
          <SituationCard
            item={item}
            onPress={handleCardPress}
          />
        )}
      />
    </SafeAreaView>
  );
}
