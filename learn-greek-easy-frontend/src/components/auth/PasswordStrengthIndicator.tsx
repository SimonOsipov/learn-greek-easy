/**
 * Password Strength Indicator Component
 *
 * Visual indicator for password strength that matches Auth0's password policy requirements.
 * Shows a progress bar with color-coded strength levels and descriptive text.
 *
 * Auth0 Default Password Policy (Good strength):
 * - Minimum 8 characters
 * - Contains lowercase letters
 * - Contains uppercase letters
 * - Contains numbers
 * - Contains special characters (!@#$%^&*)
 */

import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  /** The password to evaluate */
  password: string;
  /** Additional CSS classes for the container */
  className?: string;
}

interface StrengthResult {
  /** Strength score from 0 to 100 */
  score: number;
  /** Strength level: 'weak', 'fair', or 'strong' */
  level: 'weak' | 'fair' | 'strong';
  /** Color class for the strength text */
  colorClass: string;
  /** Requirements that are met */
  requirements: {
    minLength: boolean;
    hasLowercase: boolean;
    hasUppercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

/**
 * Calculate password strength based on Auth0 password policy
 *
 * Scoring breakdown (20 points each):
 * - Minimum 8 characters: 20 points
 * - Contains lowercase: 20 points
 * - Contains uppercase: 20 points
 * - Contains number: 20 points
 * - Contains special character: 20 points
 *
 * @param password The password to evaluate
 * @returns StrengthResult with score, level, color, and requirements
 */
function calculateStrength(password: string): StrengthResult {
  const requirements = {
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };

  // Calculate score (20 points per requirement met)
  let score = 0;
  if (requirements.minLength) score += 20;
  if (requirements.hasLowercase) score += 20;
  if (requirements.hasUppercase) score += 20;
  if (requirements.hasNumber) score += 20;
  if (requirements.hasSpecial) score += 20;

  // Bonus points for extra length
  if (password.length >= 12) score = Math.min(score + 10, 100);
  if (password.length >= 16) score = Math.min(score + 10, 100);

  // Determine level and color
  let level: 'weak' | 'fair' | 'strong';
  let colorClass: string;

  if (score < 40) {
    level = 'weak';
    colorClass = 'text-red-500';
  } else if (score < 70) {
    level = 'fair';
    colorClass = 'text-yellow-500';
  } else {
    level = 'strong';
    colorClass = 'text-green-500';
  }

  return { score, level, colorClass, requirements };
}

/**
 * Get the CSS class for the progress bar indicator based on strength
 */
function getProgressColorClass(level: 'weak' | 'fair' | 'strong'): string {
  switch (level) {
    case 'weak':
      return '[&>div]:bg-red-500';
    case 'fair':
      return '[&>div]:bg-yellow-500';
    case 'strong':
      return '[&>div]:bg-green-500';
  }
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  className,
}) => {
  const { t } = useTranslation('auth');

  const strength = useMemo(() => calculateStrength(password), [password]);

  // Don't render if password is empty
  if (!password) {
    return null;
  }

  return (
    <div className={cn('space-y-1', className)} data-testid="password-strength-indicator">
      <Progress
        value={strength.score}
        className={cn('h-1.5', getProgressColorClass(strength.level))}
        aria-label={t('register.passwordStrength.label')}
      />
      <p className="text-xs text-muted-foreground">
        {t('register.passwordStrength.label')}{' '}
        <span className={cn('font-medium', strength.colorClass)}>
          {t(`register.passwordStrength.${strength.level}`)}
        </span>
      </p>
    </div>
  );
};

export default PasswordStrengthIndicator;
