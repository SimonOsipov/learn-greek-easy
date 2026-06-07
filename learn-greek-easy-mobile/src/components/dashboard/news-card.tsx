/**
 * NewsCard — 260 px wide card for the "Today's news" shelf.
 *
 * Layout (top → bottom):
 *   - Photo header (130 px) with "Cyprus · date" pill at top-left and
 *     audio-length pill at bottom-right.
 *   - Body: Greek headline (title_el, 2-line clamp) + English subhead.
 *   - NO level pill (spec requirement, acceptance criterion #2).
 *
 * Pure presentational — no hooks. Parent passes the NewsItem + an onPress handler.
 *
 * Design reference: Dashboard Mock.html › NewsCard.
 */
import { View, Text, Pressable, Image } from 'react-native';
import { Play } from 'lucide-react-native';
import type { NewsItem } from '@/types/news';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format audio_duration_seconds → "M:SS" or null if absent. */
function formatAudioDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format publication_date ISO string → "DD Mon" (e.g. "08 May"). */
function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${day} ${month}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NewsCardProps {
  item: NewsItem;
  /** Called when the card is pressed; routes to news detail. */
  onPress: (id: string) => void;
}

// ---------------------------------------------------------------------------
// NewsCard
// ---------------------------------------------------------------------------

/**
 * A 260 px wide card showing a news item.
 * Carries no level pill (per spec: news items have no level field).
 */
export function NewsCard({ item, onPress }: NewsCardProps) {
  const audioDuration = formatAudioDuration(item.audio_duration_seconds);
  const dateLabel = formatDate(item.publication_date);

  return (
    <Pressable
      testID={`news-card-${item.id}`}
      onPress={() => onPress(item.id)}
      style={{ width: 260 }}
      className="rounded-[16px] overflow-hidden bg-bg-2 border border-line"
    >
      {/* ── Photo header ── */}
      <View style={{ height: 130 }} className="relative">
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          // Placeholder if no image
          <View className="absolute inset-0 bg-fg3 opacity-20" />
        )}

        {/* Scrim gradient overlay - subtle bottom-fade effect */}
        <View
          className="absolute inset-0"
          pointerEvents="none"
        />

        {/* Cyprus · date pill (top-left) */}
        <View
          testID="news-card-date-pill"
          className="absolute top-2.5 left-2.5 flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-on-photo-scrim-42"
        >
          {/* Gold dot */}
          <View
            className="w-[5px] h-[5px] rounded-full bg-badge-recommended"
          />
          <Text
            className="text-on-photo-96 text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ fontFamily: 'SpaceMono_400Regular' }}
          >
            Cyprus · {dateLabel}
          </Text>
        </View>

        {/* Audio pill (bottom-right) */}
        {audioDuration ? (
          <View
            testID="news-card-audio-pill"
            className="absolute bottom-2.5 right-2.5 flex-row items-center gap-1.5 px-2 py-1 rounded-full bg-on-photo-96"
          >
            <View className="text-fg" style={{ width: 10, height: 10 }}>
              <Play size={10} />
            </View>
            <Text
              className="text-fg text-[11px] font-bold"
              style={{ fontFamily: 'SpaceMono_400Regular' }}
            >
              {audioDuration}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Body ── */}
      <View className="p-3.5 pb-4">
        {/* Greek headline — 2-line clamp, serif */}
        <Text
          testID="news-card-title-el"
          className="text-fg text-[14px] font-semibold leading-snug"
          style={{ fontFamily: 'NotoSerif_600SemiBold' }}
          numberOfLines={2}
        >
          {item.title_el}
        </Text>

        {/* English subhead — 2-line clamp */}
        <Text
          testID="news-card-title-en"
          className="text-fg2 text-[12px] mt-1 leading-snug"
          numberOfLines={2}
        >
          {item.title_en}
        </Text>

        {/* NO level pill per acceptance criterion #2 */}
      </View>
    </Pressable>
  );
}
