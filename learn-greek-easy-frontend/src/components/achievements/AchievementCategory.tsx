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
  // Arbitrary Tailwind classes using CSS var tokens — no raw palette classes
  icon: string;
  border: string;
}

// Category → token mapping (canonical order for --chart-1..7).
// streak uses --practice-gold (gold-tier earning, not chart palette).
// learning  → --chart-1 (blue)
// session   → --chart-2 (green)
// accuracy  → --chart-6 (cyan)
// cefr      → --chart-4 (violet)
// special   → --chart-5 (rose)
// culture   → --chart-7 (orange)
const CATEGORY_COLORS: Record<string, CategoryColorConfig> = {
  streak: {
    icon: 'text-practice-gold',
    border: 'border-l-practice-gold',
  },
  learning: {
    icon: 'text-[hsl(var(--chart-1))]',
    border: 'border-l-[hsl(var(--chart-1))]',
  },
  session: {
    icon: 'text-[hsl(var(--chart-2))]',
    border: 'border-l-[hsl(var(--chart-2))]',
  },
  accuracy: {
    icon: 'text-[hsl(var(--chart-6))]',
    border: 'border-l-[hsl(var(--chart-6))]',
  },
  cefr: {
    icon: 'text-[hsl(var(--chart-4))]',
    border: 'border-l-[hsl(var(--chart-4))]',
  },
  special: {
    icon: 'text-[hsl(var(--chart-5))]',
    border: 'border-l-[hsl(var(--chart-5))]',
  },
  culture: {
    icon: 'text-[hsl(var(--chart-7))]',
    border: 'border-l-[hsl(var(--chart-7))]',
  },
};

const DEFAULT_COLORS: CategoryColorConfig = {
  icon: 'text-fg2',
  border: 'border-l-line-2',
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
        className={cn('space-y-4 border-l-4 pl-4', colors.border, className)}
        aria-labelledby={headingId}
      >
        {/* Category Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconComponent className={cn('h-5 w-5', colors.icon)} />
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
              <Badge variant="secondary" className={cn(colors.icon)}>
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
