// src/components/vocabulary/UserVocabularyCardCreateModal.tsx

/**
 * UserVocabularyCardCreateModal - Modal for creating vocabulary cards with 5 part-of-speech tabs.
 *
 * Features:
 * - 5 tabs: General | Noun | Verb | Adjective | Adverb
 * - Each tab: BasicInfo + Grammar form (if applicable) + Examples
 * - Success state with Create Another/Done buttons
 * - Cancel confirmation dialog for unsaved changes
 * - Loading state during submission
 * - Error handling with toast notifications
 *
 * This matches the admin CardCreateModal vocabulary UI pattern.
 */

import { useCallback, useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, Loader2 } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { BasicInfoTab } from '@/components/admin/vocabulary/BasicInfoTab';
import { ExamplesTab } from '@/components/admin/vocabulary/ExamplesTab';
import { AdjectiveGrammarForm } from '@/components/admin/vocabulary/grammar/AdjectiveGrammarForm';
import { AdverbGrammarForm } from '@/components/admin/vocabulary/grammar/AdverbGrammarForm';
import { NounGrammarForm } from '@/components/admin/vocabulary/grammar/NounGrammarForm';
import { VerbGrammarForm } from '@/components/admin/vocabulary/grammar/VerbGrammarForm';
import { AlertDialog } from '@/components/dialogs/AlertDialog';
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

// ============================================
// Types
// ============================================

type ViewState = 'form' | 'success';
type TabValue = 'general' | 'noun' | 'verb' | 'adjective' | 'adverb';

export interface UserVocabularyCardCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  deckLevel?: string;
  onSuccess?: () => void;
}

// ============================================
// Schema
// ============================================

const vocabularyCardSchema = z.object({
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

type VocabularyCardFormData = z.infer<typeof vocabularyCardSchema>;

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

export function UserVocabularyCardCreateModal({
  open,
  onOpenChange,
  deckId,
  deckLevel,
  onSuccess,
}: UserVocabularyCardCreateModalProps) {
  const { t } = useTranslation('admin');

  // State
  const [view, setView] = useState<ViewState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('general');
  const [formKey, setFormKey] = useState(0);

  // Form setup
  const methods = useForm<VocabularyCardFormData>({
    resolver: zodResolver(vocabularyCardSchema),
    mode: 'onChange',
    defaultValues,
  });

  const {
    handleSubmit,
    reset,
    setValue,
    formState: { isDirty },
  } = methods;

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      const timeout = setTimeout(() => {
        setView('form');
        setActiveTab('general');
        reset(defaultValues);
        setFormKey((prev) => prev + 1);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [open, reset]);

  // Handle tab change - set part_of_speech and clear other grammar data
  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value as TabValue);
      const posMap: Record<string, 'noun' | 'verb' | 'adjective' | 'adverb' | null> = {
        general: null,
        noun: 'noun',
        verb: 'verb',
        adjective: 'adjective',
        adverb: 'adverb',
      };
      setValue('part_of_speech', posMap[value] ?? null);

      // Clear grammar data for other types
      if (value !== 'noun') setValue('noun_data', null);
      if (value !== 'verb') setValue('verb_data', null);
      if (value !== 'adjective') setValue('adjective_data', null);
      if (value !== 'adverb') setValue('adverb_data', null);
    },
    [setValue]
  );

  // Handle form submission
  const onSubmit = useCallback(
    async (data: VocabularyCardFormData) => {
      setIsSubmitting(true);
      try {
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
    setActiveTab('general');
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
          className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]"
          data-testid="user-vocabulary-card-create-modal"
        >
          {view === 'form' ? (
            <FormProvider {...methods}>
              <form
                id="user-vocabulary-card-form"
                onSubmit={handleSubmit(onSubmit)}
                key={formKey}
                data-testid="user-vocabulary-card-form"
              >
                <DialogHeader>
                  <DialogTitle>{t('vocabularyCard.createModal.title')}</DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                  <Tabs
                    value={activeTab}
                    onValueChange={handleTabChange}
                    data-testid="user-vocabulary-card-tabs"
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="general" className="flex-1">
                        {t('vocabularyCard.posTabs.general')}
                      </TabsTrigger>
                      <TabsTrigger value="noun" className="flex-1">
                        {t('vocabularyCard.partOfSpeechOptions.noun')}
                      </TabsTrigger>
                      <TabsTrigger value="verb" className="flex-1">
                        {t('vocabularyCard.partOfSpeechOptions.verb')}
                      </TabsTrigger>
                      <TabsTrigger value="adjective" className="flex-1">
                        {t('vocabularyCard.partOfSpeechOptions.adjective')}
                      </TabsTrigger>
                      <TabsTrigger value="adverb" className="flex-1">
                        {t('vocabularyCard.partOfSpeechOptions.adverb')}
                      </TabsTrigger>
                    </TabsList>

                    {/* General Tab - BasicInfo + Examples only */}
                    <TabsContent value="general" className="mt-4 space-y-6">
                      <BasicInfoTab
                        isSubmitting={isSubmitting}
                        showPartOfSpeech={false}
                        deckLevel={deckLevel}
                      />
                      <ExamplesTab isSubmitting={isSubmitting} />
                    </TabsContent>

                    {/* Noun Tab - BasicInfo + NounGrammar + Examples */}
                    <TabsContent value="noun" className="mt-4 space-y-6">
                      <BasicInfoTab
                        isSubmitting={isSubmitting}
                        showPartOfSpeech={false}
                        deckLevel={deckLevel}
                      />
                      <NounGrammarForm isSubmitting={isSubmitting} />
                      <ExamplesTab isSubmitting={isSubmitting} />
                    </TabsContent>

                    {/* Verb Tab - BasicInfo + VerbGrammar + Examples */}
                    <TabsContent value="verb" className="mt-4 space-y-6">
                      <BasicInfoTab
                        isSubmitting={isSubmitting}
                        showPartOfSpeech={false}
                        deckLevel={deckLevel}
                      />
                      <VerbGrammarForm isSubmitting={isSubmitting} />
                      <ExamplesTab isSubmitting={isSubmitting} />
                    </TabsContent>

                    {/* Adjective Tab - BasicInfo + AdjectiveGrammar + Examples */}
                    <TabsContent value="adjective" className="mt-4 space-y-6">
                      <BasicInfoTab
                        isSubmitting={isSubmitting}
                        showPartOfSpeech={false}
                        deckLevel={deckLevel}
                      />
                      <AdjectiveGrammarForm isSubmitting={isSubmitting} />
                      <ExamplesTab isSubmitting={isSubmitting} />
                    </TabsContent>

                    {/* Adverb Tab - BasicInfo + AdverbGrammar + Examples */}
                    <TabsContent value="adverb" className="mt-4 space-y-6">
                      <BasicInfoTab
                        isSubmitting={isSubmitting}
                        showPartOfSpeech={false}
                        deckLevel={deckLevel}
                      />
                      <AdverbGrammarForm isSubmitting={isSubmitting} />
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
                    data-testid="user-vocabulary-card-cancel"
                  >
                    {t('vocabularyCard.createModal.cancelButton')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="user-vocabulary-card-submit"
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
            <div data-testid="user-vocabulary-card-create-success">
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
                  data-testid="user-vocabulary-card-create-another"
                >
                  {t('vocabularyCard.createModal.createAnotherButton')}
                </Button>
                <Button onClick={handleDone} data-testid="user-vocabulary-card-done">
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

export default UserVocabularyCardCreateModal;
