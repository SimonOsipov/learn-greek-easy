// src/components/admin/VocabularyDeckCreateForm.tsx

import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { DeckLevel } from '@/services/adminAPI';

/**
 * Supported languages for vocabulary deck names
 */
const DECK_LANGUAGES = ['en', 'ru'] as const;
type DeckLanguage = (typeof DECK_LANGUAGES)[number];

const LANGUAGE_LABELS: Record<DeckLanguage, string> = {
  en: 'English',
  ru: 'Russian',
};

/**
 * CEFR levels for vocabulary decks
 */
const CEFR_LEVELS: DeckLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Validation schema for vocabulary deck create form with bilingual support
 */
const vocabularyDeckCreateSchema = z.object({
  name_en: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  name_ru: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  description_en: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
  description_ru: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const),
  is_premium: z.boolean(),
});

export type VocabularyDeckCreateFormData = z.infer<typeof vocabularyDeckCreateSchema>;

interface VocabularyDeckCreateFormProps {
  onSubmit: (data: VocabularyDeckCreateFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Form component for creating a new vocabulary deck with bilingual support
 *
 * Fields:
 * - name_en/name_ru: Required text inputs (1-255 chars each)
 * - description_en/description_ru: Optional textareas (max 1000 chars each)
 * - level: CEFR level dropdown (A1-C2)
 * - is_premium: Toggle switch for premium status
 */
export const VocabularyDeckCreateForm: React.FC<VocabularyDeckCreateFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation('admin');
  const [activeTab, setActiveTab] = useState<DeckLanguage>('en');

  const form = useForm<VocabularyDeckCreateFormData>({
    resolver: zodResolver(vocabularyDeckCreateSchema),
    mode: 'onChange',
    defaultValues: {
      name_en: '',
      name_ru: '',
      description_en: '',
      description_ru: '',
      level: 'A1',
      is_premium: false,
    },
  });

  /**
   * Check if a language tab has validation errors
   */
  const hasTabErrors = (lang: DeckLanguage): boolean => {
    const nameKey = `name_${lang}` as keyof VocabularyDeckCreateFormData;
    const descKey = `description_${lang}` as keyof VocabularyDeckCreateFormData;
    return !!(form.formState.errors[nameKey] || form.formState.errors[descKey]);
  };

  const handleSubmit = (data: VocabularyDeckCreateFormData) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
        data-testid="vocabulary-deck-create-form"
      >
        {/* Language tabs for name/description */}
        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {DECK_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveTab(lang)}
                data-testid={`deck-create-lang-tab-${lang}`}
                className={cn(
                  'relative flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === lang ? 'bg-background shadow' : 'hover:bg-background/50',
                  hasTabErrors(lang) && 'text-destructive'
                )}
              >
                {LANGUAGE_LABELS[lang]}
                {hasTabErrors(lang) && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content - name and description per language */}
          {DECK_LANGUAGES.map((lang) => (
            <div key={lang} className={cn('space-y-4', activeTab !== lang && 'hidden')}>
              <FormField
                control={form.control}
                name={`name_${lang}` as keyof VocabularyDeckCreateFormData}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('deckCreate.name')} ({LANGUAGE_LABELS[lang]})
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('deckCreate.namePlaceholder')}
                        data-testid={`deck-create-name-${lang}`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`description_${lang}` as keyof VocabularyDeckCreateFormData}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('deckCreate.description')} ({LANGUAGE_LABELS[lang]})
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('deckCreate.descriptionPlaceholder')}
                        className="min-h-[100px]"
                        data-testid={`deck-create-description-${lang}`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ))}
        </div>

        <FormField
          control={form.control}
          name="level"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('deckCreate.level')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="deck-create-level">
                    <SelectValue placeholder={t('deckCreate.levelPlaceholder')} />
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
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_premium"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">{t('deckCreate.isPremium')}</FormLabel>
                <FormDescription>{t('deckCreate.isPremiumDescription')}</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="deck-create-is-premium"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="deck-create-cancel"
          >
            {t('deckCreate.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !form.formState.isValid}
            data-testid="deck-create-submit"
          >
            {isLoading ? t('deckCreate.creating') : t('deckCreate.create')}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};
