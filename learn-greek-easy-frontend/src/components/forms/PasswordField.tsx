import { useState } from 'react';

import { Eye, EyeOff, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface PasswordFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  showStrength?: boolean;
  className?: string;
  'data-testid'?: string;
}

/**
 * PasswordField Component
 *
 * A specialized password input field with show/hide toggle and optional strength indicator.
 * Provides consistent password input experience across authentication forms.
 *
 * Features:
 * - Password visibility toggle with Eye/EyeOff icons
 * - Optional password strength indicator (weak/medium/strong)
 * - Integrated label and error display
 * - Full accessibility with ARIA attributes
 * - Mobile-optimized
 *
 * @example
 * ```tsx
 * // Login page
 * <PasswordField
 *   label="Password"
 *   name="password"
 *   value={password}
 *   onChange={setPassword}
 *   error={errors.password}
 *   required
 * />
 *
 * // Register page with strength indicator
 * <PasswordField
 *   label="Password"
 *   name="password"
 *   value={password}
 *   onChange={setPassword}
 *   error={errors.password}
 *   required
 *   showStrength
 *   autoComplete="new-password"
 * />
 * ```
 */
export function PasswordField({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  placeholder = '••••••••',
  required = false,
  disabled = false,
  autoComplete = 'current-password',
  showStrength = false,
  className,
  'data-testid': testId,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const hasError = !!error;

  // Password strength calculation
  const getPasswordStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (!pwd) return { level: 0, label: '', color: '' };
    if (pwd.length < 8) return { level: 1, label: 'Weak', color: 'bg-red-500' };

    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

    const strength = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

    if (strength >= 3) return { level: 3, label: 'Strong', color: 'bg-green-500' };
    if (strength >= 2) return { level: 2, label: 'Medium', color: 'bg-yellow-500' };
    return { level: 1, label: 'Weak', color: 'bg-red-500' };
  };

  const strength = showStrength ? getPasswordStrength(value) : null;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={name} className="flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>

      <div className="relative">
        <Input
          id={name}
          name={name}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${name}-error` : undefined}
          data-testid={testId}
          className={cn('pr-10 text-base', hasError && 'border-red-500 focus-visible:ring-red-500')}
        />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      {showStrength && value && strength && (
        <div className="flex items-center gap-2">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Password strength"
            aria-valuenow={strength.level}
            aria-valuemin={0}
            aria-valuemax={3}
            aria-valuetext={strength.label}
          >
            <div
              className={cn('h-full transition-all duration-300', strength.color)}
              style={{ width: `${(strength.level / 3) * 100}%` }}
            />
          </div>
          <span className="min-w-[60px] text-xs text-muted-foreground">{strength.label}</span>
        </div>
      )}

      {error && (
        <p id={`${name}-error`} className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}
