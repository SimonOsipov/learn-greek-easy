// src/components/admin/vocabulary/V1CardEditInDialog.tsx

/**
 * V1CardEditInDialog - Renders the V1 vocabulary card edit form as inline dialog content.
 *
 * Unlike VocabularyCardEditModal, this component has NO Dialog wrapper.
 * It is rendered directly inside DeckDetailModal's DialogContent,
 * following the same in-dialog content-swap pattern as V2 word entry detail.
 */

import { useCallback, useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import type { AdminVocabularyCard } from '@/services/adminAPI';
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

export interface V1CardEditInDialogProps {
  card: AdminVocabularyCard;
  deckId: string;
  deckLevel?: string;
  onBack: () => void;
  onSaved: () => void;
}

// ============================================
// Schema (same as VocabularyCardEditModal)
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
// Helper
// ============================================

function cardResponseToFormData(cardData: CardResponse): VocabularyCardFormData {
  return {
    front_text: cardData.front_text,
    back_text_en: cardData.back_text_en,
    back_text_ru: cardData.back_text_ru || '',
    example_sentence: cardData.example_sentence || '',
    pronunciation: cardData.pronunciation || '',
    part_of_speech: cardData.part_of_speech || null,
    level: cardData.level || null,
    noun_data: cardData.noun_data || null,
    verb_data: cardData.verb_data || null,
    adjective_data: cardData.adjective_data || null,
    adverb_data: cardData.adverb_data || null,
    examples: cardData.examples || [],
  };
}

// ============================================
// Component
// ============================================

export function V1CardEditInDialog({
  card,
  deckId,
  deckLevel,
  onBack,
  onSaved,
}: V1CardEditInDialogProps) {
  const { t } = useTranslation('admin');

  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('basic');
  const [formKey, setFormKey] = useState(0);

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

  const partOfSpeech = useWatch({ control, name: 'part_of_speech' });
  const showGrammarTab = !!partOfSpeech;

  const fetchCardData = useCallback(async () => {
    setLoadingState('loading');
    try {
      const cardData = await cardAPI.getById(card.id);
      reset(cardResponseToFormData(cardData));
      setLoadingState('ready');
      setFormKey((prev) => prev + 1);
    } catch {
      setLoadingState('error');
    }
  }, [card.id, reset]);

  useEffect(() => {
    fetchCardData();
    setActiveTab('basic');
  }, [fetchCardData]);

  const onSubmit = useCallback(
    async (data: VocabularyCardFormData) => {
      setIsSubmitting(true);
      try {
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

        await cardAPI.update(card.id, payload);

        toast({ title: t('vocabularyCard.editModal.successToast') });
        onSaved();
      } catch {
        toast({
          title: t('vocabularyCard.editModal.errorToast'),
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [card.id, deckId, t, onSaved]
  );

  const handleBack = useCallback(() => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      onBack();
    }
  }, [isDirty, onBack]);

  const handleDiscard = useCallback(() => {
    setShowCancelConfirm(false);
    onBack();
  }, [onBack]);

  const handleRetry = useCallback(() => {
    fetchCardData();
  }, [fetchCardData]);

  return (
    <>
      {/* Loading State */}
      {loadingState === 'loading' && (
        <div className="space-y-4 py-4" data-testid="v1-card-edit-loading">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
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
        <div className="py-4" data-testid="v1-card-edit-error">
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
                data-testid="v1-card-edit-tabs"
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

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
                data-testid="v1-card-edit-cancel"
              >
                {t('vocabularyCard.editModal.cancelButton')}
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="v1-card-edit-submit">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('vocabularyCard.editModal.savingButton')}
                  </>
                ) : (
                  t('vocabularyCard.editModal.saveButton')
                )}
              </Button>
            </div>
          </form>
        </FormProvider>
      )}

      {/* Cancel Confirmation */}
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
