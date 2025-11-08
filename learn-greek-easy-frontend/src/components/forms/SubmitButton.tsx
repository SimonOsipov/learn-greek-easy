import { Button, type ButtonProps } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

/**
 * SubmitButton Component
 *
 * A specialized submit button with built-in loading state management.
 * Provides consistent submit button behavior across all forms.
 *
 * Features:
 * - Automatic loading state with spinner
 * - Disabled state during submission
 * - Customizable loading text
 * - Full width on mobile, auto on desktop
 * - Inherits all Button props except 'type' (always 'submit')
 *
 * @example
 * ```tsx
 * <SubmitButton loading={isSubmitting} loadingText="Signing in...">
 *   Sign in
 * </SubmitButton>
 *
 * <SubmitButton
 *   loading={isLoading}
 *   loadingText="Creating Account..."
 *   className="w-full"
 * >
 *   Create Account
 * </SubmitButton>
 * ```
 */
export function SubmitButton({
  loading = false,
  loadingText = 'Processing...',
  children,
  disabled,
  className,
  ...props
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={loading || disabled}
      className={cn('w-full md:w-auto', className)}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
