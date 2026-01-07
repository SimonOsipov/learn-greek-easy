// src/components/admin/VocabularyDeckEditForm.tsx

import React from 'react';

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
import type { DeckLevel, UnifiedDeckItem } from '@/services/adminAPI';

/**
 * CEFR levels for vocabulary decks
 */
const CEFR_LEVELS: DeckLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Validation schema for vocabulary deck edit form
 */
const vocabularyDeckSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const),
  is_active: z.boolean(),
});

export type VocabularyDeckFormData = z.infer<typeof vocabularyDeckSchema>;

interface VocabularyDeckEditFormProps {
  deck: UnifiedDeckItem;
  onSave: (data: VocabularyDeckFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Form component for editing vocabulary deck metadata
 *
 * Fields:
 * - name: Required text input (1-255 chars)
 * - description: Optional textarea (max 1000 chars)
 * - level: CEFR level dropdown (A1-C2)
 * - is_active: Toggle switch for active status
 */
export const VocabularyDeckEditForm: React.FC<VocabularyDeckEditFormProps> = ({
  deck,
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation('admin');

  // Get the deck name as string (vocabulary decks always have string names now)
  const deckName = typeof deck.name === 'string' ? deck.name : deck.name.en;

  const form = useForm<VocabularyDeckFormData>({
    resolver: zodResolver(vocabularyDeckSchema),
    mode: 'onChange',
    defaultValues: {
      name: deckName,
      description: '', // Vocabulary decks don't have description in current model
      level: (deck.level as DeckLevel) || 'A1',
      is_active: deck.is_active,
    },
  });

  const onSubmit = (data: VocabularyDeckFormData) => {
    onSave(data);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        data-testid="vocabulary-deck-edit-form"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('deckEdit.name')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('deckEdit.namePlaceholder')}
                  data-testid="deck-edit-name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('deckEdit.description')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('deckEdit.descriptionPlaceholder')}
                  className="min-h-[100px]"
                  data-testid="deck-edit-description"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  onCheckedChange={field.onChange}
                  data-testid="deck-edit-is-active"
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
      </form>
    </Form>
  );
};
