// src/components/feedback-voting/FeedbackSubmitDialog.tsx

import React from 'react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFeedbackStore } from '@/stores/feedbackStore';
import { FEEDBACK_CATEGORIES } from '@/types/feedback';

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;
const WARN_THRESHOLD = 0.9;

const feedbackSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(20, 'Description must be at least 20 characters').max(2000),
  category: z.enum(['feature_request', 'bug_incorrect_data'] as const),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

interface FeedbackSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FeedbackSubmitDialog: React.FC<FeedbackSubmitDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation('feedback');
  const { createFeedback, isSubmitting } = useFeedbackStore();
  const { toast } = useToast();

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'feature_request',
    },
  });

  const titleValue = form.watch('title');
  const descriptionValue = form.watch('description');

  const onSubmit = async (data: FeedbackFormData) => {
    try {
      await createFeedback(data);
      toast({
        title: t('submit.success.title'),
        description: t('submit.success.message'),
      });
      form.reset();
      onOpenChange(false);
    } catch {
      toast({
        title: t('submit.error.title'),
        description: t('submit.error.message'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('submit.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('submit.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            data-testid="feedback-form"
          >
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('submit.category')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="feedback-category-select">
                        <SelectValue placeholder={t('submit.categoryPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FEEDBACK_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {t(`categories.${cat.value}`)}
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('submit.titleField')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('submit.titlePlaceholder')}
                      data-testid="feedback-title-input"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <FormMessage />
                    <span
                      className={
                        titleValue.length >= TITLE_MAX * WARN_THRESHOLD
                          ? 'text-destructive'
                          : undefined
                      }
                    >
                      {titleValue.length} / {TITLE_MAX}
                    </span>
                  </div>
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
                      data-testid="feedback-description-input"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <FormMessage />
                    <span
                      className={
                        descriptionValue.length >= DESCRIPTION_MAX * WARN_THRESHOLD
                          ? 'text-destructive'
                          : undefined
                      }
                    >
                      {descriptionValue.length} / {DESCRIPTION_MAX}
                    </span>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="feedback-cancel-button"
              >
                {t('submit.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="feedback-submit-button">
                {isSubmitting ? t('submit.submitting') : t('submit.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
