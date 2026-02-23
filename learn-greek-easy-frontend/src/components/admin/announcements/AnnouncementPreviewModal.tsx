// src/components/admin/announcements/AnnouncementPreviewModal.tsx

/**
 * Announcement Preview Modal Component
 *
 * Shows a preview of the announcement before sending:
 * - Displays title, message, and optional link
 * - Warning about irreversible action
 * - Confirm/Cancel buttons
 * - Loading state while submitting
 */

import React from 'react';

import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

import type { AnnouncementCreateFormData } from './AnnouncementCreateForm';

interface AnnouncementPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AnnouncementCreateFormData | null;
  onConfirm: () => void;
  isSubmitting: boolean;
}

/**
 * Announcement Preview Modal Component
 */
export const AnnouncementPreviewModal: React.FC<AnnouncementPreviewModalProps> = ({
  open,
  onOpenChange,
  data,
  onConfirm,
  isSubmitting,
}) => {
  const { t } = useTranslation('admin');

  if (!data) return null;

  const handleCancel = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="announcement-preview-modal">
        <DialogHeader>
          <DialogTitle>{t('announcements.preview.title')}</DialogTitle>
          <DialogDescription>{t('announcements.preview.description')}</DialogDescription>
        </DialogHeader>

        {/* Preview Content */}
        <div className="space-y-4 py-4">
          {/* Announcement Preview Card */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <h3 className="mb-2 font-semibold" data-testid="preview-title">
                {data.title}
              </h3>
              <p
                className="whitespace-pre-wrap text-sm text-muted-foreground"
                data-testid="preview-message"
              >
                {data.message}
              </p>
              {data.linkUrl && (
                <div className="mt-3">
                  <a
                    href={data.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    data-testid="preview-link"
                  >
                    {data.linkUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Warning Alert */}
          <Alert
            variant="destructive"
            className="border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <AlertTitle className="text-amber-900 dark:text-amber-200">
              {t('announcements.preview.warningTitle')}
            </AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              {t('announcements.preview.warningMessage')}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            data-testid="preview-cancel-button"
          >
            {t('announcements.preview.cancel')}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            data-testid="preview-send-button"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('announcements.preview.sending')}
              </>
            ) : (
              t('announcements.preview.send')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
