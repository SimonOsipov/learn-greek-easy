import { getCEFRColor, getCEFRTextColor } from '@/lib/cefrColors';
import { cn } from '@/lib/utils';
import type { DeckLevel } from '@/types/deck';
import type { CardReview } from '@/types/review';

interface LevelBadgeProps {
  level: CardReview['level'];
}

export function LevelBadge({ level }: LevelBadgeProps) {
  if (!level) return null;

  // Use centralized CEFR color configuration
  // This supports all levels: A1, A2, B1, B2, C1, C2
  const bgColor = getCEFRColor(level as DeckLevel);
  const textColor = getCEFRTextColor(level as DeckLevel);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        bgColor,
        textColor
      )}
    >
      {level}
    </span>
  );
}
