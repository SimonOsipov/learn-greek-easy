/**
 * QuickWinsShelf — "Quick wins" content shelf with coming-soon red-dot.
 *
 * Shows 3 hardcoded sample cards (Daily Mix, Word of the Day, Quick drills).
 * The ENTIRE shelf carries the DASH-04 red-dot eyebrow via `comingSoon` on Shelf.
 * ALL card presses fire `showComingSoonToast()` from the DASH-04 toast infra and
 * NEVER navigate anywhere.
 *
 * Data is hardcoded SAMPLE — no live backend source for these features yet.
 *
 * Design reference: Dashboard Mock.html › DailyMixCard, WordOfDayCard, QuickCard.
 */
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Zap } from 'lucide-react-native';

import { Shelf } from '@/components/dashboard/shelf';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

interface QuickWinsItem {
  id: string;
  title: string;
  titleEl: string;
  subtitle: string;
  type: 'daily-mix' | 'word-of-day' | 'quick-drill';
}

const QUICK_WINS_SAMPLE: QuickWinsItem[] = [
  {
    id: 'daily-mix',
    title: 'Daily Mix',
    titleEl: 'Ασκήσεις',
    subtitle: '13 exercises · ~8 min',
    type: 'daily-mix',
  },
  {
    id: 'word-of-day',
    title: 'Word of the Day',
    titleEl: 'η αποζημίωση',
    subtitle: 'compensation · feminine noun',
    type: 'word-of-day',
  },
  {
    id: 'quick-drill',
    title: 'Quick drills',
    titleEl: 'Γρήγορες ασκήσεις',
    subtitle: '5 drills · ~3 min',
    type: 'quick-drill',
  },
];

// Card width for the quick wins shelf
const CARD_WIDTH = 200;

// ---------------------------------------------------------------------------
// QuickWinsCard — individual card
// ---------------------------------------------------------------------------

interface QuickWinsCardProps {
  item: QuickWinsItem;
  onPress: () => void;
}

function DailyMixCard({ item, onPress }: QuickWinsCardProps) {
  return (
    <Pressable
      testID={`quick-wins-card-${item.id}`}
      onPress={onPress}
      style={{ width: CARD_WIDTH }}
    >
      <LinearGradient
        colors={['rgb(139,92,246)', 'rgb(79,70,229)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 16, padding: 16, minHeight: 130, position: 'relative', overflow: 'hidden' }}
      >
        {/* Watermark */}
        <Text
          className="absolute text-on-photo-18 font-extrabold text-[120px] leading-none"
          style={{ right: -18, top: -10, color: 'rgba(255,255,255,0.18)', fontFamily: 'InterTight_700Bold' }}
        >
          Α
        </Text>
        <View
          className="w-[30px] h-[30px] rounded-[9px] bg-on-photo-18 items-center justify-center"
        >
          <View style={{ width: 16, height: 16 }}>
            <Sparkles size={16} color="white" />
          </View>
        </View>
        <View className="flex-1 mt-2">
          <Text
            className="text-on-photo-96 text-[17px] font-bold tracking-tight leading-tight"
            style={{ fontFamily: 'InterTight_700Bold' }}
          >
            {item.title}
          </Text>
          <Text
            className="text-on-photo-85 text-[15px] mt-0.5"
            style={{ fontFamily: 'NotoSerif_400Regular_Italic' }}
          >
            {item.titleEl}
          </Text>
        </View>
        <Text className="text-on-photo-85 text-[11.5px]">{item.subtitle}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function WordOfDayCard({ item, onPress }: QuickWinsCardProps) {
  return (
    <Pressable
      testID={`quick-wins-card-${item.id}`}
      onPress={onPress}
      style={{ width: 280 }}
      className="rounded-[16px] overflow-hidden bg-bg-2 border border-line p-4 relative"
    >
      {/* Watermark */}
      <Text
        className="absolute font-extrabold text-[110px] leading-none"
        style={{
          right: -16,
          bottom: -22,
          color: 'rgba(15,23,42,0.06)',
          fontFamily: 'InterTight_700Bold',
        }}
      >
        {item.titleEl.split(' ').slice(-1)[0]}
      </Text>

      {/* "Word of the day" label */}
      <View className="flex-row items-center gap-1.5 mb-2.5">
        <View style={{ width: 12, height: 12 }}>
          <Sparkles size={12} color="rgb(246,168,35)" />
        </View>
        <Text
          className="text-[10.5px] font-bold uppercase tracking-[0.12em]"
          style={{ fontFamily: 'SpaceMono_400Regular', color: 'rgb(246,168,35)' }}
        >
          Word of the day
        </Text>
      </View>

      <Text
        testID="quick-wins-wod-el"
        className="text-fg text-[28px] font-semibold leading-tight"
        style={{ fontFamily: 'NotoSerif_600SemiBold' }}
      >
        {item.titleEl}
      </Text>
      <Text className="text-fg2 text-[13px] mt-1">{item.subtitle}</Text>
    </Pressable>
  );
}

function QuickDrillCard({ item, onPress }: QuickWinsCardProps) {
  return (
    <Pressable
      testID={`quick-wins-card-${item.id}`}
      onPress={onPress}
      style={{ width: CARD_WIDTH, borderRadius: 16, padding: 14, minHeight: 130, backgroundColor: 'rgba(49,196,122,0.14)', borderColor: 'rgba(49,196,122,0.25)', borderWidth: 1 }}
    >
      <View
        className="w-[30px] h-[30px] rounded-[9px] items-center justify-center"
        style={{ backgroundColor: 'rgba(49,196,122,0.18)' }}
      >
        <Zap size={16} color="rgb(49,196,122)" />
      </View>
      <Text
        className="text-fg text-[15px] font-bold tracking-tight leading-tight mt-2 flex-1"
        style={{ fontFamily: 'InterTight_700Bold' }}
        numberOfLines={2}
      >
        {item.title}
      </Text>
      <Text className="text-fg2 text-[11.5px] mt-2 opacity-75">{item.subtitle}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// QuickWinsShelf — public component
// ---------------------------------------------------------------------------

/**
 * The "Quick wins" shelf for the dashboard.
 *
 * Uses the Shelf wrapper with `comingSoon` to show the DASH-04 red-dot eyebrow.
 * All card presses fire a toast and never navigate.
 */
export function QuickWinsShelf() {
  const { showComingSoonToast } = useToast();

  return (
    <Shelf
      kicker="QUICK WINS"
      comingSoon
      title="Quick wins"
      subtitle="3–5 minute focused practice"
      data={QUICK_WINS_SAMPLE}
      renderItem={({ item }) => {
        if (item.type === 'daily-mix') {
          return (
            <DailyMixCard
              key={item.id}
              item={item}
              onPress={() => {
                track('home_card_tapped', { section: 'quick-wins', target: item.id, coming_soon: true });
                showComingSoonToast();
              }}
            />
          );
        }
        if (item.type === 'word-of-day') {
          return (
            <WordOfDayCard
              key={item.id}
              item={item}
              onPress={() => {
                track('home_card_tapped', { section: 'quick-wins', target: item.id, coming_soon: true });
                showComingSoonToast();
              }}
            />
          );
        }
        return (
          <QuickDrillCard
            key={item.id}
            item={item}
            onPress={() => {
              track('home_card_tapped', { section: 'quick-wins', target: item.id, coming_soon: true });
              showComingSoonToast();
            }}
          />
        );
      }}
      keyExtractor={(item) => item.id}
      cardWidth={CARD_WIDTH}
    />
  );
}
