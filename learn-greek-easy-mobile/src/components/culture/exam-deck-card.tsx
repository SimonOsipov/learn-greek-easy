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

/** Extracts the short month abbreviation from an exam_date string like "Jul 2025" → "Jul" */
function dateWatermark(examDate: string | null): string {
  if (!examDate) return '';
  return examDate.split(' ')[0]?.slice(0, 3) ?? '';
}

export function ExamDeckCard({ deck, tint, onPress }: ExamDeckCardProps) {
  const { id, name, exam_date, question_count, progress } = deck;
  const watermark = dateWatermark(exam_date);

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

        {/* Top section: date kicker + title */}
        <View>
          {exam_date ? (
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
              {exam_date}
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
                width: `${progress.progress * 100}%`,
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
            <Text style={{ fontWeight: '700' }}>{progress.mastered}</Text>
            <Text style={{ opacity: 0.7 }}>/{question_count} mastered</Text>
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
