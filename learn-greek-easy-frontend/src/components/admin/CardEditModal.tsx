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
import { useSSE } from '@/hooks/useSSE';
import type {
  AdminCultureQuestion,
  CultureQuestionCreatePayload,
  CultureQuestionUpdatePayload,
} from '@/services/adminAPI';
import { adminAPI, getCultureQuestionAudioStreamUrl } from '@/services/adminAPI';
import type { AudioStatus } from '@/services/wordEntryAPI';
import type { SSEEvent } from '@/types/sse';

import { AudioGenerateButton } from './AudioGenerateButton';
import { AudioStatusBadge } from './AudioStatusBadge';
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
  const [streamEnabled, setStreamEnabled] = useState(false);
  const [audioStage, setAudioStage] = useState<string | null>(null);
  const [audioCooldown, setAudioCooldown] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStreamEnabled(false);
      setAudioStage(null);
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

  // Handle SSE events for audio generation
  const handleAudioSSEEvent = useCallback(
    (event: SSEEvent) => {
      switch (event.type) {
        case 'culture_audio:tts':
        case 'culture_audio:upload':
        case 'culture_audio:persist':
          setAudioStage(event.type.split(':')[1]);
          break;
        case 'culture_audio:complete':
          setAudioStage(null);
          setStreamEnabled(false);
          setAudioCooldown(true);
          setTimeout(() => setAudioCooldown(false), 15000);
          toast({ title: t('cultureAudio.success') });
          break;
        case 'culture_audio:error': {
          const d = event.data as { error?: string };
          setAudioStage(null);
          setStreamEnabled(false);
          toast({ title: d.error ?? t('cultureAudio.error'), variant: 'destructive' });
          break;
        }
      }
    },
    [t]
  );

  // Wire SSE for audio generation
  useSSE(question ? getCultureQuestionAudioStreamUrl(question.id) : '', {
    method: 'POST',
    body: {},
    enabled: streamEnabled && !!question,
    onEvent: handleAudioSSEEvent,
    onError: () => {
      setAudioStage(null);
      setStreamEnabled(false);
      toast({ title: t('cultureAudio.error'), variant: 'destructive' });
    },
    maxRetries: 0,
    reconnect: false,
  });

  // Handle audio generation button click
  const handleGenerateAudio = useCallback(() => {
    if (!question || streamEnabled || audioCooldown) return;
    setAudioStage(null);
    setStreamEnabled(true);
  }, [question, streamEnabled, audioCooldown]);

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

  // Derive audio status for AudioStatusBadge / AudioGenerateButton
  const audioStatus: AudioStatus = streamEnabled
    ? 'generating'
    : question?.audio_s3_key
      ? 'ready'
      : 'missing';

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

          {question && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <AudioStatusBadge status={audioStatus} data-testid="audio-status" />
              {question.news_item_id ? (
                <span className="text-sm text-muted-foreground" data-testid="audio-managed-by-news">
                  {t('cultureAudio.managedByNews')}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <AudioGenerateButton
                    status={audioStatus}
                    onClick={handleGenerateAudio}
                    isLoading={audioCooldown}
                    data-testid="generate-audio-btn"
                  />
                  {audioStage && (
                    <span className="text-xs text-muted-foreground">{audioStage}</span>
                  )}
                </div>
              )}
            </div>
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
