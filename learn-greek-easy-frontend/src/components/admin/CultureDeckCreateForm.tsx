// src/components/admin/CultureDeckCreateForm.tsx

import React, { useCallback, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
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

/**
 * Supported languages for culture deck names (EN/RU only)
 */
type Language = 'en' | 'ru';
const LANGUAGES: Language[] = ['en', 'ru'];
const LANGUAGE_LABELS: Record<Language, string> = { en: 'EN', ru: 'RU' };

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
 * Multilingual text schema - requires both EN and RU
 */
const multilingualSchema = z.object({
  en: z.string().min(1, 'English text is required'),
  ru: z.string().min(1, 'Russian text is required'),
});

/**
 * Optional multilingual text schema
 */
const optionalMultilingualSchema = z
  .object({
    en: z.string(),
    ru: z.string(),
  })
  .optional();

/**
 * Validation schema for culture deck create form with multilingual support
 */
const cultureDeckCreateSchema = z.object({
  name: multilingualSchema,
  description: optionalMultilingualSchema,
  category: z.enum(CULTURE_CATEGORIES),
  is_premium: z.boolean(),
});

export type CultureDeckCreateFormData = z.infer<typeof cultureDeckCreateSchema>;

interface CultureDeckCreateFormProps {
  onSubmit: (data: CultureDeckCreateFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Form component for creating a new culture deck with multilingual support
 *
 * Fields:
 * - name: Required text input per language (EN/RU)
 * - description: Optional textarea per language (EN/RU)
 * - category: Culture category dropdown
 * - is_premium: Toggle switch for premium status
 */
export const CultureDeckCreateForm: React.FC<CultureDeckCreateFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation('admin');
  const [activeTab, setActiveTab] = useState<Language>('en');

  const form = useForm<CultureDeckCreateFormData>({
    resolver: zodResolver(cultureDeckCreateSchema),
    mode: 'onChange',
    defaultValues: {
      name: { en: '', ru: '' },
      description: { en: '', ru: '' },
      category: 'culture',
      is_premium: false,
    },
  });

  // Watch form values for tab incomplete indicator
  const watchedValues = useWatch({ control: form.control });

  /**
   * Check if a language tab has incomplete required fields
   */
  const isTabIncomplete = useCallback(
    (lang: Language): boolean => {
      const name = watchedValues.name;
      return !name?.[lang]?.trim();
    },
    [watchedValues]
  );

  const handleSubmit = (data: CultureDeckCreateFormData) => {
    // Clean up empty description
    const payload = {
      name: data.name,
      description: data.description?.en || data.description?.ru ? data.description : undefined,
      category: data.category,
      is_premium: data.is_premium,
    };

    onSubmit(payload as CultureDeckCreateFormData);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
        data-testid="culture-deck-create-form"
      >
        {/* Language Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setActiveTab(lang)}
              data-testid={`lang-tab-${lang}`}
              className={cn(
                'relative flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === lang ? 'bg-background shadow' : 'hover:bg-background/50'
              )}
            >
              {LANGUAGE_LABELS[lang]}
              {isTabIncomplete(lang) && (
                <span
                  className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive"
                  data-testid={`lang-tab-${lang}-incomplete`}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content - name and description per language */}
        {LANGUAGES.map((lang) => (
          <div key={lang} className={cn('space-y-4', activeTab !== lang && 'hidden')}>
            <FormField
              control={form.control}
              name={`name.${lang}`}
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
              name={`description.${lang}`}
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

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
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
