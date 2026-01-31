// src/components/admin/VocabularyCardForm.tsx

/**
 * VocabularyCardForm - Shared form for creating/editing vocabulary cards.
 *
 * Features:
 * - Greek text, English/Russian translations
 * - Optional pronunciation, part of speech, level override
 * - Example sentence field
 * - Dirty state tracking via onDirtyChange callback
 * - Form ID export for external submit button triggering
 */

import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CardResponse } from '@/services/cardAPI';

// ============================================
// Constants
// ============================================

export const VOCABULARY_CARD_FORM_ID = 'vocabulary-card-form';

const PART_OF_SPEECH_OPTIONS = ['noun', 'verb', 'adjective', 'adverb'] as const;
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

// ============================================
// Form Schema
// ============================================

const vocabularyCardSchema = z.object({
  front_text: z.string().min(1, 'Greek text is required'),
  back_text_en: z.string().min(1, 'English translation is required'),
  back_text_ru: z.string().optional().or(z.literal('')),
  example_sentence: z.string().optional().or(z.literal('')),
  pronunciation: z.string().max(255).optional().or(z.literal('')),
  part_of_speech: z.enum(['noun', 'verb', 'adjective', 'adverb']).optional().nullable(),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional().nullable(),
});

export type VocabularyCardFormData = z.infer<typeof vocabularyCardSchema>;

// ============================================
// Props Interface
// ============================================

export interface VocabularyCardFormProps {
  initialData?: CardResponse;
  onSubmit: (data: VocabularyCardFormData) => Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  isSubmitting?: boolean;
}

// ============================================
// Helper Functions
// ============================================

function getInitialFormData(initialData?: CardResponse): VocabularyCardFormData {
  if (!initialData) {
    return {
      front_text: '',
      back_text_en: '',
      back_text_ru: '',
      example_sentence: '',
      pronunciation: '',
      part_of_speech: null,
      level: null,
    };
  }

  return {
    front_text: initialData.front_text,
    back_text_en: initialData.back_text_en,
    back_text_ru: initialData.back_text_ru || '',
    example_sentence: initialData.example_sentence || '',
    pronunciation: initialData.pronunciation || '',
    part_of_speech: initialData.part_of_speech || null,
    level: initialData.level || null,
  };
}

// ============================================
// Component
// ============================================

export function VocabularyCardForm({
  initialData,
  onSubmit,
  onDirtyChange,
  isSubmitting = false,
}: VocabularyCardFormProps) {
  const { t } = useTranslation('admin');

  const form = useForm<VocabularyCardFormData>({
    resolver: zodResolver(vocabularyCardSchema),
    mode: 'onChange',
    defaultValues: getInitialFormData(initialData),
  });

  const { isDirty } = form.formState;

  // Track dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Reset form when initialData changes
  useEffect(() => {
    form.reset(getInitialFormData(initialData));
  }, [initialData, form]);

  const handleFormSubmit = async (data: VocabularyCardFormData) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form
        id={VOCABULARY_CARD_FORM_ID}
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="space-y-4"
        data-testid="vocabulary-card-form"
      >
        {/* Greek Word/Phrase */}
        <FormField
          control={form.control}
          name="front_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('vocabularyCard.frontText')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('vocabularyCard.frontTextPlaceholder')}
                  className="min-h-[80px]"
                  data-testid="front-text-input"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* English Translation */}
        <FormField
          control={form.control}
          name="back_text_en"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('vocabularyCard.backTextEn')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('vocabularyCard.backTextEnPlaceholder')}
                  data-testid="back-text-en-input"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Russian Translation (Optional) */}
        <FormField
          control={form.control}
          name="back_text_ru"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('vocabularyCard.backTextRu')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('vocabularyCard.backTextRuPlaceholder')}
                  data-testid="back-text-ru-input"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Pronunciation */}
        <FormField
          control={form.control}
          name="pronunciation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('vocabularyCard.pronunciation')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('vocabularyCard.pronunciationPlaceholder')}
                  data-testid="pronunciation-input"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Part of Speech */}
        <FormField
          control={form.control}
          name="part_of_speech"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('vocabularyCard.partOfSpeech')}</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === '' ? null : value)}
                value={field.value || ''}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger data-testid="part-of-speech-select">
                    <SelectValue placeholder={t('vocabularyCard.partOfSpeechPlaceholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PART_OF_SPEECH_OPTIONS.map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      {t(`vocabularyCard.partOfSpeechOptions.${pos}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* CEFR Level Override */}
        <FormField
          control={form.control}
          name="level"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('vocabularyCard.level')}</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === '' ? null : value)}
                value={field.value || ''}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger data-testid="level-select">
                    <SelectValue placeholder={t('vocabularyCard.levelPlaceholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CEFR_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>{t('vocabularyCard.levelDescription')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Example Sentence (Optional) */}
        <FormField
          control={form.control}
          name="example_sentence"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('vocabularyCard.exampleSentence')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('vocabularyCard.exampleSentencePlaceholder')}
                  className="min-h-[80px]"
                  data-testid="example-sentence-input"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

export default VocabularyCardForm;
