// src/components/admin/CultureDeckEditForm.tsx

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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { UnifiedDeckItem } from '@/services/adminAPI';

import { DeactivationWarningDialog } from './DeactivationWarningDialog';

/**
 * Supported languages for culture deck names and descriptions
 */
const DECK_LANGUAGES = ['en', 'ru'] as const;
type DeckLanguage = (typeof DECK_LANGUAGES)[number];

const LANGUAGE_LABELS: Record<DeckLanguage, string> = {
  en: 'English',
  ru: 'Russian',
};

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

type CultureCategory = (typeof CULTURE_CATEGORIES)[number];

/**
 * Validation schema for culture deck edit form with bilingual support
 */
const cultureDeckSchema = z.object({
  name_en: z.string().min(1, 'Name is required').max(255),
  name_ru: z.string().min(1, 'Name is required').max(255),
  description_en: z.string().max(2000).optional().or(z.literal('')),
  description_ru: z.string().max(2000).optional().or(z.literal('')),
  category: z.enum(CULTURE_CATEGORIES as readonly [string, ...string[]]),
  is_active: z.boolean(),
  is_premium: z.boolean(),
});

export type CultureDeckFormData = z.infer<typeof cultureDeckSchema>;

interface CultureDeckEditFormProps {
  deck: UnifiedDeckItem;
  onSave: (data: CultureDeckFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Form component for editing culture deck metadata with bilingual support
 *
 * Fields:
 * - name_en/name_ru: Required text inputs per language (1-255 chars)
 * - description_en/description_ru: Optional textareas per language (max 2000 chars)
 * - category: Culture category dropdown
 * - is_active: Toggle switch for active status
 * - is_premium: Toggle switch for premium status
 */
export const CultureDeckEditForm: React.FC<CultureDeckEditFormProps> = ({
  deck,
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation('admin');
  const [showDeactivationWarning, setShowDeactivationWarning] = useState(false);
  const [activeTab, setActiveTab] = useState<DeckLanguage>('en');

  // Get the deck name for display in deactivation dialog (prefer English)
  const deckNameDisplay =
    typeof deck.name === 'string'
      ? deck.name
      : typeof deck.name === 'object' && deck.name !== null
        ? deck.name.en || deck.name.ru || ''
        : '';

  const form = useForm<CultureDeckFormData>({
    resolver: zodResolver(cultureDeckSchema),
    mode: 'onChange',
    defaultValues: {
      name_en:
        ((deck as Record<string, unknown>).name_en as string) ||
        (typeof deck.name === 'object' && deck.name !== null
          ? deck.name.en
          : typeof deck.name === 'string'
            ? deck.name
            : '') ||
        '',
      name_ru:
        ((deck as Record<string, unknown>).name_ru as string) ||
        (typeof deck.name === 'object' && deck.name !== null ? deck.name.ru : '') ||
        '',
      description_en: ((deck as Record<string, unknown>).description_en as string) || '',
      description_ru: ((deck as Record<string, unknown>).description_ru as string) || '',
      category: (deck.category as CultureCategory) || 'culture',
      is_active: deck.is_active,
      is_premium: deck.is_premium ?? false,
    },
  });

  /**
   * Check if a language tab has validation errors
   */
  const hasTabErrors = (lang: DeckLanguage): boolean => {
    const nameKey = `name_${lang}` as keyof CultureDeckFormData;
    const descKey = `description_${lang}` as keyof CultureDeckFormData;
    return !!(form.formState.errors[nameKey] || form.formState.errors[descKey]);
  };

  const onSubmit = (data: CultureDeckFormData) => {
    onSave(data);
  };

  /**
   * Handles changes to the is_active switch.
   * Shows a warning dialog when toggling from active to inactive.
   */
  const handleActiveChange = (checked: boolean) => {
    if (!checked && form.getValues('is_active')) {
      // Toggling from active to inactive - show warning
      setShowDeactivationWarning(true);
    } else {
      // Toggling from inactive to active - allow directly
      form.setValue('is_active', checked, { shouldDirty: true });
    }
  };

  const handleDeactivationCancel = () => {
    setShowDeactivationWarning(false);
  };

  const handleDeactivationConfirm = () => {
    setShowDeactivationWarning(false);
    form.setValue('is_active', false, { shouldDirty: true });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        data-testid="culture-deck-edit-form"
      >
        {/* Language Tabs */}
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as DeckLanguage)}>
            <TabsList className="w-full">
              {DECK_LANGUAGES.map((lang) => (
                <TabsTrigger
                  key={lang}
                  value={lang}
                  className={cn('relative flex-1', hasTabErrors(lang) && 'text-destructive')}
                  data-testid={`culture-deck-edit-lang-tab-${lang}`}
                >
                  {LANGUAGE_LABELS[lang]}
                  {hasTabErrors(lang) && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Tab Content - name and description per language */}
          {DECK_LANGUAGES.map((lang) => (
            <div key={lang} className={cn('space-y-4', activeTab !== lang && 'hidden')}>
              {/* Name field */}
              <FormField
                control={form.control}
                name={`name_${lang}` as 'name_en' | 'name_ru'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name ({LANGUAGE_LABELS[lang]})</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter deck name"
                        data-testid={`culture-deck-edit-name-${lang}`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description field */}
              <FormField
                control={form.control}
                name={`description_${lang}` as 'description_en' | 'description_ru'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description ({LANGUAGE_LABELS[lang]})</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter deck description (optional)"
                        className="min-h-[100px]"
                        data-testid={`culture-deck-edit-description-${lang}`}
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
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('deckEdit.category')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="deck-edit-category">
                    <SelectValue placeholder={t('deckEdit.categoryPlaceholder')} />
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
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">{t('deckEdit.isActive')}</FormLabel>
                <FormDescription>{t('deckEdit.isActiveDescription')}</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={handleActiveChange}
                  data-testid="deck-edit-is-active"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_premium"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">{t('deckEdit.isPremium')}</FormLabel>
                <FormDescription>{t('deckEdit.isPremiumDescription')}</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="deck-edit-is-premium"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} data-testid="deck-edit-cancel">
            {t('deckEdit.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !form.formState.isValid}
            data-testid="deck-edit-save"
          >
            {isLoading ? t('deckEdit.saving') : t('deckEdit.save')}
          </Button>
        </DialogFooter>

        <DeactivationWarningDialog
          open={showDeactivationWarning}
          onCancel={handleDeactivationCancel}
          onConfirm={handleDeactivationConfirm}
          deckName={deckNameDisplay}
        />
      </form>
    </Form>
  );
};
