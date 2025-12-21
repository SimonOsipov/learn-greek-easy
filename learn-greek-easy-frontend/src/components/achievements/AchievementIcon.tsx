import React from 'react';

import {
  Award,
  Book,
  BookOpen,
  Brain,
  Crown,
  Diamond,
  Flame,
  Footprints,
  Library,
  Medal,
  Moon,
  RefreshCw,
  Rocket,
  Star,
  Sun,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Map of backend icon identifiers to Lucide React icons
 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  // Fire variants
  fire: Flame,
  fire_double: Flame,
  fire_triple: Flame,
  star_fire: Flame,
  diamond_fire: Flame,

  // Trophy
  trophy_fire: Trophy,

  // Crown variants
  crown_fire: Crown,
  crown: Crown,

  // Book variants
  book: Book,
  book_red: Book,
  book_green: Book,
  book_blue: Book,

  // Books variants
  books: BookOpen,
  books_double: BookOpen,

  // Library
  library: Library,

  // Lightning variants
  lightning: Zap,
  lightning_double: Zap,

  // Speed/Timer
  runner: Timer,

  // Target variants
  hundred: Target,
  target: Target,
  target_double: Target,

  // Nature/Time
  owl: Moon,
  bird: Sun,

  // Gems
  diamond: Diamond,

  // Mind
  brain: Brain,

  // Medal variants
  medal_bronze: Medal,
  medal_bronze_double: Medal,
  medal_silver: Medal,
  medal_silver_double: Medal,
  medal_gold: Medal,

  // Journey
  footprints: Footprints,

  // Refresh/Consistency
  refresh: RefreshCw,

  // Star variants
  star: Star,
  star_double: Star,

  // Launch/Progress
  rocket: Rocket,
};

/**
 * Props for AchievementIcon component
 */
export interface AchievementIconProps {
  /** Backend icon identifier string */
  icon: string;
  /** Additional CSS classes */
  className?: string;
  /** Icon size in pixels (default: 24) */
  size?: number;
}

/**
 * AchievementIcon Component
 *
 * Maps backend achievement icon identifiers to Lucide React icons.
 * Falls back to Award icon for unknown identifiers.
 */
export const AchievementIcon: React.FC<AchievementIconProps> = ({ icon, className, size = 24 }) => {
  const IconComponent = ICON_MAP[icon] || Award;

  return (
    <IconComponent className={cn('shrink-0', className)} style={{ width: size, height: size }} />
  );
};
