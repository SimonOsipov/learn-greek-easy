import { AlertCircle } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'url';
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'url' | 'search';
  className?: string;
  helperText?: string;
}

/**
 * FormField Component
 *
 * A reusable form field component that combines label, input, and error display.
 * Provides consistent styling and accessibility features across all forms.
 *
 * Features:
 * - Integrated label with required indicator
 * - Error state styling and display
 * - Helper text support
 * - Full accessibility with ARIA attributes
 * - Mobile-optimized (prevents iOS zoom with text-base)
 *
 * @example
 * ```tsx
 * <FormField
 *   label="Email address"
 *   name="email"
 *   type="email"
 *   value={email}
 *   onChange={setEmail}
 *   error={errors.email}
 *   placeholder="name@example.com"
 *   required
 *   autoComplete="email"
 *   inputMode="email"
 * />
 * ```
 */
export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  required = false,
  disabled = false,
  autoComplete,
  inputMode,
  className,
  helperText,
}: FormFieldProps) {
  const hasError = !!error;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={name} className="flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>

      <Input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : helperText ? `${name}-helper` : undefined}
        className={cn(
          'text-base', // Prevent iOS zoom
          hasError && 'border-red-500 focus-visible:ring-red-500'
        )}
      />

      {helperText && !error && (
        <p id={`${name}-helper`} className="text-sm text-muted-foreground">
          {helperText}
        </p>
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
