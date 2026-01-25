// src/components/admin/VocabularyDeckCreateForm.tsx

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
import type { DeckLevel } from '@/services/adminAPI';

/**
 * CEFR levels for vocabulary decks
 */
const CEFR_LEVELS: DeckLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Validation schema for vocabulary deck create form
 */
const vocabularyDeckCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  description: z
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
 * Form component for creating a new vocabulary deck
 *
 * Fields:
 * - name: Required text input (1-255 chars)
 * - description: Optional textarea (max 1000 chars)
 * - level: CEFR level dropdown (A1-C2)
 * - is_premium: Toggle switch for premium status
 */
export const VocabularyDeckCreateForm: React.FC<VocabularyDeckCreateFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation('admin');

  const form = useForm<VocabularyDeckCreateFormData>({
    resolver: zodResolver(vocabularyDeckCreateSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      level: 'A1',
      is_premium: false,
    },
  });

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
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('deckCreate.name')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('deckCreate.namePlaceholder')}
                  data-testid="deck-create-name"
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
              <FormLabel>{t('deckCreate.description')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('deckCreate.descriptionPlaceholder')}
                  className="min-h-[100px]"
                  data-testid="deck-create-description"
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
