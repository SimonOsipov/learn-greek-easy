/**
 * Shelf — reusable horizontal FlatList wrapper for dashboard content rows.
 *
 * Renders:
 *   1. A Kicker eyebrow label (with optional red-dot via comingSoon).
 *   2. An optional title + subtitle header + optional "see all" affordance.
 *   3. A horizontal FlatList with snap-to-card and peek of next card.
 *
 * Snap behaviour:
 *   snapToInterval = cardWidth + GAP  (constant gap between cards)
 *   decelerationRate = "fast"
 *   Horizontal padding so the rightmost visible card peeks at the next one.
 *
 * Pure presentational — no hooks, no navigation. Parent passes onSeeAll.
 *
 * Design reference: Dashboard Mock.html › ShelfRow.
 */
import { View, Text, FlatList, Pressable } from 'react-native';
import type { ListRenderItem } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Kicker } from '@/components/dashboard/kicker';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Inter-card gap used by the snap calculation and contentContainerStyle. */
export const SHELF_CARD_GAP = 12;

/** Left-edge padding — aligns with the dashboard gutter (18 px). */
export const SHELF_PADDING_H = 18;

/** Right-side peek amount — how much of the next card is revealed. */
export const SHELF_PEEK = 24;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ShelfProps<T> {
  /** Eyebrow kicker label (uppercase mono). */
  kicker: string;
  /** When true, renders the ComingSoonDot + "Coming soon" micro-label. */
  comingSoon?: boolean;

  /** Section title (Inter Tight bold). */
  title: string;
  /** Optional subtitle below the title. */
  subtitle?: string;

  /** Label for the "see all" action link. If omitted, no link is rendered. */
  seeAllLabel?: string;
  /** Called when the "see all" link is pressed. */
  onSeeAll?: () => void;

  /** Data array passed to FlatList. */
  data: T[];
  /** FlatList renderItem. */
  renderItem: ListRenderItem<T>;
  /** FlatList keyExtractor. */
  keyExtractor: (item: T, index: number) => string;

  /**
   * Width of each card in pixels.
   * Used to compute snapToInterval = cardWidth + SHELF_CARD_GAP.
   */
  cardWidth: number;
}

// ---------------------------------------------------------------------------
// Shelf
// ---------------------------------------------------------------------------

/**
 * Reusable horizontal scrolling shelf used by all four dashboard content rows.
 *
 * Usage:
 *   <Shelf
 *     kicker="NEWS"
 *     title="Today's news · Cyprus"
 *     subtitle="With audio at your level"
 *     seeAllLabel="All news"
 *     onSeeAll={() => router.push('/(app)/culture')}
 *     data={news}
 *     renderItem={({ item }) => <NewsCard item={item} onPress={...} />}
 *     keyExtractor={(item) => item.id}
 *     cardWidth={260}
 *   />
 */
export function Shelf<T>({
  kicker,
  comingSoon,
  title,
  subtitle,
  seeAllLabel,
  onSeeAll,
  data,
  renderItem,
  keyExtractor,
  cardWidth,
}: ShelfProps<T>) {
  const snapInterval = cardWidth + SHELF_CARD_GAP;

  return (
    <View testID="shelf" className="mt-[22px]">
      {/* ── Kicker eyebrow ── */}
      <View className="px-[18px] mb-1">
        <Kicker comingSoon={comingSoon}>{kicker}</Kicker>
      </View>

      {/* ── Section header ── */}
      <View
        testID="shelf-header"
        className="flex-row items-end justify-between px-[18px] mb-3 gap-3"
      >
        <View className="flex-1 min-w-0">
          <Text
            testID="shelf-title"
            className="text-fg text-[18px] font-bold tracking-tight leading-none"
            style={{ fontFamily: 'InterTight_700Bold' }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              testID="shelf-subtitle"
              className="text-fg3 text-[12px] mt-[3px] leading-snug"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {seeAllLabel && onSeeAll ? (
          <Pressable
            testID="shelf-see-all"
            onPress={onSeeAll}
            className="flex-row items-center gap-0.5 flex-shrink-0"
          >
            <Text
              className="text-primary text-[13px] font-semibold"
              style={{ fontFamily: 'SplineSans_600SemiBold' }}
            >
              {seeAllLabel}
            </Text>
            <View className="text-primary" style={{ width: 14, height: 14 }}>
              <ChevronRight size={14} />
            </View>
          </Pressable>
        ) : null}
      </View>

      {/* ── Horizontal FlatList with snap + peek ── */}
      <FlatList
        testID="shelf-list"
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: SHELF_PADDING_H,
          gap: SHELF_CARD_GAP,
          paddingRight: SHELF_PADDING_H + SHELF_PEEK,
        }}
      />
    </View>
  );
}
