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
import { Textarea } from '@/components/ui/textarea';
import type { UnifiedDeckItem } from '@/services/adminAPI';

import { DeactivationWarningDialog } from './DeactivationWarningDialog';

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
 * Validation schema for culture deck edit form
 */
const cultureDeckSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
  category: z.enum(CULTURE_CATEGORIES),
  is_active: z.boolean(),
});

export type CultureDeckFormData = z.infer<typeof cultureDeckSchema>;

interface CultureDeckEditFormProps {
  deck: UnifiedDeckItem;
  onSave: (data: CultureDeckFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Form component for editing culture deck metadata
 *
 * Fields:
 * - name: Required text input (1-255 chars)
 * - description: Optional textarea (max 1000 chars)
 * - category: Culture category dropdown
 * - is_active: Toggle switch for active status
 */
export const CultureDeckEditForm: React.FC<CultureDeckEditFormProps> = ({
  deck,
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation('admin');
  const [showDeactivationWarning, setShowDeactivationWarning] = useState(false);

  // Get the deck name as string (culture decks now use simple strings after migration)
  const deckName = typeof deck.name === 'string' ? deck.name : deck.name.en;

  const form = useForm<CultureDeckFormData>({
    resolver: zodResolver(cultureDeckSchema),
    mode: 'onChange',
    defaultValues: {
      name: deckName,
      description: '', // Culture decks don't have description in current model
      category: (deck.category as CultureCategory) || 'culture',
      is_active: deck.is_active,
    },
  });

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
