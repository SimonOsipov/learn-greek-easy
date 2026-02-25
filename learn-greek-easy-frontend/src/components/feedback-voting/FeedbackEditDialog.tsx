// src/components/feedback-voting/FeedbackEditDialog.tsx

import React, { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFeedbackStore } from '@/stores/feedbackStore';
import type { FeedbackItem } from '@/types/feedback';

const feedbackEditSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(20, 'Description must be at least 20 characters').max(2000),
});

type FeedbackEditFormData = z.infer<typeof feedbackEditSchema>;

interface FeedbackEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedback: FeedbackItem;
}

export const FeedbackEditDialog: React.FC<FeedbackEditDialogProps> = ({
  open,
  onOpenChange,
  feedback,
}) => {
  const { t } = useTranslation('feedback');
  const { updateFeedback, isSubmitting } = useFeedbackStore();
  const { toast } = useToast();

  const form = useForm<FeedbackEditFormData>({
    resolver: zodResolver(feedbackEditSchema),
    defaultValues: {
      title: feedback.title,
      description: feedback.description,
    },
  });

  // Reset form when feedback changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        title: feedback.title,
        description: feedback.description,
      });
    }
  }, [open, feedback, form]);

  const onSubmit = async (data: FeedbackEditFormData) => {
    try {
      await updateFeedback(feedback.id, data);
      toast({
        title: t('edit.success.title'),
        description: t('edit.success.message'),
      });
      onOpenChange(false);
    } catch {
      toast({
        title: t('edit.error.title'),
        description: t('edit.error.message'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('edit.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            data-testid="feedback-edit-form"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('submit.titleField')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('submit.titlePlaceholder')}
                      data-testid="feedback-edit-title-input"
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
                  <FormLabel>{t('submit.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('submit.descriptionPlaceholder')}
                      className="min-h-[120px]"
                      data-testid="feedback-edit-description-input"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="feedback-edit-cancel-button"
              >
                {t('submit.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="feedback-edit-save-button">
                {isSubmitting ? t('edit.saving') : t('edit.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
