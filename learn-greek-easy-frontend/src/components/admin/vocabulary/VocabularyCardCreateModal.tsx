// src/components/admin/vocabulary/VocabularyCardCreateModal.tsx

/**
 * VocabularyCardCreateModal - Modal for creating vocabulary cards with tabs.
 *
 * Features:
 * - Three tabs: Basic Info, Grammar (conditional), Examples
 * - Grammar tab only visible when part_of_speech is selected
 * - Auto-switch to Grammar tab when part_of_speech is selected
 * - Success state with Create Another/Done buttons
 * - Cancel confirmation dialog for unsaved changes
 * - Loading state during submission
 * - Error handling with toast notifications
 */

import { useCallback, useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, Loader2 } from 'lucide-react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { cardAPI, type CardCreatePayload } from '@/services/cardAPI';

import { BasicInfoTab } from './BasicInfoTab';
import { ExamplesTab } from './ExamplesTab';
import { GrammarTab } from './GrammarTab';
import { AlertDialog } from '../../dialogs/AlertDialog';

// ============================================
// Types
// ============================================

type ViewState = 'form' | 'success';
type TabValue = 'basic' | 'grammar' | 'examples';

export interface VocabularyCardCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  deckLevel?: string;
  onSuccess?: () => void;
}

// ============================================
// Schema
// ============================================

const vocabularyCardCreateSchema = z.object({
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

type VocabularyCardFormData = z.infer<typeof vocabularyCardCreateSchema>;

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
// Component
// ============================================

export function VocabularyCardCreateModal({
  open,
  onOpenChange,
  deckId,
  deckLevel,
  onSuccess,
}: VocabularyCardCreateModalProps) {
  const { t } = useTranslation('admin');

  // State
  const [view, setView] = useState<ViewState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('basic');
  const [formKey, setFormKey] = useState(0);

  // Form setup
  const methods = useForm<VocabularyCardFormData>({
    resolver: zodResolver(vocabularyCardCreateSchema),
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

  // Auto-switch to Grammar tab when part_of_speech is selected
  useEffect(() => {
    if (partOfSpeech && activeTab === 'basic') {
      setActiveTab('grammar');
    }
  }, [partOfSpeech, activeTab]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      const timeout = setTimeout(() => {
        setView('form');
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
        // Build payload
        const payload: CardCreatePayload = {
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

        await cardAPI.create(payload);
        setView('success');
      } catch {
        toast({
          title: t('vocabularyCard.createModal.errorToast'),
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [deckId, t]
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

  // Handle "Create Another" button
  const handleCreateAnother = useCallback(() => {
    setView('form');
    setActiveTab('basic');
    reset(defaultValues);
    setFormKey((prev) => prev + 1);
  }, [reset]);

  // Handle "Done" button
  const handleDone = useCallback(() => {
    onOpenChange(false);
    onSuccess?.();
  }, [onOpenChange, onSuccess]);

  // Prevent closing when dirty
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && isDirty && view === 'form') {
        setShowCancelConfirm(true);
        return;
      }
      onOpenChange(newOpen);
    },
    [isDirty, view, onOpenChange]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
          data-testid="vocabulary-card-create-modal"
        >
          {view === 'form' ? (
            <FormProvider {...methods}>
              <form onSubmit={handleSubmit(onSubmit)} key={formKey}>
                <DialogHeader>
                  <DialogTitle>{t('vocabularyCard.createModal.title')}</DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                  <Tabs
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as TabValue)}
                    data-testid="vocabulary-card-create-tabs"
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
                    data-testid="vocabulary-card-create-cancel"
                  >
                    {t('vocabularyCard.createModal.cancelButton')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="vocabulary-card-create-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('vocabularyCard.createModal.creatingButton')}
                      </>
                    ) : (
                      t('vocabularyCard.createModal.createButton')
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </FormProvider>
          ) : (
            /* Success State */
            <div data-testid="vocabulary-card-create-success">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  {t('vocabularyCard.createModal.successTitle')}
                </DialogTitle>
              </DialogHeader>

              <p className="mt-4 text-muted-foreground">
                {t('vocabularyCard.createModal.successMessage')}
              </p>

              <DialogFooter className="mt-6 gap-2">
                <Button
                  variant="outline"
                  onClick={handleCreateAnother}
                  data-testid="vocabulary-card-create-another"
                >
                  {t('vocabularyCard.createModal.createAnotherButton')}
                </Button>
                <Button onClick={handleDone} data-testid="vocabulary-card-create-done">
                  {t('vocabularyCard.createModal.doneButton')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title={t('vocabularyCard.createModal.cancelConfirmTitle')}
        description={t('vocabularyCard.createModal.cancelConfirmMessage')}
        variant="warning"
        dismissible={false}
        actions={[
          {
            label: t('vocabularyCard.createModal.cancelConfirmNo'),
            onClick: () => setShowCancelConfirm(false),
            variant: 'outline',
          },
          {
            label: t('vocabularyCard.createModal.cancelConfirmYes'),
            onClick: handleDiscard,
            variant: 'destructive',
          },
        ]}
      />
    </>
  );
}

export default VocabularyCardCreateModal;
