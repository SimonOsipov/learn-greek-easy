/**
 * Report Error Button Component
 *
 * A button component that triggers the card error reporting flow.
 * Used in FlashcardContainer (vocabulary) and MCQComponent (culture).
 */

import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

export interface ReportErrorButtonProps {
  /** Click handler to open the report modal */
  onClick: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Variant: 'default' shows icon + text, 'icon-only' shows just the icon */
  variant?: 'default' | 'icon-only';
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

/**
 * Button to trigger card error reporting.
 *
 * @example
 * ```tsx
 * <ReportErrorButton onClick={() => setIsReportModalOpen(true)} />
 * ```
 */
export function ReportErrorButton({
  onClick,
  disabled = false,
  className = '',
  variant = 'default',
  'data-testid': testId,
}: ReportErrorButtonProps) {
  const { t } = useTranslation('review');

  const buttonText = t('reportError.button', 'Report Error');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
        'text-muted-foreground hover:text-destructive',
        'transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2',
        className
      )}
      title={buttonText}
      aria-label={buttonText}
      data-testid={testId}
    >
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      {variant === 'default' && <span>{buttonText}</span>}
    </button>
  );
}
