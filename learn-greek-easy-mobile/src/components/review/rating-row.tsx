/**
 * RatingRow — four equally-sized rating buttons (MOB-09).
 *
 * Again / Hard / Good / Easy with color coding and keyboard hints (1–4).
 * Disabled while a submission is in flight (isSubmitting=true).
 *
 * MOB-13: no /NN opacity modifier on var-backed tokens — explicit rgba tints.
 */
import { View, Text, Pressable } from 'react-native';
import type { UIRating } from '@/types/review';

interface RatingConfig {
  label: string;
  key: 1 | 2 | 3 | 4;
  /** Solid color for button text. */
  fgColor: string;
  /** 12% alpha tint for button background. */
  bgColor: string;
  /** Border color (same as fgColor at ~30% alpha). */
  borderColor: string;
}

const RATINGS: RatingConfig[] = [
  {
    label: 'Again',
    key: 1,
    fgColor: 'rgb(220,38,38)',        // --practice-incorrect light ≈ rgb(220,38,38)
    bgColor: 'rgba(220,38,38,0.10)',
    borderColor: 'rgba(220,38,38,0.25)',
  },
  {
    label: 'Hard',
    key: 2,
    fgColor: 'rgb(234,119,23)',        // --practice-hard light ≈ rgb(234,119,23)
    bgColor: 'rgba(234,119,23,0.10)',
    borderColor: 'rgba(234,119,23,0.25)',
  },
  {
    label: 'Good',
    key: 3,
    fgColor: 'rgb(20,184,103)',        // --practice-correct light ≈ rgb(20,184,103)
    bgColor: 'rgba(20,184,103,0.10)',
    borderColor: 'rgba(20,184,103,0.25)',
  },
  {
    label: 'Easy',
    key: 4,
    fgColor: 'rgb(79,70,229)',         // --practice-accent light ≈ indigo rgb(79,70,229)
    bgColor: 'rgba(79,70,229,0.10)',
    borderColor: 'rgba(79,70,229,0.25)',
  },
];

export interface RatingRowProps {
  onRate: (rating: UIRating) => void;
  isSubmitting?: boolean;
  /** Optional interval previews from the card (e.g. "10m", "1d"). */
  previews?: Record<UIRating, string | undefined>;
  testID?: string;
}

export function RatingRow({ onRate, isSubmitting = false, previews, testID }: RatingRowProps) {
  return (
    <View
      testID={testID ?? 'review-rating-row'}
      className="flex-row gap-1.5"
      style={{ opacity: isSubmitting ? 0.5 : 1 }}
    >
      {RATINGS.map((r) => (
        <Pressable
          key={r.key}
          testID={`review-rating-${r.label.toLowerCase()}`}
          accessibilityRole="button"
          accessibilityLabel={`${r.label}, rating ${r.key}`}
          onPress={() => !isSubmitting && onRate(r.key)}
          disabled={isSubmitting}
          className="flex-1 rounded-lg py-3 items-center justify-center active:opacity-70"
          style={{
            backgroundColor: r.bgColor,
            borderWidth: 1,
            borderColor: r.borderColor,
          }}
        >
          <Text
            testID={`review-rating-label-${r.label.toLowerCase()}`}
            className="text-[13px] font-bold mb-0.5"
            style={{ color: r.fgColor }}
          >
            {r.label}
          </Text>
          {/* Keyboard digit hint */}
          <Text
            className="text-[10px]"
            style={{ fontFamily: 'SpaceMono_400Regular', color: r.fgColor, opacity: 0.55 }}
          >
            {previews?.[r.key] ?? r.key}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
