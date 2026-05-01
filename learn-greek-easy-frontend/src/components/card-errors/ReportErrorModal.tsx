/**
 * Report Error Modal Component
 *
 * A modal dialog for submitting card error reports.
 * Users can describe the error they found on a vocabulary card or culture question.
 */

import { useState } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { track } from '@/lib/analytics';
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
  /** The type of card: 'WORD' for word entries, 'CULTURE' for culture questions */
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
 *   cardType="WORD"
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
      toast({
        title: t('reportError.validation.tooShort', 'Please provide at least 10 characters'),
        variant: 'destructive',
      });
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
      track('card_error_reported', { cardType, cardId });

      // Show success and close
      toast({
        title: t('reportError.success', 'Thank you for reporting this error!'),
      });
      handleClose();
    } catch (error: unknown) {
      // Check for duplicate report (409 Conflict)
      if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
        toast({
          title: t('reportError.pendingReview', 'Admin yet to review your previous feedback'),
          variant: 'destructive',
        });
      } else {
        // Report to error tracking and show generic error
        reportAPIError(error, {
          operation: 'createCardErrorReport',
          endpoint: '/api/v1/card-errors',
          cardId,
          cardType,
        });
        toast({
          title: t('reportError.error', 'Failed to submit error report. Please try again.'),
          variant: 'destructive',
        });
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

  const descriptionLength = description.length;
  const isDescriptionTooShort = descriptionLength > 0 && descriptionLength < MIN_DESCRIPTION_LENGTH;
  const canSubmit = descriptionLength >= MIN_DESCRIPTION_LENGTH && !isSubmitting;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('reportError.title', 'Report an Error')}</DialogTitle>
          <DialogDescription>
            {t(
              'reportError.description',
              'Help us improve by reporting any errors you find in this card.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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

            <div id="description-help" className="flex items-center justify-between text-xs">
              <span
                className={cn('text-muted-foreground', isDescriptionTooShort && 'text-destructive')}
              >
                {isDescriptionTooShort && (
                  <span>
                    {t('reportError.validation.tooShort', 'Please provide at least 10 characters')}{' '}
                    -{' '}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">
                {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              {t('common:actions.cancel', 'Cancel')}
            </Button>
            <Button type="submit" className="flex-1" disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('reportError.submitting', 'Submitting...')}
                </>
              ) : (
                t('common:actions.submit', 'Submit')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
