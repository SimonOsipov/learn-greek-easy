import React, { useEffect, useCallback, useMemo } from 'react';

import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for LevelUpCelebration component
 */
export interface LevelUpCelebrationProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** New level number */
  level: number;
  /** Level name in Greek */
  levelNameGreek: string;
  /** Level name in English */
  levelNameEnglish: string;
  /** Callback when celebration is dismissed */
  onDismiss: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get level color based on level tier
 * Levels 1-5: Blue, 6-10: Purple, 11-15: Gold
 */
const getLevelColor = (level: number): { gradient: string; text: string; bg: string } => {
  if (level >= 11) {
    return {
      gradient: 'from-amber-400 to-amber-600',
      text: 'text-amber-500',
      bg: 'bg-amber-100 dark:bg-amber-900/50',
    };
  }
  if (level >= 6) {
    return {
      gradient: 'from-purple-400 to-purple-600',
      text: 'text-purple-500',
      bg: 'bg-purple-100 dark:bg-purple-900/50',
    };
  }
  return {
    gradient: 'from-blue-400 to-blue-600',
    text: 'text-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900/50',
  };
};

/**
 * LevelUpCelebration Component
 *
 * Full-screen modal celebrating a level-up event.
 * Features:
 * - Confetti burst animation (respects prefers-reduced-motion)
 * - Shows new level number with Greek and English names
 * - Dismissable via button or backdrop click
 * - Screen reader announcements for accessibility
 * - Keyboard accessible (Escape to close)
 */
export const LevelUpCelebration: React.FC<LevelUpCelebrationProps> = ({
  isOpen,
  level,
  levelNameGreek,
  levelNameEnglish,
  onDismiss,
  className,
}) => {
  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const colors = getLevelColor(level);

  // Fire confetti effect
  const fireConfetti = useCallback(() => {
    if (prefersReducedMotion) return;

    // Gold colors for high levels, theme-appropriate colors for others
    const confettiColors =
      level >= 11
        ? ['#F59E0B', '#FBBF24', '#FCD34D', '#FEF3C7'] // Gold theme
        : level >= 6
          ? ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE'] // Purple theme
          : ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE']; // Blue theme

    // Fire confetti from both sides
    const defaults = {
      spread: 60,
      ticks: 100,
      gravity: 1,
      decay: 0.94,
      startVelocity: 30,
      colors: confettiColors,
    };

    // Left side burst
    confetti({
      ...defaults,
      particleCount: 40,
      origin: { x: 0.2, y: 0.6 },
      angle: 60,
    });

    // Right side burst
    confetti({
      ...defaults,
      particleCount: 40,
      origin: { x: 0.8, y: 0.6 },
      angle: 120,
    });

    // Center burst (delayed)
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 60,
        origin: { x: 0.5, y: 0.7 },
        spread: 90,
      });
    }, 150);
  }, [level, prefersReducedMotion]);

  // Fire confetti when modal opens
  useEffect(() => {
    if (isOpen) {
      fireConfetti();
    }
  }, [isOpen, fireConfetti]);

  // Handle keyboard escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onDismiss]);

  // Animation variants
  const backdropVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const modalVariants = {
    initial: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 20 },
    animate: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 },
    exit: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -10 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Screen reader announcement */}
          <div className="sr-only" role="status" aria-live="assertive">
            Congratulations! You reached Level {level}: {levelNameEnglish}!
          </div>

          {/* Backdrop */}
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={backdropVariants}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onDismiss}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={modalVariants}
            transition={{
              duration: prefersReducedMotion ? 0.1 : 0.3,
              ease: [0.16, 1, 0.3, 1], // Custom ease for bounce effect
            }}
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2',
              'rounded-2xl bg-white p-8 shadow-2xl',
              'dark:bg-gray-900',
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="level-up-title"
          >
            {/* Sparkles decoration */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className={cn('rounded-full p-2', colors.bg)}>
                <Sparkles className={cn('h-6 w-6', colors.text)} aria-hidden="true" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center">
              {/* Header */}
              <p className="mt-4 text-sm font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Level Up!
              </p>

              {/* Level number with gradient */}
              <div className="mt-4 flex items-center justify-center">
                <div
                  className={cn(
                    'flex h-24 w-24 items-center justify-center rounded-full',
                    'bg-gradient-to-br shadow-lg',
                    colors.gradient
                  )}
                >
                  <span className="text-4xl font-bold text-white">{level}</span>
                </div>
              </div>

              {/* Level names */}
              <h2
                id="level-up-title"
                className="mt-6 text-2xl font-bold text-gray-900 dark:text-white"
              >
                {levelNameEnglish}
              </h2>
              <p className="mt-1 text-lg text-gray-600 dark:text-gray-400" lang="el">
                {levelNameGreek}
              </p>

              {/* Encouragement message */}
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Keep learning to unlock more achievements!
              </p>

              {/* Dismiss button */}
              <Button
                onClick={onDismiss}
                className={cn(
                  'mt-6 w-full bg-gradient-to-r',
                  colors.gradient,
                  'text-white hover:opacity-90'
                )}
              >
                <Star className="mr-2 h-4 w-4" aria-hidden="true" />
                Continue Learning
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
