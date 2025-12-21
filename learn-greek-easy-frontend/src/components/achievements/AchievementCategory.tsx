import React from 'react';

import { Trophy, Flame, BookOpen, Target, Award, Zap, GraduationCap } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AchievementResponse } from '@/services/xpAPI';

import { AchievementCard } from './AchievementCard';

// Category icon mapping
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  streak: Flame,
  learning: BookOpen,
  mastery: Trophy,
  progress: Target,
  session: Zap,
  accuracy: Target,
  cefr: GraduationCap,
  special: Award,
  default: Award,
};

/**
 * Props for AchievementCategory component
 */
export interface AchievementCategoryProps {
  category: string;
  achievements: AchievementResponse[];
  className?: string;
}

/**
 * AchievementCategory Component
 *
 * Groups achievements by category with a header showing stats.
 */
export const AchievementCategory: React.FC<AchievementCategoryProps> = ({
  category,
  achievements,
  className,
}) => {
  // Calculate stats for this category
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const totalXP = achievements.filter((a) => a.unlocked).reduce((sum, a) => sum + a.xp_reward, 0);

  // Get icon for category
  const IconComponent = categoryIcons[category.toLowerCase()] || categoryIcons.default;

  // Format category name (capitalize, replace underscores)
  const formattedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const headingId = `category-${category.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <section className={cn('space-y-4', className)} aria-labelledby={headingId}>
      {/* Category Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconComponent className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <h2 id={headingId} className="text-lg font-semibold text-foreground">
            {formattedCategory}
          </h2>
        </div>

        {/* Category Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            {unlockedCount}/{totalCount} unlocked
          </span>
          {totalXP > 0 && (
            <span className="text-purple-600 dark:text-purple-400">+{totalXP} XP earned</span>
          )}
        </div>
      </div>

      {/* Achievement Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </section>
  );
};
