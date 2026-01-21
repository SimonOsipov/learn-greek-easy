// src/components/admin/NewsSourceFormDialog.tsx

import React, { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';
import type { NewsSourceResponse } from '@/services/adminAPI';
import { APIRequestError } from '@/services/api';

const newsSourceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  url: z
    .string()
    .min(1, 'URL is required')
    .max(2048, 'URL must be 2048 characters or less')
    .url('Please enter a valid URL'),
  is_active: z.boolean(),
});

export type NewsSourceFormData = z.infer<typeof newsSourceSchema>;

interface NewsSourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: NewsSourceResponse | null;
  onSuccess: () => void;
}

/**
 * Dialog for creating or editing a news source.
 *
 * Features:
 * - Name field (required, max 255 chars)
 * - URL field (required, valid URL format)
 * - Active toggle switch
 * - Handles duplicate URL errors (409)
 */
export const NewsSourceFormDialog: React.FC<NewsSourceFormDialogProps> = ({
  open,
  onOpenChange,
  source,
  onSuccess,
}) => {
  const { t } = useTranslation('admin');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = source !== null;

  const form = useForm<NewsSourceFormData>({
    resolver: zodResolver(newsSourceSchema),
    defaultValues: {
      name: source?.name ?? '',
      url: source?.url ?? '',
      is_active: source?.is_active ?? true,
    },
  });

  // Reset form when source changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: source?.name ?? '',
        url: source?.url ?? '',
        is_active: source?.is_active ?? true,
      });
    }
  }, [open, source, form]);

  const onSubmit = async (data: NewsSourceFormData) => {
    setIsSubmitting(true);

    try {
      if (isEditing && source) {
        await adminAPI.updateNewsSource(source.id, data);
        toast({
          title: t('sources.form.success.updateTitle'),
          description: t('sources.form.success.updateMessage'),
        });
      } else {
        await adminAPI.createNewsSource(data);
        toast({
          title: t('sources.form.success.createTitle'),
          description: t('sources.form.success.createMessage'),
        });
      }

      onSuccess();
    } catch (error) {
      // Check for duplicate URL error (409 Conflict)
      const isDuplicateError =
        (error instanceof APIRequestError && error.status === 409) ||
        (error instanceof Error && error.message.toLowerCase().includes('already exists'));

      if (isDuplicateError) {
        form.setError('url', {
          type: 'manual',
          message: t('sources.form.errors.duplicateUrl'),
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : '';
        toast({
          title: t('sources.form.error.title'),
          description: errorMessage || t('sources.form.error.message'),
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="source-form-dialog">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('sources.form.editTitle') : t('sources.form.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t('sources.form.editDescription') : t('sources.form.addDescription')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('sources.form.name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('sources.form.namePlaceholder')}
                      data-testid="source-name-input"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('sources.form.url')}</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder={t('sources.form.urlPlaceholder')}
                      data-testid="source-url-input"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{t('sources.form.urlHint')}</FormDescription>
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
                    <FormLabel className="text-base">{t('sources.form.isActive')}</FormLabel>
                    <FormDescription>{t('sources.form.isActiveDescription')}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="source-active-switch"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                data-testid="source-form-cancel"
              >
                {t('sources.form.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="source-form-submit">
                {isSubmitting
                  ? t('sources.form.saving')
                  : isEditing
                    ? t('sources.form.save')
                    : t('sources.form.add')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
