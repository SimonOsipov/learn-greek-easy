/**
 * ExamDeckCard — 196px gradient card in the "Past exam decks" horizontal rail.
 *
 * Layout (top-to-bottom):
 *   - Faint date watermark (absolute, top-right, 16% opacity Inter Tight 100px)
 *   - Date mono kicker (78% opacity) + exam title (Inter Tight 17)
 *   - Progress bar (track 22% white → fill 92% white) + mastered/total count (85% opacity)
 *
 * Background: LinearGradient 135deg with the exam tint stop pair.
 * All overlay colours use explicit rgba tokens (MOB-13: no /NN modifiers on
 * var-backed tokens on native). The required tokens are defined in tailwind.config.js.
 */
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { CultureDeckResponse } from '@/types/culture';

interface ExamDeckCardProps {
  deck: CultureDeckResponse;
  /** Gradient stop pair [from, to] from tintForDeckId() */
  tint: readonly [string, string];
  onPress: (id: string) => void;
}

/**
 * Extracts the short month abbreviation from a deck name like "Cultural Exam Jul'25" → "Jul".
 * api-map gap #9: there is no exam_date field on CultureDeckResponse; the date
 * is derived from name_en (or name) as a best-effort visual hint. If no month
 * abbreviation is found, returns '' (no watermark rendered).
 *
 * Exported for unit-testing. Not part of the public component API.
 */
export function dateWatermarkFromName(name: string | null | undefined): string {
  if (!name) return '';
  const match = name.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i);
  return match ? (match[1] ?? '') : '';
}

export function ExamDeckCard({ deck, tint, onPress }: ExamDeckCardProps) {
  const { id, name, name_en, question_count, progress } = deck;
  // Derive watermark from name_en preferred, then name (api-map gap #9 — no exam_date field)
  const watermark = dateWatermarkFromName(name_en ?? name);
  // Progress ratio: mastered / total, or 0 when progress is null (never-practiced user)
  const progressRatio =
    progress && progress.questions_total > 0
      ? progress.questions_mastered / progress.questions_total
      : 0;
  const masteredCount = progress?.questions_mastered ?? 0;

  return (
    <Pressable
      testID={`exam-deck-card-${id}`}
      onPress={() => onPress(id)}
      className="active:opacity-75"
      style={{ flexShrink: 0, width: 196 }}
    >
      <LinearGradient
        colors={[tint[0], tint[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 16,
          padding: 16,
          minHeight: 180,
          position: 'relative',
          overflow: 'hidden',
          justifyContent: 'space-between',
        }}
      >
        {/* Date watermark — absolute, top-right, very faint */}
        {watermark ? (
          <Text
            style={{
              position: 'absolute',
              right: -10,
              top: -8,
              opacity: 0.16,
              fontSize: 100,
              fontWeight: '800',
              lineHeight: 100,
              fontFamily: 'InterTight_700Bold',
              color: 'rgb(255,255,255)',
            }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {watermark}
          </Text>
        ) : null}

        {/* Top section: date kicker (derived from name) + title */}
        <View>
          {watermark ? (
            <Text
              style={{
                fontFamily: 'SpaceMono_400Regular',
                fontSize: 10.5,
                fontWeight: '700',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.78)',
              }}
            >
              {watermark}
            </Text>
          ) : null}
          <Text
            style={{
              marginTop: 6,
              fontFamily: 'InterTight_700Bold',
              fontSize: 17,
              fontWeight: '700',
              letterSpacing: -0.4,
              lineHeight: 21,
              color: 'rgb(255,255,255)',
            }}
          >
            {name}
          </Text>
        </View>

        {/* Bottom section: progress bar + count */}
        <View>
          {/* Progress track */}
          <View
            style={{
              height: 4,
              borderRadius: 9999,
              backgroundColor: 'rgba(255,255,255,0.22)',
              overflow: 'hidden',
              marginBottom: 6,
            }}
          >
            <View
              style={{
                width: `${progressRatio * 100}%`,
                height: '100%',
                backgroundColor: 'rgba(255,255,255,0.92)',
                borderRadius: 9999,
              }}
            />
          </View>
          {/* Mastered / total */}
          <Text
            style={{
              fontSize: 11.5,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            <Text style={{ fontWeight: '700' }}>{masteredCount}</Text>
            <Text style={{ opacity: 0.7 }}>/{question_count} mastered</Text>
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
