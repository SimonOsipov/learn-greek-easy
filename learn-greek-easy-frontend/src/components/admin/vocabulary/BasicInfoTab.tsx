// src/components/admin/vocabulary/BasicInfoTab.tsx

/**
 * BasicInfoTab - Tab content component for basic vocabulary card fields.
 *
 * This component renders within a FormProvider context from a parent modal.
 * It uses useFormContext() to access the shared form state rather than owning
 * its own form instance.
 *
 * Fields:
 * - Greek word (front_text) - required
 * - English translation (back_text_en) - required
 * - Russian translation (back_text_ru) - optional
 * - Pronunciation - optional
 * - Part of speech - select (optional, controlled by showPartOfSpeech prop)
 * - CEFR level - select with deck default
 */

import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
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

// ============================================
// Constants
// ============================================

const PART_OF_SPEECH_OPTIONS = ['noun', 'verb', 'adjective', 'adverb'] as const;
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

// ============================================
// Props Interface
// ============================================

export interface BasicInfoTabProps {
  isSubmitting?: boolean;
  deckLevel?: string; // For CEFR level default display in placeholder
  showPartOfSpeech?: boolean; // Whether to show part of speech selector (default true)
}

// ============================================
// Component
// ============================================

export function BasicInfoTab({
  isSubmitting = false,
  deckLevel,
  showPartOfSpeech = true,
}: BasicInfoTabProps) {
  const { t } = useTranslation('admin');
  const { control } = useFormContext();

  // Build level placeholder - show deck level if available
  const levelPlaceholder = deckLevel
    ? `${t('vocabularyCard.levelPlaceholder')} (${deckLevel})`
    : t('vocabularyCard.levelPlaceholder');

  return (
    <div className="space-y-4" data-testid="basic-info-tab">
      {/* Greek Word/Phrase */}
      <FormField
        control={control}
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
        control={control}
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
        control={control}
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
        control={control}
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
      {showPartOfSpeech && (
        <FormField
          control={control}
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
      )}

      {/* CEFR Level Override */}
      <FormField
        control={control}
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
                  <SelectValue placeholder={levelPlaceholder} />
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
    </div>
  );
}

export default BasicInfoTab;
