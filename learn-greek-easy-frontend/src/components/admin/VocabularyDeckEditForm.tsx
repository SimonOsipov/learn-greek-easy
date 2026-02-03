// src/components/admin/VocabularyDeckEditForm.tsx

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
import type { DeckLevel, UnifiedDeckItem } from '@/services/adminAPI';

import { DeactivationWarningDialog } from './DeactivationWarningDialog';

/**
 * Supported languages for vocabulary deck names
 */
const DECK_LANGUAGES = ['el', 'en', 'ru'] as const;
type DeckLanguage = (typeof DECK_LANGUAGES)[number];

const LANGUAGE_LABELS: Record<DeckLanguage, string> = {
  el: 'Greek',
  en: 'English',
  ru: 'Russian',
};

/**
 * CEFR levels for vocabulary decks
 */
const CEFR_LEVELS: DeckLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Validation schema for vocabulary deck edit form with trilingual support
 */
const vocabularyDeckSchema = z.object({
  name_el: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  name_en: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  name_ru: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  description_el: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
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
  is_active: z.boolean(),
  is_premium: z.boolean(),
});

export type VocabularyDeckFormData = z.infer<typeof vocabularyDeckSchema>;

/**
 * Extended deck type with trilingual name/description fields
 */
interface TrilingualDeckItem extends UnifiedDeckItem {
  name_el?: string;
  name_en?: string;
  name_ru?: string;
  description_el?: string;
  description_en?: string;
  description_ru?: string;
}

interface VocabularyDeckEditFormProps {
  deck: TrilingualDeckItem;
  onSave: (data: VocabularyDeckFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Form component for editing vocabulary deck metadata with trilingual support
 *
 * Fields:
 * - name_el/name_en/name_ru: Required text inputs (1-255 chars each)
 * - description_el/description_en/description_ru: Optional textareas (max 1000 chars each)
 * - level: CEFR level dropdown (A1-C2)
 * - is_active: Toggle switch for active status
 * - is_premium: Toggle switch for premium status
 */
export const VocabularyDeckEditForm: React.FC<VocabularyDeckEditFormProps> = ({
  deck,
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation('admin');
  const [showDeactivationWarning, setShowDeactivationWarning] = useState(false);
  const [activeTab, setActiveTab] = useState<DeckLanguage>('en');

  // Get the deck name as string for deactivation dialog
  const deckName = deck.name_en || (typeof deck.name === 'string' ? deck.name : deck.name.en) || '';

  const form = useForm<VocabularyDeckFormData>({
    resolver: zodResolver(vocabularyDeckSchema),
    mode: 'onChange',
    defaultValues: {
      name_el: deck.name_el || '',
      name_en: deck.name_en || '',
      name_ru: deck.name_ru || '',
      description_el: deck.description_el || '',
      description_en: deck.description_en || '',
      description_ru: deck.description_ru || '',
      level: (deck.level as DeckLevel) || 'A1',
      is_active: deck.is_active,
      is_premium: deck.is_premium ?? false,
    },
  });

  /**
   * Check if a language tab has validation errors
   */
  const hasTabErrors = (lang: DeckLanguage): boolean => {
    const nameKey = `name_${lang}` as keyof VocabularyDeckFormData;
    const descKey = `description_${lang}` as keyof VocabularyDeckFormData;
    return !!(form.formState.errors[nameKey] || form.formState.errors[descKey]);
  };

  const onSubmit = (data: VocabularyDeckFormData) => {
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
        data-testid="vocabulary-deck-edit-form"
      >
        {/* Language tabs for name/description */}
        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {DECK_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveTab(lang)}
                data-testid={`deck-edit-lang-tab-${lang}`}
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
                name={`name_${lang}` as keyof VocabularyDeckFormData}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('deckEdit.name')} ({LANGUAGE_LABELS[lang]})
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('deckEdit.namePlaceholder')}
                        data-testid={`deck-edit-name-${lang}`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`description_${lang}` as keyof VocabularyDeckFormData}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('deckEdit.description')} ({LANGUAGE_LABELS[lang]})
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('deckEdit.descriptionPlaceholder')}
                        className="min-h-[100px]"
                        data-testid={`deck-edit-description-${lang}`}
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
              <FormLabel>{t('deckEdit.level')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="deck-edit-level">
                    <SelectValue placeholder={t('deckEdit.levelPlaceholder')} />
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
          deckName={deckName}
        />
      </form>
    </Form>
  );
};
