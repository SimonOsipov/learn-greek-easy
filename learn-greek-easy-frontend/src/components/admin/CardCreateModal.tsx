/**
 * CardCreateModal - Modal for creating culture cards.
 *
 * Features:
 * - Card type dropdown (Culture or Vocabulary) when no deckId
 * - Deck dropdown for selecting target deck when no deckId
 * - CultureCardForm integration
 * - Success state with Create Another/Done buttons
 * - Cancel confirmation for unsaved changes
 */

import { useCallback, useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import type {
  CultureDeckListItem,
  CultureQuestionCreatePayload,
  UnifiedDeckItem,
} from '@/services/adminAPI';
import { adminAPI } from '@/services/adminAPI';
import { cardAPI, type CardCreatePayload } from '@/services/cardAPI';

import { CultureCardForm } from './CultureCardForm';
import { BasicInfoTab } from './vocabulary/BasicInfoTab';
import { ExamplesTab } from './vocabulary/ExamplesTab';
import { AlertDialog } from '../dialogs/AlertDialog';
import { AdjectiveGrammarForm } from './vocabulary/grammar/AdjectiveGrammarForm';
import { AdverbGrammarForm } from './vocabulary/grammar/AdverbGrammarForm';
import { NounGrammarForm } from './vocabulary/grammar/NounGrammarForm';
import { VerbGrammarForm } from './vocabulary/grammar/VerbGrammarForm';

// ============================================
// Types
// ============================================

type CardType = 'culture' | 'vocabulary';
type ViewState = 'form' | 'success';

export interface CardCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId?: string;
  onSuccess?: () => void;
}

// ============================================
// Vocabulary Card Schema
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

const vocabularyDefaultValues: VocabularyCardFormData = {
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

export function CardCreateModal({ open, onOpenChange, deckId, onSuccess }: CardCreateModalProps) {
  const { t } = useTranslation('admin');

  // State
  const [view, setView] = useState<ViewState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [cardType, setCardType] = useState<CardType>('culture');
  const [decks, setDecks] = useState<CultureDeckListItem[]>([]);
  const [vocabularyDecks, setVocabularyDecks] = useState<UnifiedDeckItem[]>([]);
  const [isLoadingDecks, setIsLoadingDecks] = useState(false);
  const [formKey, setFormKey] = useState(0);

  // Vocabulary form state - tabs by part of speech
  type TabValue = 'general' | 'noun' | 'verb' | 'adjective' | 'adverb';
  const [activeTab, setActiveTab] = useState<TabValue>('general');

  // Vocabulary form setup
  const vocabForm = useForm<VocabularyCardFormData>({
    resolver: zodResolver(vocabularyCardSchema),
    mode: 'onChange',
    defaultValues: vocabularyDefaultValues,
  });

  // Determine effective deck ID
  const effectiveDeckId = deckId || selectedDeckId;

  // Compute which decks to show based on card type
  const decksToShow = cardType === 'vocabulary' ? vocabularyDecks : decks;

  // Helper to get deck name as string (vocabulary decks may have MultilingualName)
  const getDeckName = (deck: CultureDeckListItem | UnifiedDeckItem): string => {
    return typeof deck.name === 'string' ? deck.name : deck.name.en;
  };

  // Fetch decks when modal opens (only when no deckId prop)
  useEffect(() => {
    if (open && !deckId) {
      setIsLoadingDecks(true);
      adminAPI
        .getCultureDecks()
        .then((fetchedDecks) => {
          setDecks(fetchedDecks);
        })
        .catch(() => {
          toast({
            title: t('errors.loadingDecks'),
            variant: 'destructive',
          });
        })
        .finally(() => {
          setIsLoadingDecks(false);
        });
    }
  }, [open, deckId, t]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Delay reset to allow close animation
      const timeout = setTimeout(() => {
        setView('form');
        setIsDirty(false);
        setSelectedDeckId('');
        setCardType('culture');
        setFormKey((prev) => prev + 1);
        // Reset vocabulary form state
        setActiveTab('general');
        vocabForm.reset(vocabularyDefaultValues);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [open, vocabForm]);

  // Fetch vocabulary decks when card type changes to vocabulary
  useEffect(() => {
    // Reset selected deck when card type changes
    setSelectedDeckId('');

    if (cardType === 'vocabulary') {
      adminAPI.listDecks({ type: 'vocabulary' }).then((res) => {
        setVocabularyDecks(res.decks);
      });
    }
  }, [cardType]);

  // Track vocabulary form dirty state
  useEffect(() => {
    if (cardType === 'vocabulary') {
      setIsDirty(vocabForm.formState.isDirty);
    }
  }, [cardType, vocabForm.formState.isDirty]);

  // Handle dirty state changes from form
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  // Handle form submission
  const handleSubmit = async (data: CultureQuestionCreatePayload) => {
    setIsSubmitting(true);
    try {
      await adminAPI.createCultureQuestion({
        ...data,
        deck_id: effectiveDeckId,
      });
      setView('success');
      setIsDirty(false);
    } catch {
      toast({
        title: t('errors.createFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle vocabulary form submission
  const handleVocabularySubmit = async (data: VocabularyCardFormData) => {
    setIsSubmitting(true);
    try {
      const payload: CardCreatePayload = {
        deck_id: effectiveDeckId,
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
      setIsDirty(false);
    } catch {
      toast({
        title: t('vocabularyCard.createModal.errorToast'),
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

  // Handle "Create Another" button
  const handleCreateAnother = () => {
    setView('form');
    setFormKey((prev) => prev + 1);
    // Reset vocabulary form when creating another
    if (cardType === 'vocabulary') {
      vocabForm.reset(vocabularyDefaultValues);
      setActiveTab('general');
    }
  };

  // Handle "Done" button
  const handleDone = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  // Prevent closing when dirty
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      setShowCancelConfirm(true);
      return;
    }
    onOpenChange(newOpen);
  };

  // Check if form can be submitted
  const canSubmit = effectiveDeckId && !isSubmitting;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]"
          data-testid="card-create-modal"
        >
          {view === 'form' ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('cardCreate.title')}</DialogTitle>
                <DialogDescription>{t('cardCreate.description')}</DialogDescription>
              </DialogHeader>

              {/* Card Type and Deck Selection - only when no deckId prop */}
              {!deckId && (
                <div className="space-y-4">
                  {/* Card Type Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="card-type-select">{t('cardCreate.cardType')}</Label>
                    <Select
                      value={cardType}
                      onValueChange={(value: CardType) => setCardType(value)}
                    >
                      <SelectTrigger id="card-type-select" data-testid="card-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="culture">{t('cardCreate.culture')}</SelectItem>
                        <SelectItem value="vocabulary">{t('cardCreate.vocabulary')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Deck Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="deck-select">{t('cardCreate.selectDeck')}</Label>
                    <Select
                      value={selectedDeckId}
                      onValueChange={setSelectedDeckId}
                      disabled={isLoadingDecks}
                    >
                      <SelectTrigger id="deck-select" data-testid="deck-select">
                        <SelectValue placeholder={t('cardCreate.selectDeckPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {decksToShow.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            {t('cardCreate.noDecks')}
                          </SelectItem>
                        ) : (
                          decksToShow.map((deck) => (
                            <SelectItem key={deck.id} value={deck.id}>
                              {getDeckName(deck)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Culture Card Form */}
              {cardType === 'culture' && (
                <CultureCardForm
                  key={formKey}
                  deckId={effectiveDeckId}
                  onSubmit={handleSubmit}
                  onDirtyChange={handleDirtyChange}
                  isSubmitting={isSubmitting}
                />
              )}

              {/* Vocabulary Card Form */}
              {cardType === 'vocabulary' && selectedDeckId && (
                <FormProvider {...vocabForm}>
                  <form
                    id="vocabulary-card-form"
                    data-testid="vocabulary-card-form"
                    onSubmit={vocabForm.handleSubmit(handleVocabularySubmit)}
                  >
                    <div className="mt-4">
                      <Tabs
                        value={activeTab}
                        onValueChange={(value) => {
                          setActiveTab(value as TabValue);
                          const posMap: Record<string, string | null> = {
                            general: null,
                            noun: 'noun',
                            verb: 'verb',
                            adjective: 'adjective',
                            adverb: 'adverb',
                          };
                          if (value in posMap) {
                            vocabForm.setValue(
                              'part_of_speech',
                              posMap[value] as 'noun' | 'verb' | 'adjective' | 'adverb' | null
                            );
                          }
                        }}
                        data-testid="vocabulary-card-tabs"
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
                          <BasicInfoTab isSubmitting={isSubmitting} showPartOfSpeech={false} />
                          <ExamplesTab isSubmitting={isSubmitting} />
                        </TabsContent>

                        {/* Noun Tab - BasicInfo + NounGrammar + Examples */}
                        <TabsContent value="noun" className="mt-4 space-y-6">
                          <BasicInfoTab isSubmitting={isSubmitting} showPartOfSpeech={false} />
                          <NounGrammarForm isSubmitting={isSubmitting} />
                          <ExamplesTab isSubmitting={isSubmitting} />
                        </TabsContent>

                        {/* Verb Tab - BasicInfo + VerbGrammar + Examples */}
                        <TabsContent value="verb" className="mt-4 space-y-6">
                          <BasicInfoTab isSubmitting={isSubmitting} showPartOfSpeech={false} />
                          <VerbGrammarForm isSubmitting={isSubmitting} />
                          <ExamplesTab isSubmitting={isSubmitting} />
                        </TabsContent>

                        {/* Adjective Tab - BasicInfo + AdjectiveGrammar + Examples */}
                        <TabsContent value="adjective" className="mt-4 space-y-6">
                          <BasicInfoTab isSubmitting={isSubmitting} showPartOfSpeech={false} />
                          <AdjectiveGrammarForm isSubmitting={isSubmitting} />
                          <ExamplesTab isSubmitting={isSubmitting} />
                        </TabsContent>

                        {/* Adverb Tab - BasicInfo + AdverbGrammar + Examples */}
                        <TabsContent value="adverb" className="mt-4 space-y-6">
                          <BasicInfoTab isSubmitting={isSubmitting} showPartOfSpeech={false} />
                          <AdverbGrammarForm isSubmitting={isSubmitting} />
                          <ExamplesTab isSubmitting={isSubmitting} />
                        </TabsContent>
                      </Tabs>
                    </div>
                  </form>
                </FormProvider>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  data-testid="cancel-btn"
                >
                  {t('cardCreate.cancel')}
                </Button>
                <Button
                  type="submit"
                  form={cardType === 'vocabulary' ? 'vocabulary-card-form' : 'culture-card-form'}
                  disabled={!canSubmit}
                  data-testid="create-btn"
                >
                  {isSubmitting ? t('cardCreate.creating') : t('cardCreate.create')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* Success State */
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  {t('cardCreate.successTitle')}
                </DialogTitle>
                <DialogDescription>{t('cardCreate.successMessage')}</DialogDescription>
              </DialogHeader>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={handleCreateAnother}
                  data-testid="create-another-btn"
                >
                  {t('cardCreate.createAnother')}
                </Button>
                <Button onClick={handleDone} data-testid="done-btn">
                  {t('cardCreate.done')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title={t('cardCreate.discardTitle')}
        description={t('cardCreate.discardMessage')}
        variant="warning"
        dismissible={false}
        actions={[
          {
            label: t('cardCreate.keepEditing'),
            onClick: () => setShowCancelConfirm(false),
            variant: 'outline',
          },
          {
            label: t('cardCreate.discard'),
            onClick: handleDiscard,
            variant: 'destructive',
          },
        ]}
      />
    </>
  );
}

export default CardCreateModal;
