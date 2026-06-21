/**
 * TopicDrillRow — a single row in the "Drill by topic" section.
 *
 * Layout: 44×44 gradient monogram tile (primary→accent, radius 12) + title
 * (Inter Tight 15/700) + Greek name & count (Noto Serif 12, fg-2) + chevron.
 *
 * Navigation is stubbed (coming soon) — pressing fires showComingSoonToast() +
 * analytics `culture_drill_topic_tapped` with `coming_soon: true`.
 *
 * Monogram gradient colours are fixed rgb (MOB-13 convention).
 */
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';

import type { SubtopicItem } from '@/lib/culture/presentation';
import { useIconColor } from '@/hooks/use-icon-color';

// primary hsl(221 83% 53%) = rgb(36,99,235)
// accent  hsl(221 83% 65%) = rgb(90,131,244)
const MONOGRAM_FROM = 'rgb(36,99,235)';
const MONOGRAM_TO   = 'rgb(90,131,244)';

interface TopicDrillRowProps {
  subtopic: SubtopicItem;
  onPress: (id: string) => void;
}

export function TopicDrillRow({ subtopic, onPress }: TopicDrillRowProps) {
  const { id, title, el, n, mark } = subtopic;
  // THEME-06: chevron (--fg-3) resolves per-theme from the global store.
  const iconFg3 = useIconColor('fg-3');

  return (
    <Pressable
      testID={`topic-drill-row-${id}`}
      onPress={() => onPress(id)}
      className="flex-row items-center gap-[14px] p-[14px] rounded-[14px] bg-card border border-line active:opacity-70"
    >
      {/* Monogram tile */}
      <LinearGradient
        colors={[MONOGRAM_FROM, MONOGRAM_TO]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Text
          style={{
            fontFamily: 'InterTight_700Bold',
            fontSize: 14,
            fontWeight: '800',
            letterSpacing: -0.3,
            color: 'rgb(255,255,255)',
          }}
        >
          {mark}
        </Text>
      </LinearGradient>

      {/* Text content */}
      <View className="flex-1 min-w-0">
        <Text
          className="text-fg"
          style={{
            fontFamily: 'InterTight_700Bold',
            fontSize: 15,
            fontWeight: '700',
            letterSpacing: -0.2,
          }}
        >
          {title}
        </Text>
        <Text
          className="text-fg2"
          style={{
            fontFamily: 'NotoSerif_400Regular',
            fontSize: 12,
            marginTop: 1,
          }}
        >
          {el} · {n} questions
        </Text>
      </View>

      {/* Chevron — explicit color prop per conventions.md §3 (no className on lucide icons).
          THEME-06: iconFg3 resolves per-theme from the store. */}
      <ChevronRight size={18} color={iconFg3} strokeWidth={2} />
    </Pressable>
  );
}
