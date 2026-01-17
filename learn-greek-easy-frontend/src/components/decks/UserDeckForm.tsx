// src/components/decks/UserDeckForm.tsx

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
import type { CreateDeckInput, DeckLevel } from '@/services/deckAPI';

/**
 * CEFR levels for vocabulary decks
 */
const CEFR_LEVELS: DeckLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Validation schema for user deck form
 */
const userDeckSchema = z.object({
  name: z
    .string()
    .min(1, 'deck:form.validation.nameRequired')
    .max(255, 'deck:form.validation.nameMaxLength'),
  description: z
    .string()
    .max(1000, 'deck:form.validation.descriptionMaxLength')
    .optional()
    .or(z.literal('')),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const),
});

export type UserDeckFormData = z.infer<typeof userDeckSchema>;

export interface UserDeckFormProps {
  mode: 'create' | 'edit';
  deck?: { name: string; description?: string | null; level: DeckLevel };
  onSubmit: (data: CreateDeckInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Form component for creating and editing user vocabulary decks
 *
 * Fields:
 * - name: Required text input (1-255 chars)
 * - description: Optional textarea (max 1000 chars)
 * - level: CEFR level dropdown (A1-C2, default A1)
 *
 * Note: User decks are always active and never premium,
 * so those fields are omitted from this form.
 */
export const UserDeckForm: React.FC<UserDeckFormProps> = ({
  mode,
  deck,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation('deck');

  const form = useForm<UserDeckFormData>({
    resolver: zodResolver(userDeckSchema),
    mode: 'onChange',
    defaultValues: {
      name: mode === 'edit' && deck ? deck.name : '',
      description: mode === 'edit' && deck ? (deck.description ?? '') : '',
      level: mode === 'edit' && deck ? deck.level : 'A1',
    },
  });

  const handleSubmit = async (data: UserDeckFormData) => {
    const submitData: CreateDeckInput = {
      name: data.name,
      level: data.level,
    };

    // Only include description if it has content
    if (data.description && data.description.trim()) {
      submitData.description = data.description.trim();
    }

    await onSubmit(submitData);
  };

  const isCreateMode = mode === 'create';
  const submitButtonText = isLoading
    ? t(isCreateMode ? 'form.creating' : 'form.saving')
    : t(isCreateMode ? 'form.create' : 'form.save');

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
        data-testid="user-deck-form"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.nameLabel')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('form.namePlaceholder')}
                  data-testid="user-deck-form-name"
                  {...field}
                />
              </FormControl>
              <FormMessage>
                {form.formState.errors.name?.message ? t(form.formState.errors.name.message) : null}
              </FormMessage>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.descriptionLabel')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('form.descriptionPlaceholder')}
                  className="min-h-[100px]"
                  data-testid="user-deck-form-description"
                  {...field}
                />
              </FormControl>
              <FormMessage>
                {form.formState.errors.description?.message
                  ? t(form.formState.errors.description.message)
                  : null}
              </FormMessage>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="level"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.levelLabel')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="user-deck-form-level">
                    <SelectValue placeholder={t('form.levelPlaceholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CEFR_LEVELS.map((level) => (
                    <SelectItem
                      key={level}
                      value={level}
                      data-testid={`user-deck-form-level-${level}`}
                    >
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="user-deck-form-cancel"
          >
            {t('form.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !form.formState.isValid}
            data-testid="user-deck-form-submit"
          >
            {submitButtonText}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};
