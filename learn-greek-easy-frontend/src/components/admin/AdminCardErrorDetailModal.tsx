// src/components/admin/AdminCardErrorDetailModal.tsx

import React, { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Copy, Globe, Loader2, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { adminAPI } from '@/services/adminAPI';
import type {
  AdminCardErrorResponse,
  AdminCardErrorUpdateRequest,
  CardErrorStatus,
} from '@/types/cardError';
import { CARD_ERROR_STATUS_CONFIG } from '@/types/cardError';

// ============================================
// Types
// ============================================

export interface AdminCardErrorDetailModalProps {
  /** Controls modal visibility */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** The error report to display (null when closed) */
  report: AdminCardErrorResponse | null;
  /** Callback after successful update */
  onUpdate: (updatedReport: AdminCardErrorResponse) => void;
}

// ============================================
// Form Schema
// ============================================

const updateFormSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'FIXED', 'DISMISSED']),
  admin_notes: z
    .string()
    .max(1000, 'Admin notes must be 1000 characters or less')
    .optional()
    .transform((val) => val?.trim() || undefined),
});

type UpdateFormData = z.infer<typeof updateFormSchema>;

// ============================================
// Helpers
// ============================================

/**
 * Format date for display in modal
 */
const formatDate = (dateString: string, locale: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================
// Status Badge Component
// ============================================

interface CardErrorStatusBadgeProps {
  status: CardErrorStatus;
}

const CardErrorStatusBadge: React.FC<CardErrorStatusBadgeProps> = ({ status }) => {
  const config = CARD_ERROR_STATUS_CONFIG[status];
  return <Badge className={cn(config.bgColor, config.color)}>{config.label}</Badge>;
};

// ============================================
// Main Component
// ============================================

/**
 * Admin Card Error Detail Modal
 *
 * Modal for viewing and updating individual card error reports.
 * Displays full report information and provides admin actions:
 * - Status dropdown (PENDING, REVIEWED, FIXED, DISMISSED)
 * - Admin notes textarea (max 1000 chars)
 * - View Card button (copies card ID to clipboard)
 * - Save/Cancel buttons
 */
export const AdminCardErrorDetailModal: React.FC<AdminCardErrorDetailModalProps> = ({
  open,
  onOpenChange,
  report,
  onUpdate,
}) => {
  const { t, i18n } = useTranslation('admin');
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const form = useForm<UpdateFormData>({
    resolver: zodResolver(updateFormSchema),
    defaultValues: {
      status: report?.status || 'PENDING',
      admin_notes: report?.admin_notes || '',
    },
  });

  // Reset form when report changes or dialog opens
  useEffect(() => {
    if (open && report) {
      form.reset({
        status: report.status,
        admin_notes: report.admin_notes || '',
      });
    }
  }, [open, report, form]);

  const onSubmit = async (data: UpdateFormData) => {
    if (!report) return;

    setIsUpdating(true);
    try {
      // Build update payload - only include changed fields
      const updateData: AdminCardErrorUpdateRequest = {};

      if (data.status !== report.status) {
        updateData.status = data.status;
      }

      const newNotes = data.admin_notes?.trim() || undefined;
      const oldNotes = report.admin_notes || undefined;
      if (newNotes !== oldNotes) {
        updateData.admin_notes = newNotes;
      }

      // If nothing changed, just close
      if (Object.keys(updateData).length === 0) {
        onOpenChange(false);
        return;
      }

      const updatedReport = await adminAPI.updateCardError(report.id, updateData);

      toast({
        title: t('cardErrors.detail.updateSuccess'),
        description: t('cardErrors.detail.updateSuccessMessage'),
      });

      onUpdate(updatedReport);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t('cardErrors.detail.updateError'),
        description:
          error instanceof Error ? error.message : t('cardErrors.detail.updateErrorMessage'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Navigation handler for View Card button
  const handleViewCard = async () => {
    if (!report) return;

    // Log card info for debugging
    // eslint-disable-next-line no-console
    console.log('View card:', report.card_id, report.card_type);

    // Copy card ID to clipboard
    try {
      await navigator.clipboard.writeText(report.card_id);
      toast({
        title: t('cardErrors.detail.cardIdCopied'),
        description: t('cardErrors.detail.cardIdCopiedMessage'),
      });
    } catch (clipboardError) {
      // Fallback if clipboard API fails
      // eslint-disable-next-line no-console
      console.error('Failed to copy card ID:', clipboardError);
      toast({
        title: t('cardErrors.detail.cardIdCopied'),
        description: report.card_id,
      });
    }
  };

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="card-error-detail-modal">
        <DialogHeader>
          <DialogTitle>{t('cardErrors.detail.title')}</DialogTitle>
          <DialogDescription>
            {t('cardErrors.detail.reportedOn', {
              date: formatDate(report.created_at, i18n.language),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Report Info Section */}
          <div className="space-y-4">
            {/* Card Type Badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {report.card_type === 'WORD' ? (
                  <BookOpen className="mr-1 h-3 w-3" />
                ) : (
                  <Globe className="mr-1 h-3 w-3" />
                )}
                {t(`cardErrors.cardTypes.${report.card_type.toLowerCase()}`)}
              </Badge>
              <CardErrorStatusBadge status={report.status} />
            </div>

            {/* Reporter Info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>
                {t('cardErrors.detail.reportedBy')}{' '}
                <span className="font-medium">
                  {report.reporter.full_name || t('cardErrors.detail.anonymousUser')}
                </span>
              </span>
            </div>

            {/* User Description */}
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                {t('cardErrors.detail.userDescription')}
              </label>
              <Card>
                <CardContent className="p-4">
                  <p className="whitespace-pre-wrap text-sm" data-testid="error-description">
                    {report.description}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* View Card Button */}
            <Button
              variant="outline"
              onClick={handleViewCard}
              className="w-full"
              data-testid="view-card-button"
            >
              <Copy className="mr-2 h-4 w-4" />
              {t('cardErrors.detail.copyCardId')}
            </Button>
          </div>

          {/* Admin Actions Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Separator */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('cardErrors.detail.adminActions')}
                  </span>
                </div>
              </div>

              {/* Status Select */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('cardErrors.detail.statusLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="status-select">
                          <SelectValue placeholder={t('cardErrors.detail.selectStatus')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(['PENDING', 'REVIEWED', 'FIXED', 'DISMISSED'] as const).map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(`cardErrors.statuses.${status.toLowerCase()}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Admin Notes Textarea */}
              <FormField
                control={form.control}
                name="admin_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('cardErrors.detail.adminNotesLabel')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('cardErrors.detail.adminNotesPlaceholder')}
                        className="min-h-[100px] resize-none"
                        maxLength={1000}
                        data-testid="admin-notes-textarea"
                        {...field}
                      />
                    </FormControl>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <FormMessage />
                      <span>{field.value?.length || 0}/1000</span>
                    </div>
                  </FormItem>
                )}
              />

              {/* Resolution Info (if resolved) */}
              {report.resolved_at && (
                <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                  <p>
                    {t('cardErrors.detail.resolvedAt', {
                      date: formatDate(report.resolved_at, i18n.language),
                    })}
                  </p>
                </div>
              )}

              {/* Form Actions */}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isUpdating}
                  data-testid="cancel-button"
                >
                  {t('feedback.response.cancel')}
                </Button>
                <Button type="submit" disabled={isUpdating} data-testid="save-button">
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('feedback.response.saving')}
                    </>
                  ) : (
                    t('feedback.response.save')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
