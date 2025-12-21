import React, { useEffect, useState, useMemo } from 'react';

import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Props for XPGainAnimation component
 */
export interface XPGainAnimationProps {
  /** Amount of XP gained */
  amount: number;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Position on screen */
  position?: 'top-center' | 'top-right' | 'bottom-center';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get position classes based on position prop
 */
const getPositionClasses = (position: XPGainAnimationProps['position']) => {
  switch (position) {
    case 'top-right':
      return 'top-4 right-4';
    case 'bottom-center':
      return 'bottom-4 left-1/2 -translate-x-1/2';
    case 'top-center':
    default:
      return 'top-4 left-1/2 -translate-x-1/2';
  }
};

/**
 * XPGainAnimation Component
 *
 * Displays an animated notification when user gains XP.
 * Uses Tailwind CSS animations for performance and accessibility.
 * Respects prefers-reduced-motion.
 */
export const XPGainAnimation: React.FC<XPGainAnimationProps> = ({
  amount,
  onComplete,
  position = 'top-center',
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    // Start exit animation after 1.5 seconds
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 1500);

    // Complete after exit animation (500ms)
    const completeTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 2000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (!isVisible) return null;

  const positionClasses = getPositionClasses(position);

  return (
    <>
      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        You earned {amount} XP!
      </div>

      {/* Visual animation */}
      <div
        className={cn('pointer-events-none fixed z-50', positionClasses, className)}
        aria-hidden="true"
      >
        <div
          className={cn(
            'flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 shadow-lg',
            // Entry animation
            !prefersReducedMotion && !isExiting && 'animate-in slide-in-from-bottom-4',
            // Exit animation
            !prefersReducedMotion &&
              isExiting &&
              'animate-out fade-out-0 slide-out-to-top-4',
            // Reduced motion: simple opacity
            prefersReducedMotion && !isExiting && 'opacity-100',
            prefersReducedMotion && isExiting && 'opacity-0 transition-opacity duration-500'
          )}
        >
          <Star className="h-5 w-5 text-white" fill="currentColor" />
          <span className="text-sm font-bold text-white">+{amount} XP</span>
        </div>
      </div>
    </>
  );
};

/**
 * Hook for managing XP gain animations
 */
export const useXPGainAnimation = () => {
  const [xpGain, setXPGain] = useState<{ amount: number; key: number } | null>(null);

  const triggerXPGain = (amount: number) => {
    setXPGain({ amount, key: Date.now() });
  };

  const handleComplete = () => {
    setXPGain(null);
  };

  return {
    showXPGain: xpGain,
    triggerXPGain,
    xpGainProps: xpGain
      ? {
          amount: xpGain.amount,
          onComplete: handleComplete,
          key: xpGain.key,
        }
      : null,
  };
};
