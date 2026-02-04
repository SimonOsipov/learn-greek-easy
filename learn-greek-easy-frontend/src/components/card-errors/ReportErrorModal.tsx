/**
 * Report Error Modal Component
 *
 * A modal dialog for submitting card error reports.
 * Users can describe the error they found on a vocabulary card or culture question.
 */

import { useState } from 'react';

import { X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { trackCardErrorReported } from '@/lib/analytics';
import { reportAPIError } from '@/lib/errorReporting';
import { cn } from '@/lib/utils';
import { cardErrorAPI } from '@/services/cardErrorAPI';
import type { CardType } from '@/types/cardError';

/** Minimum description length required for submission */
const MIN_DESCRIPTION_LENGTH = 10;
/** Maximum description length allowed */
const MAX_DESCRIPTION_LENGTH = 1000;

export interface ReportErrorModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** The ID of the card being reported */
  cardId: string;
  /** The type of card: 'VOCABULARY' for flashcards, 'CULTURE' for culture questions */
  cardType: CardType;
}

/**
 * Modal for reporting errors on cards.
 *
 * @example
 * ```tsx
 * <ReportErrorModal
 *   isOpen={isReportModalOpen}
 *   onClose={() => setIsReportModalOpen(false)}
 *   cardId={card.id}
 *   cardType="VOCABULARY"
 * />
 * ```
 */
export function ReportErrorModal({ isOpen, onClose, cardId, cardType }: ReportErrorModalProps) {
  const { t } = useTranslation('review');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedDescription = description.trim();

    // Client-side validation
    if (trimmedDescription.length < MIN_DESCRIPTION_LENGTH) {
      toast.error(t('reportError.validation.tooShort', 'Please provide at least 10 characters'));
      return;
    }

    setIsSubmitting(true);

    try {
      await cardErrorAPI.create({
        card_id: cardId,
        card_type: cardType,
        description: trimmedDescription,
      });

      // Track analytics event
      trackCardErrorReported({ cardType, cardId });

      // Show success and close
      toast.success(t('reportError.success', 'Thank you for reporting this error!'));
      handleClose();
    } catch (error: unknown) {
      // Check for duplicate report (409 Conflict)
      if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
        toast.error(
          t('reportError.alreadyReported', 'You have already reported an error for this card')
        );
      } else {
        // Report to error tracking and show generic error
        reportAPIError(error, {
          operation: 'createCardErrorReport',
          endpoint: '/api/v1/card-errors',
          cardId,
          cardType,
        });
        toast.error(t('reportError.error', 'Failed to submit error report. Please try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle modal close - reset form state
   */
  const handleClose = () => {
    setDescription('');
    onClose();
  };

  // Don't render anything if not open
  if (!isOpen) return null;

  const descriptionLength = description.length;
  const isDescriptionTooShort = descriptionLength > 0 && descriptionLength < MIN_DESCRIPTION_LENGTH;
  const canSubmit = descriptionLength >= MIN_DESCRIPTION_LENGTH && !isSubmitting;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={handleClose} aria-hidden="true" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-error-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className={cn('w-full max-w-md', 'rounded-lg bg-card shadow-xl', 'border border-border')}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 id="report-error-title" className="text-lg font-semibold text-foreground">
              {t('reportError.title', 'Report an Error')}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t('common:actions.close', 'Close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4">
            <p className="mb-4 text-sm text-muted-foreground">
              {t(
                'reportError.description',
                'Help us improve by reporting any errors you find in this card.'
              )}
            </p>

            {/* Description textarea */}
            <div className="space-y-2">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('reportError.placeholder', 'Describe the error you found...')}
                className={cn(
                  'w-full resize-none rounded-lg border p-3',
                  'bg-background text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  isDescriptionTooShort && 'border-destructive focus:ring-destructive'
                )}
                rows={4}
                maxLength={MAX_DESCRIPTION_LENGTH}
                disabled={isSubmitting}
                aria-describedby="description-help"
              />

              {/* Character count and validation message */}
              <div id="description-help" className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    'text-muted-foreground',
                    isDescriptionTooShort && 'text-destructive'
                  )}
                >
                  {isDescriptionTooShort && (
                    <span>
                      {t(
                        'reportError.validation.tooShort',
                        'Please provide at least 10 characters'
                      )}{' '}
                      -{' '}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={isSubmitting}
              >
                {t('common:actions.cancel', 'Cancel')}
              </Button>
              <Button type="submit" variant="destructive" className="flex-1" disabled={!canSubmit}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('reportError.submitting', 'Submitting...')}
                  </>
                ) : (
                  t('common:actions.submit', 'Submit')
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
