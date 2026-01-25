// src/components/admin/CultureDeckCreateForm.tsx

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
 * Validation schema for culture deck create form
 */
const cultureDeckCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  description: z
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
}

/**
 * Form component for creating a new culture deck
 *
 * Fields:
 * - name: Required text input (1-255 chars)
 * - description: Optional textarea (max 1000 chars)
 * - category: Culture category dropdown
 * - icon: Emoji or icon name (required)
 * - color_accent: Hex color code
 * - is_premium: Toggle switch for premium status
 */
export const CultureDeckCreateForm: React.FC<CultureDeckCreateFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation('admin');

  const form = useForm<CultureDeckCreateFormData>({
    resolver: zodResolver(cultureDeckCreateSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      category: 'culture',
      is_premium: false,
    },
  });

  const handleSubmit = (data: CultureDeckCreateFormData) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
        data-testid="culture-deck-create-form"
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
