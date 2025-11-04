import { cn } from '@/lib/utils';
import type { CardReview } from '@/types/review';

interface LevelBadgeProps {
  level: CardReview['level'];
}

export function LevelBadge({ level }: LevelBadgeProps) {
  if (!level) return null;

  const colorMap: Record<string, string> = {
    A1: 'bg-green-500 text-white',
    A2: 'bg-blue-500 text-white',
    B1: 'bg-orange-500 text-white',
    B2: 'bg-purple-600 text-white',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        colorMap[level] || 'bg-gray-500 text-white'
      )}
    >
      {level}
    </span>
  );
}
