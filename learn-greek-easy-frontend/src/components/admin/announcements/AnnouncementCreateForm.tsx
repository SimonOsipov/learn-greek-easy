// src/components/admin/announcements/AnnouncementCreateForm.tsx

/**
 * Announcement Create Form Component
 *
 * Form for creating announcements with:
 * - Title field (max 100 chars)
 * - Message textarea (max 500 chars)
 * - Optional link URL field (max 500 chars)
 * - Character counters that change color as limits approach
 *
 * The form instance is owned by the caller via `useAnnouncementCreateForm()`.
 * This component is a controlled child — it accepts a `form` prop and renders
 * only the field inputs. The caller is responsible for submit/preview actions.
 */

import React from 'react';

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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type { UseFormReturn } from 'react-hook-form';

/**
 * Character limits for form fields
 */
const TITLE_MAX_LENGTH = 100;
const MESSAGE_MAX_LENGTH = 500;
const LINK_URL_MAX_LENGTH = 500;

/**
 * Validation schema for announcement create form
 */
const announcementCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(MESSAGE_MAX_LENGTH, `Message must be at most ${MESSAGE_MAX_LENGTH} characters`),
  linkUrl: z
    .string()
    .max(LINK_URL_MAX_LENGTH, `URL must be at most ${LINK_URL_MAX_LENGTH} characters`)
    .refine(
      (val) => {
        if (!val || val.trim() === '') return true;
        return val.startsWith('http://') || val.startsWith('https://');
      },
      { message: 'URL must start with http:// or https://' }
    )
    .optional()
    .or(z.literal('')),
});

export type AnnouncementCreateFormValues = z.infer<typeof announcementCreateSchema>;

/** @deprecated use AnnouncementCreateFormValues */
export type AnnouncementCreateFormData = AnnouncementCreateFormValues;

/**
 * Create and return a form instance for the announcement create form.
 * Call this in the parent component and pass the result as the `form` prop.
 */
export function useAnnouncementCreateForm(): UseFormReturn<AnnouncementCreateFormValues> {
  return useForm<AnnouncementCreateFormValues>({
    resolver: zodResolver(announcementCreateSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      message: '',
      linkUrl: '',
    },
  });
}

interface AnnouncementCreateFormProps {
  form: UseFormReturn<AnnouncementCreateFormValues>;
}

/**
 * Character counter component with color-coded limits
 */
interface CharacterCounterProps {
  current: number;
  max: number;
}

const CharacterCounter: React.FC<CharacterCounterProps> = ({ current, max }) => {
  const percentage = (current / max) * 100;

  return (
    <span
      className={cn(
        'text-xs',
        percentage > 100
          ? 'font-medium text-destructive'
          : percentage > 90
            ? 'text-warning'
            : 'text-muted-foreground'
      )}
      data-testid="character-counter"
    >
      {current}/{max}
    </span>
  );
};

/**
 * Announcement Create Form Component
 *
 * Controlled child — renders only the three input fields.
 * The caller owns the form instance and submit/preview actions.
 */
export const AnnouncementCreateForm: React.FC<AnnouncementCreateFormProps> = ({ form }) => {
  const { t } = useTranslation('admin');

  const titleValue = form.watch('title') || '';
  const messageValue = form.watch('message') || '';
  const linkUrlValue = form.watch('linkUrl') || '';

  return (
    <Form {...form}>
      <div className="space-y-4" data-testid="announcement-create-form">
        {/* Title Field */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>{t('announcements.create.titleLabel')}</FormLabel>
                <CharacterCounter current={titleValue.length} max={TITLE_MAX_LENGTH} />
              </div>
              <FormControl>
                <Input
                  placeholder={t('announcements.create.titlePlaceholder')}
                  data-testid="announcement-title-input"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Message Field */}
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>{t('announcements.create.messageLabel')}</FormLabel>
                <CharacterCounter current={messageValue.length} max={MESSAGE_MAX_LENGTH} />
              </div>
              <FormControl>
                <Textarea
                  placeholder={t('announcements.create.messagePlaceholder')}
                  className="min-h-[120px] resize-none"
                  data-testid="announcement-message-input"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Link URL Field */}
        <FormField
          control={form.control}
          name="linkUrl"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>
                  {t('announcements.create.linkLabel')}{' '}
                  <span className="text-muted-foreground">
                    ({t('announcements.create.optional')})
                  </span>
                </FormLabel>
                <CharacterCounter current={linkUrlValue.length} max={LINK_URL_MAX_LENGTH} />
              </div>
              <FormControl>
                <Input
                  placeholder={t('announcements.create.linkPlaceholder')}
                  data-testid="announcement-link-input"
                  {...field}
                />
              </FormControl>
              <FormDescription>{t('announcements.create.linkDescription')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </Form>
  );
};
