// src/components/admin/CultureDeckCreateForm.tsx

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

import { DeckCoverField } from './DeckCoverField';

/**
 * Supported languages for culture deck names (bilingual: EN/RU)
 */
const DECK_LANGUAGES = ['en', 'ru'] as const;
type DeckLanguage = (typeof DECK_LANGUAGES)[number];

const LANGUAGE_LABELS: Record<DeckLanguage, string> = {
  en: 'English',
  ru: 'Russian',
};

// Both languages are required for culture decks
const REQUIRED_LANGS: DeckLanguage[] = ['en', 'ru'];

/**
 * Culture deck categories
 */
const CULTURE_CATEGORIES = [
  'history',
  'geography',
  'politics',
  'culture',
  'traditions',
  'practical',
] as const;

/**
 * Validation schema for culture deck create form with bilingual support
 */
const cultureDeckCreateSchema = z.object({
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
  category: z.enum(CULTURE_CATEGORIES),
  is_premium: z.boolean(),
});

export type CultureDeckCreateFormData = z.infer<typeof cultureDeckCreateSchema>;

interface CultureDeckCreateFormProps {
  onSubmit: (data: CultureDeckCreateFormData) => void;
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
 * Form component for creating a new culture deck with bilingual support (ADMIN2-47, AC H).
 *
 * Renders cd-modal-body (type cards, lang tabs, cover, category, premium) and
 * cd-modal-foot (cancel/submit with .aw-btn system).
 * Cover is a separate File channel — NOT in the zod payload.
 * Category remains a <Select> (preserves [role=option] for E2E).
 */
export const CultureDeckCreateForm: React.FC<CultureDeckCreateFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
  coverFile,
  onCoverChange,
  typeSelector,
}) => {
  const { t } = useTranslation('admin');
  const [activeTab, setActiveTab] = useState<DeckLanguage>('en');

  const form = useForm<CultureDeckCreateFormData>({
    resolver: zodResolver(cultureDeckCreateSchema),
    mode: 'onChange',
    defaultValues: {
      name_en: '',
      name_ru: '',
      description_en: '',
      description_ru: '',
      category: 'culture',
      is_premium: false,
    },
  });

  /**
   * Check if a language tab has validation errors
   */
  const hasTabErrors = (lang: DeckLanguage): boolean => {
    const nameKey = `name_${lang}` as keyof CultureDeckCreateFormData;
    const descKey = `description_${lang}` as keyof CultureDeckCreateFormData;
    return !!(form.formState.errors[nameKey] || form.formState.errors[descKey]);
  };

  const handleSubmit = (data: CultureDeckCreateFormData) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} data-testid="culture-deck-create-form">
        {/* Body: type cards + lang tabs + cover + category + premium */}
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
                  name={`name_${lang}` as keyof CultureDeckCreateFormData}
                  render={({ field }) => (
                    <FormItem className="cd-langrow">
                      <FormLabel>
                        {t('deckCreate.name')} ({LANGUAGE_LABELS[lang]})
                        {REQUIRED_LANGS.includes(lang) && <span className="cd-req">*</span>}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('deckCreate.namePlaceholder')}
                          data-testid={`deck-create-name-${lang}`}
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
                  name={`description_${lang}` as keyof CultureDeckCreateFormData}
                  render={({ field }) => (
                    <FormItem className="cd-langrow">
                      <FormLabel>
                        {t('deckCreate.description')} ({LANGUAGE_LABELS[lang]})
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('deckCreate.descriptionPlaceholder')}
                          className="min-h-[100px]"
                          data-testid={`deck-create-description-${lang}`}
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

          {/* Category — stays a <Select> to preserve [role=option] E2E selectors */}
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem className="cd-langrow">
                <FormLabel>{t('deckCreate.category')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="deck-create-category">
                      <SelectValue placeholder={t('deckCreate.categoryPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CULTURE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {t(`categories.${category}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Premium toggle */}
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
