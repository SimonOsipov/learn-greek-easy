/**
 * CardEditModal - Modal for editing culture cards.
 *
 * Features:
 * - Pre-populated CultureCardForm with question data
 * - updateCultureQuestion API integration
 * - Cancel confirmation for unsaved changes
 * - Toast notification on success
 */

import { useCallback, useEffect, useState } from 'react';

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
import type {
  AdminCultureQuestion,
  CultureQuestionCreatePayload,
  CultureQuestionUpdatePayload,
} from '@/services/adminAPI';
import { adminAPI } from '@/services/adminAPI';

import { CultureCardForm } from './CultureCardForm';
import { AlertDialog } from '../dialogs/AlertDialog';

// ============================================
// Types
// ============================================

export interface CardEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: AdminCultureQuestion | null;
  onSuccess?: () => void;
}

// ============================================
// Component
// ============================================

export function CardEditModal({ open, onOpenChange, question, onSuccess }: CardEditModalProps) {
  const { t } = useTranslation('admin');

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Delay reset to allow close animation
      const timeout = setTimeout(() => {
        setIsDirty(false);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Handle dirty state changes from form
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  // Handle form submission
  const handleSubmit = async (data: CultureQuestionCreatePayload) => {
    if (!question) return;

    setIsSubmitting(true);
    try {
      // Transform to update payload (remove deck_id)
      const updatePayload: CultureQuestionUpdatePayload = {
        question_text: data.question_text,
        option_a: data.option_a,
        option_b: data.option_b,
        option_c: data.option_c,
        option_d: data.option_d,
        correct_option: data.correct_option,
      };

      await adminAPI.updateCultureQuestion(question.id, updatePayload);

      toast({
        title: t('cardEdit.success'),
      });

      setIsDirty(false);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast({
        title: t('errors.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel button click
  const handleCancel = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  // Handle discard confirmation
  const handleDiscard = () => {
    setShowCancelConfirm(false);
    setIsDirty(false);
    onOpenChange(false);
  };

  // Prevent closing when dirty
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      setShowCancelConfirm(true);
      return;
    }
    onOpenChange(newOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[600px]" data-testid="card-edit-modal">
          <DialogHeader>
            <DialogTitle>{t('cardEdit.title')}</DialogTitle>
            <DialogDescription>{t('cardEdit.description')}</DialogDescription>
          </DialogHeader>

          {/* Culture Card Form with initial data */}
          {question && (
            <CultureCardForm
              initialData={question}
              onSubmit={handleSubmit}
              onDirtyChange={handleDirtyChange}
              isSubmitting={isSubmitting}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} data-testid="cancel-btn">
              {t('cardEdit.cancel')}
            </Button>
            <Button
              type="submit"
              form="culture-card-form"
              disabled={isSubmitting || !question}
              onClick={() => {
                // Trigger form submission via the form's submit handler
                const form = document.querySelector(
                  '[data-testid="culture-card-form"]'
                ) as HTMLFormElement;
                form?.requestSubmit();
              }}
              data-testid="save-btn"
            >
              {isSubmitting ? t('cardEdit.saving') : t('cardEdit.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title={t('cardEdit.discardTitle')}
        description={t('cardEdit.discardMessage')}
        variant="warning"
        dismissible={false}
        actions={[
          {
            label: t('cardEdit.keepEditing'),
            onClick: () => setShowCancelConfirm(false),
            variant: 'outline',
          },
          {
            label: t('cardEdit.discard'),
            onClick: handleDiscard,
            variant: 'destructive',
          },
        ]}
      />
    </>
  );
}

export default CardEditModal;
