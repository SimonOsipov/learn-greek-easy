// src/components/admin/vocabulary/VocabularyCardEditModal.tsx

/**
 * VocabularyCardEditModal - Modal for editing vocabulary cards with tabs.
 *
 * Features:
 * - Three tabs: Basic Info, Grammar (conditional), Examples
 * - Grammar tab only visible when part_of_speech is selected
 * - Skeleton loading state while fetching card data
 * - Pre-populate form with existing card data on open
 * - Handle null grammar data gracefully
 * - Track dirty state for unsaved changes confirmation
 * - On save: call PATCH /api/v1/cards/{card_id}
 * - Success toast and call onSuccess callback
 */

import { useCallback, useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { cardAPI, type CardCreatePayload, type CardResponse } from '@/services/cardAPI';

import { BasicInfoTab } from './BasicInfoTab';
import { ExamplesTab } from './ExamplesTab';
import { GrammarTab } from './GrammarTab';
import { AlertDialog } from '../../dialogs/AlertDialog';

// ============================================
// Types
// ============================================

type TabValue = 'basic' | 'grammar' | 'examples';
type LoadingState = 'loading' | 'error' | 'ready';

export interface VocabularyCardEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  deckId: string;
  deckLevel?: string;
  onSuccess?: () => void;
}

// ============================================
// Schema
// ============================================

const vocabularyCardEditSchema = z.object({
  front_text: z.string().min(1, 'Greek text is required'),
  back_text_en: z.string().min(1, 'English translation is required'),
  back_text_ru: z.string().optional().or(z.literal('')),
  example_sentence: z.string().optional().or(z.literal('')),
  pronunciation: z.string().max(255).optional().or(z.literal('')),
  part_of_speech: z.enum(['noun', 'verb', 'adjective', 'adverb']).optional().nullable(),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional().nullable(),
  noun_data: z.any().optional().nullable(),
  verb_data: z.any().optional().nullable(),
  adjective_data: z.any().optional().nullable(),
  adverb_data: z.any().optional().nullable(),
  examples: z
    .array(
      z.object({
        greek: z.string().max(1000),
        english: z.string().max(1000).optional().or(z.literal('')),
        russian: z.string().max(1000).optional().or(z.literal('')),
        tense: z.string().optional().nullable(),
      })
    )
    .optional(),
});

type VocabularyCardFormData = z.infer<typeof vocabularyCardEditSchema>;

const defaultValues: VocabularyCardFormData = {
  front_text: '',
  back_text_en: '',
  back_text_ru: '',
  example_sentence: '',
  pronunciation: '',
  part_of_speech: null,
  level: null,
  noun_data: null,
  verb_data: null,
  adjective_data: null,
  adverb_data: null,
  examples: [],
};

// ============================================
// Helper Functions
// ============================================

/**
 * Convert CardResponse to form data, handling null values gracefully
 */
function cardResponseToFormData(card: CardResponse): VocabularyCardFormData {
  return {
    front_text: card.front_text,
    back_text_en: card.back_text_en,
    back_text_ru: card.back_text_ru || '',
    example_sentence: card.example_sentence || '',
    pronunciation: card.pronunciation || '',
    part_of_speech: card.part_of_speech || null,
    level: card.level || null,
    noun_data: card.noun_data || null,
    verb_data: card.verb_data || null,
    adjective_data: card.adjective_data || null,
    adverb_data: card.adverb_data || null,
    examples: card.examples || [],
  };
}

// ============================================
// Component
// ============================================

export function VocabularyCardEditModal({
  open,
  onOpenChange,
  cardId,
  deckId,
  deckLevel,
  onSuccess,
}: VocabularyCardEditModalProps) {
  const { t } = useTranslation('admin');

  // State
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('basic');
  const [formKey, setFormKey] = useState(0);

  // Form setup
  const methods = useForm<VocabularyCardFormData>({
    resolver: zodResolver(vocabularyCardEditSchema),
    mode: 'onChange',
    defaultValues,
  });

  const {
    handleSubmit,
    reset,
    control,
    formState: { isDirty },
  } = methods;

  // Watch part_of_speech for conditional Grammar tab
  const partOfSpeech = useWatch({ control, name: 'part_of_speech' });
  const showGrammarTab = !!partOfSpeech;

  // Fetch card data when modal opens
  const fetchCardData = useCallback(async () => {
    if (!cardId) return;

    setLoadingState('loading');
    try {
      const card = await cardAPI.getById(cardId);
      const formData = cardResponseToFormData(card);
      reset(formData);
      setLoadingState('ready');
      // Increment form key to ensure form is re-initialized with new data
      setFormKey((prev) => prev + 1);
    } catch {
      setLoadingState('error');
    }
  }, [cardId, reset]);

  // Fetch card data when modal opens
  useEffect(() => {
    if (open && cardId) {
      fetchCardData();
      setActiveTab('basic');
    }
  }, [open, cardId, fetchCardData]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      const timeout = setTimeout(() => {
        setLoadingState('loading');
        setActiveTab('basic');
        reset(defaultValues);
        setFormKey((prev) => prev + 1);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [open, reset]);

  // Handle form submission
  const onSubmit = useCallback(
    async (data: VocabularyCardFormData) => {
      setIsSubmitting(true);
      try {
        // Build payload with only changed fields
        const payload: Partial<CardCreatePayload> = {
          deck_id: deckId,
          front_text: data.front_text,
          back_text_en: data.back_text_en,
          back_text_ru: data.back_text_ru || null,
          example_sentence: data.example_sentence || null,
          pronunciation: data.pronunciation || null,
          part_of_speech: data.part_of_speech || null,
          level: data.level || null,
          noun_data: data.noun_data || null,
          verb_data: data.verb_data || null,
          adjective_data: data.adjective_data || null,
          adverb_data: data.adverb_data || null,
          examples: data.examples?.length ? data.examples : null,
        };

        await cardAPI.update(cardId, payload);

        toast({
          title: t('vocabularyCard.editModal.successToast'),
        });

        onOpenChange(false);
        onSuccess?.();
      } catch {
        toast({
          title: t('vocabularyCard.editModal.errorToast'),
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [cardId, deckId, t, onOpenChange, onSuccess]
  );

  // Handle cancel button click
  const handleCancel = useCallback(() => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      onOpenChange(false);
    }
  }, [isDirty, onOpenChange]);

  // Handle discard confirmation
  const handleDiscard = useCallback(() => {
    setShowCancelConfirm(false);
    onOpenChange(false);
  }, [onOpenChange]);

  // Prevent closing when dirty
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && isDirty && loadingState === 'ready') {
        setShowCancelConfirm(true);
        return;
      }
      onOpenChange(newOpen);
    },
    [isDirty, loadingState, onOpenChange]
  );

  // Handle retry on error
  const handleRetry = useCallback(() => {
    fetchCardData();
  }, [fetchCardData]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
          data-testid="vocabulary-card-edit-modal"
        >
          <DialogHeader>
            <DialogTitle>{t('vocabularyCard.editModal.title')}</DialogTitle>
          </DialogHeader>

          {/* Loading State */}
          {loadingState === 'loading' && (
            <div className="space-y-4 py-4" data-testid="vocabulary-card-edit-loading">
              {/* Tabs skeleton */}
              <div className="flex gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
              {/* Form fields skeleton */}
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-2/3" />
              </div>
            </div>
          )}

          {/* Error State */}
          {loadingState === 'error' && (
            <div className="py-4" data-testid="vocabulary-card-edit-error">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{t('vocabularyCard.editModal.loadingError')}</span>
                  <Button variant="outline" size="sm" onClick={handleRetry}>
                    {t('vocabularyCard.editModal.retryButton')}
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Form */}
          {loadingState === 'ready' && (
            <FormProvider {...methods}>
              <form onSubmit={handleSubmit(onSubmit)} key={formKey}>
                <div className="mt-4">
                  <Tabs
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as TabValue)}
                    data-testid="vocabulary-card-edit-tabs"
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="basic" className="flex-1">
                        {t('vocabularyCard.tabs.basicInfo')}
                      </TabsTrigger>
                      {showGrammarTab && (
                        <TabsTrigger value="grammar" className="flex-1">
                          {t('vocabularyCard.tabs.grammar')}
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="examples" className="flex-1">
                        {t('vocabularyCard.tabs.examples')}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="mt-4">
                      <BasicInfoTab isSubmitting={isSubmitting} deckLevel={deckLevel} />
                    </TabsContent>

                    {showGrammarTab && (
                      <TabsContent value="grammar" className="mt-4">
                        <GrammarTab isSubmitting={isSubmitting} />
                      </TabsContent>
                    )}

                    <TabsContent value="examples" className="mt-4">
                      <ExamplesTab isSubmitting={isSubmitting} />
                    </TabsContent>
                  </Tabs>
                </div>

                <DialogFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    data-testid="vocabulary-card-edit-cancel"
                  >
                    {t('vocabularyCard.editModal.cancelButton')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="vocabulary-card-edit-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('vocabularyCard.editModal.savingButton')}
                      </>
                    ) : (
                      t('vocabularyCard.editModal.saveButton')
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </FormProvider>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title={t('vocabularyCard.editModal.cancelConfirmTitle')}
        description={t('vocabularyCard.editModal.cancelConfirmMessage')}
        variant="warning"
        dismissible={false}
        actions={[
          {
            label: t('vocabularyCard.editModal.cancelConfirmNo'),
            onClick: () => setShowCancelConfirm(false),
            variant: 'outline',
          },
          {
            label: t('vocabularyCard.editModal.cancelConfirmYes'),
            onClick: handleDiscard,
            variant: 'destructive',
          },
        ]}
      />
    </>
  );
}

export default VocabularyCardEditModal;
