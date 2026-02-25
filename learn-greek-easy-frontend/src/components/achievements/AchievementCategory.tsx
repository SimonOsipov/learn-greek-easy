import React from 'react';

import {
  Trophy,
  Flame,
  BookOpen,
  Target,
  Award,
  Zap,
  GraduationCap,
  Landmark,
  ChevronDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  culture: Landmark,
  default: Award,
};

interface CategoryColorConfig {
  icon: string;
  iconDark: string;
  border: string;
  borderDark: string;
}

const CATEGORY_COLORS: Record<string, CategoryColorConfig> = {
  streak: {
    icon: 'text-orange-600',
    iconDark: 'dark:text-orange-400',
    border: 'border-l-orange-500',
    borderDark: 'dark:border-l-orange-400',
  },
  learning: {
    icon: 'text-blue-600',
    iconDark: 'dark:text-blue-400',
    border: 'border-l-blue-500',
    borderDark: 'dark:border-l-blue-400',
  },
  session: {
    icon: 'text-green-600',
    iconDark: 'dark:text-green-400',
    border: 'border-l-green-500',
    borderDark: 'dark:border-l-green-400',
  },
  accuracy: {
    icon: 'text-teal-600',
    iconDark: 'dark:text-teal-400',
    border: 'border-l-teal-500',
    borderDark: 'dark:border-l-teal-400',
  },
  cefr: {
    icon: 'text-indigo-600',
    iconDark: 'dark:text-indigo-400',
    border: 'border-l-indigo-500',
    borderDark: 'dark:border-l-indigo-400',
  },
  special: {
    icon: 'text-purple-600',
    iconDark: 'dark:text-purple-400',
    border: 'border-l-purple-500',
    borderDark: 'dark:border-l-purple-400',
  },
  culture: {
    icon: 'text-rose-600',
    iconDark: 'dark:text-rose-400',
    border: 'border-l-rose-500',
    borderDark: 'dark:border-l-rose-400',
  },
};

const DEFAULT_COLORS: CategoryColorConfig = {
  icon: 'text-gray-600',
  iconDark: 'dark:text-gray-400',
  border: 'border-l-gray-500',
  borderDark: 'dark:border-l-gray-400',
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
  const { t } = useTranslation('achievements');
  const [isOpen, setIsOpen] = React.useState(false);

  // Calculate stats for this category
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const totalXP = achievements.filter((a) => a.unlocked).reduce((sum, a) => sum + a.xp_reward, 0);

  // Get icon for category
  const categoryKey = category.toLowerCase();
  const IconComponent = categoryIcons[categoryKey] || categoryIcons.default;
  const colors = CATEGORY_COLORS[categoryKey] || DEFAULT_COLORS;

  // Format category name for fallback (capitalize, replace underscores)
  const formattedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // Get translated category name (fallback to formatted name)
  const translatedCategory = t(`category.names.${categoryKey}`, formattedCategory);

  const headingId = `category-${categoryKey.replace(/\s+/g, '-')}`;

  const PREVIEW_COUNT = 2;
  const previewAchievements = achievements.slice(0, PREVIEW_COUNT);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <section
        className={cn('space-y-4 border-l-4 pl-4', colors.border, colors.borderDark, className)}
        aria-labelledby={headingId}
      >
        {/* Category Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconComponent className={cn('h-5 w-5', colors.icon, colors.iconDark)} />
            <h2 id={headingId} className="text-lg font-semibold text-foreground">
              {translatedCategory}
            </h2>
          </div>

          {/* Category Stats + Toggle */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {t('category.unlocked', { count: unlockedCount, total: totalCount })}
            </Badge>
            {totalXP > 0 && (
              <Badge variant="secondary" className={cn(colors.icon, colors.iconDark)}>
                {t('category.xpEarned', { xp: totalXP })}
              </Badge>
            )}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? t('toggle.hide') : t('toggle.showAll')}
                <ChevronDown
                  className={cn('ml-1 h-4 w-4 transition-transform', isOpen && 'rotate-180')}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Preview cards when collapsed */}
        {!isOpen && previewAchievements.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {previewAchievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        )}

        {/* Full grid when expanded */}
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
};
