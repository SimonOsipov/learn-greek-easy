// src/components/admin/AdminFeedbackResponseDialog.tsx

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAdminFeedbackStore } from '@/stores/adminFeedbackStore';
import type { AdminFeedbackItem, FeedbackStatus } from '@/types/feedback';
import { FEEDBACK_STATUSES } from '@/types/feedback';

const responseSchema = z.object({
  status: z.enum([
    'new',
    'under_review',
    'planned',
    'in_progress',
    'completed',
    'cancelled',
  ] as const),
  admin_response: z.string().max(500, 'Response must be 500 characters or less').optional(),
});

type ResponseFormData = z.infer<typeof responseSchema>;

interface AdminFeedbackResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedback: AdminFeedbackItem | null;
}

/**
 * Dialog for admin to respond to feedback and update status
 */
export const AdminFeedbackResponseDialog: React.FC<AdminFeedbackResponseDialogProps> = ({
  open,
  onOpenChange,
  feedback,
}) => {
  const { t } = useTranslation('admin');
  const { updateFeedback, isUpdating } = useAdminFeedbackStore();
  const { toast } = useToast();

  const form = useForm<ResponseFormData>({
    resolver: zodResolver(responseSchema),
    defaultValues: {
      status: feedback?.status || 'new',
      admin_response: feedback?.admin_response || '',
    },
  });

  // Reset form when feedback changes or dialog opens
  useEffect(() => {
    if (open && feedback) {
      form.reset({
        status: feedback.status,
        admin_response: feedback.admin_response || '',
      });
    }
  }, [open, feedback, form]);

  const onSubmit = async (data: ResponseFormData) => {
    if (!feedback) return;

    try {
      // Build update payload - only include non-empty values
      const updateData: { status?: FeedbackStatus; admin_response?: string } = {};

      // Always include status if it changed
      if (data.status !== feedback.status) {
        updateData.status = data.status;
      }

      // Include response if it changed (including clearing it)
      const newResponse = data.admin_response?.trim() || undefined;
      const oldResponse = feedback.admin_response || undefined;
      if (newResponse !== oldResponse) {
        updateData.admin_response = newResponse;
      }

      // If nothing changed, just close
      if (Object.keys(updateData).length === 0) {
        onOpenChange(false);
        return;
      }

      // Ensure at least one field is provided
      if (!updateData.status && !updateData.admin_response) {
        // If status didn't change but we're trying to update, include current status
        updateData.status = data.status;
      }

      await updateFeedback(feedback.id, updateData);

      toast({
        title: t('feedback.response.success.title'),
        description: t('feedback.response.success.message'),
      });

      onOpenChange(false);
    } catch {
      toast({
        title: t('feedback.response.error.title'),
        description: t('feedback.response.error.message'),
        variant: 'destructive',
      });
    }
  };

  if (!feedback) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="admin-feedback-response-dialog">
        <DialogHeader>
          <DialogTitle>{t('feedback.response.title')}</DialogTitle>
          <DialogDescription className="line-clamp-2">{feedback.title}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('feedback.response.statusLabel')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="feedback-status-select">
                        <SelectValue placeholder={t('feedback.response.statusPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FEEDBACK_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {t(`feedback.statuses.${status.value}`)}
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
              name="admin_response"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('feedback.response.responseLabel')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('feedback.response.responsePlaceholder')}
                      className="min-h-[120px] resize-none"
                      maxLength={500}
                      data-testid="feedback-response-textarea"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <FormMessage />
                    <span>{field.value?.length || 0}/500</span>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUpdating}
                data-testid="feedback-response-cancel"
              >
                {t('feedback.response.cancel')}
              </Button>
              <Button type="submit" disabled={isUpdating} data-testid="feedback-response-submit">
                {isUpdating ? t('feedback.response.saving') : t('feedback.response.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
