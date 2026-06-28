// src/components/admin/VocabularyDeckCreateForm.tsx

import React, { useState } from 'react';

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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { DeckLevel } from '@/services/adminAPI';

import { DeckCoverField } from './DeckCoverField';

/**
 * Supported languages for vocabulary deck names
 */
const DECK_LANGUAGES = ['en', 'el', 'ru'] as const;
type DeckLanguage = (typeof DECK_LANGUAGES)[number];

const LANGUAGE_LABELS: Record<DeckLanguage, string> = {
  en: 'English',
  el: 'Greek',
  ru: 'Russian',
};

// Required langs (name must not be empty)
const REQUIRED_LANGS: DeckLanguage[] = ['en', 'ru'];

/**
 * CEFR levels for vocabulary decks
 */
const CEFR_LEVELS: DeckLevel[] = ['A1', 'A2', 'B1', 'B2'];

/**
 * Validation schema for vocabulary deck create form with bilingual support
 */
const vocabularyDeckCreateSchema = z.object({
  name_en: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  name_el: z.string().max(255, 'Name must be at most 255 characters').optional().or(z.literal('')),
  name_ru: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  description_en: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
  description_el: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
  description_ru: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
  level: z.enum(['A1', 'A2', 'B1', 'B2'] as const),
  is_premium: z.boolean(),
});

export type VocabularyDeckCreateFormData = z.infer<typeof vocabularyDeckCreateSchema>;

interface VocabularyDeckCreateFormProps {
  onSubmit: (data: VocabularyDeckCreateFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** Cover file lifted to modal; present when rendered inside DeckCreateModal */
  coverFile?: File | null;
  /** Called when user selects / removes a cover; absent in standalone unit tests */
  onCoverChange?: (file: File | null) => void;
  /** Type-card selector rendered at the top of the body; absent in standalone unit tests */
  typeSelector?: React.ReactNode;
}

/**
 * Form component for creating a new vocabulary deck with bilingual support (ADMIN2-47, AC H).
 *
 * Renders cd-modal-body (type cards, lang tabs, cover, CEFR seg, premium) and
 * cd-modal-foot (cancel/submit with .aw-btn system).
 * Cover is a separate File channel — NOT in the zod payload.
 */
export const VocabularyDeckCreateForm: React.FC<VocabularyDeckCreateFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
  coverFile,
  onCoverChange,
  typeSelector,
}) => {
  const { t } = useTranslation('admin');
  const [activeTab, setActiveTab] = useState<DeckLanguage>('en');

  const form = useForm<VocabularyDeckCreateFormData>({
    resolver: zodResolver(vocabularyDeckCreateSchema),
    mode: 'onChange',
    defaultValues: {
      name_en: '',
      name_el: '',
      name_ru: '',
      description_en: '',
      description_el: '',
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
      <form onSubmit={form.handleSubmit(handleSubmit)} data-testid="vocabulary-deck-create-form">
        {/* Body: type cards + lang tabs + cover + CEFR + premium */}
        <div className="cd-modal-body">
          {/* Type-card selector (injected by DeckCreateModal; absent in unit tests) */}
          {typeSelector}

          {/* Language tabs for name/description */}
          <div className="space-y-4">
            <div className="cd-langtabs">
              {DECK_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setActiveTab(lang)}
                  data-testid={`deck-create-lang-tab-${lang}`}
                  className={cn(
                    'dk-langtab relative',
                    activeTab === lang && 'is-active',
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

            {/* Tab content — name and description per language */}
            {DECK_LANGUAGES.map((lang) => (
              <div key={lang} className={cn('space-y-4', activeTab !== lang && 'hidden')}>
                <FormField
                  control={form.control}
                  name={`name_${lang}` as keyof VocabularyDeckCreateFormData}
                  render={({ field }) => (
                    <FormItem className="cd-langrow">
                      <FormLabel>
                        {t('deckCreate.name')} ({LANGUAGE_LABELS[lang]})
                        {REQUIRED_LANGS.includes(lang) && <span className="cd-req">*</span>}
                      </FormLabel>
                      <FormControl>
                        {/* F19: radius 9px + --bg-2 fill (overrides rounded-md / bg-background via tailwind-merge) */}
                        <Input
                          placeholder={t('deckCreate.namePlaceholder')}
                          data-testid={`deck-create-name-${lang}`}
                          lang={lang === 'el' ? 'el' : undefined}
                          className={cn(
                            'rounded-[9px] bg-bg-2',
                            lang === 'el' && 'font-serif not-italic'
                          )}
                          {...field}
                          value={field.value as string}
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
                    <FormItem className="cd-langrow">
                      <FormLabel>
                        {t('deckCreate.description')} ({LANGUAGE_LABELS[lang]})
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('deckCreate.descriptionPlaceholder')}
                          className={cn('min-h-[100px]', lang === 'el' && 'font-serif not-italic')}
                          data-testid={`deck-create-description-${lang}`}
                          lang={lang === 'el' ? 'el' : undefined}
                          {...field}
                          value={field.value as string}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}
          </div>

          {/* Cover image (only when rendered inside DeckCreateModal) */}
          {onCoverChange && <DeckCoverField file={coverFile ?? null} onChange={onCoverChange} />}

          {/* CEFR level — segmented control replaces <Select> */}
          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <div className="cd-langrow">
                <label>{t('deckCreate.level')}</label>
                <div className="dk-cefr" data-testid="deck-create-level">
                  {CEFR_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={cn('dk-cefr-btn', field.value === level && 'is-active')}
                      data-testid={`deck-create-level-${level}`}
                      onClick={() => field.onChange(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                {form.formState.errors.level && (
                  <p className="text-sm text-destructive">{form.formState.errors.level.message}</p>
                )}
              </div>
            )}
          />

          {/* Premium toggle — .dk-toggle wrapper resizes Switch to CD 40×22 without
               touching the shared Switch primitive (ADMIN2-48-05 F19) */}
          <FormField
            control={form.control}
            name="is_premium"
            render={({ field }) => (
              <FormItem className="dk-toggle flex flex-row items-center justify-between rounded-lg border p-4">
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
        </div>

        {/* Footer — .aw-btn system only, NOT .btn */}
        <div className="cd-modal-foot">
          <button
            type="button"
            className="aw-btn aw-btn-outline"
            onClick={onCancel}
            data-testid="deck-create-cancel"
          >
            {t('deckCreate.cancel')}
          </button>
          <button
            type="submit"
            className="aw-btn aw-btn-primary"
            disabled={isLoading || !form.formState.isValid}
            data-testid="deck-create-submit"
          >
            {isLoading ? (
              <>
                <span className="aw-spin" />
                {t('deckCreate.creating')}
              </>
            ) : (
              t('deckCreate.create')
            )}
          </button>
        </div>
      </form>
    </Form>
  );
};
