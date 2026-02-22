// src/components/admin/announcements/AnnouncementDetailModal.tsx

/**
 * Announcement Detail Modal Component
 *
 * Shows full announcement details including:
 * - Title and full message
 * - Link URL (if present)
 * - Creator info and timestamp
 * - Statistics with progress bar
 */

import React from 'react';

import { ExternalLink, Loader2, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { Progress } from '@/components/ui/progress';
import type { AnnouncementDetailResponse } from '@/services/adminAPI';

interface AnnouncementDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: AnnouncementDetailResponse | null;
  isLoading: boolean;
}

/**
 * Format date for detailed display
 */
const formatDetailDate = (dateString: string, locale: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Loading state component
 */
const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/**
 * Announcement Detail Modal Component
 */
export const AnnouncementDetailModal: React.FC<AnnouncementDetailModalProps> = ({
  open,
  onOpenChange,
  announcement,
  isLoading,
}) => {
  const { t, i18n } = useTranslation('admin');

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]" data-testid="announcement-detail-modal">
        <DialogHeader>
          <DialogTitle>{t('announcements.detail.title')}</DialogTitle>
          <DialogDescription>
            {announcement && formatDetailDate(announcement.created_at, i18n.language)}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingState />
        ) : announcement ? (
          <div className="space-y-6 py-4">
            {/* Title */}
            <div>
              <h3 className="text-lg font-semibold" data-testid="detail-title">
                {announcement.title}
              </h3>
            </div>

            {/* Message Card */}
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                {t('announcements.detail.message')}
              </label>
              <Card>
                <CardContent className="p-4">
                  <p className="whitespace-pre-wrap text-sm" data-testid="detail-message">
                    {announcement.message}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Link URL */}
            {announcement.link_url && (
              <div>
                <label className="mb-2 block text-sm font-medium text-muted-foreground">
                  {t('announcements.detail.link')}
                </label>
                <a
                  href={announcement.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  data-testid="detail-link"
                >
                  {announcement.link_url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Statistics Section */}
            <div>
              <label className="mb-3 block text-sm font-medium text-muted-foreground">
                {t('announcements.detail.statistics')}
              </label>
              <div className="space-y-4">
                {/* Sent/Read counts */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-muted/30">
                    <CardContent className="p-3">
                      <p className="text-sm text-muted-foreground">
                        {t('announcements.detail.sent')}
                      </p>
                      <p className="text-2xl font-semibold" data-testid="detail-sent">
                        {announcement.total_recipients}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="p-3">
                      <p className="text-sm text-muted-foreground">
                        {t('announcements.detail.read')}
                      </p>
                      <p className="text-2xl font-semibold" data-testid="detail-read">
                        {announcement.read_count}{' '}
                        <span className="text-base font-normal text-muted-foreground">
                          ({announcement.read_percentage.toFixed(1)}%)
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('announcements.detail.readProgress')}
                    </span>
                    <span className="font-medium">{announcement.read_percentage.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={announcement.read_percentage}
                    className="h-2"
                    data-testid="detail-progress"
                  />
                </div>
              </div>
            </div>

            {/* Creator Info */}
            {announcement.creator && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>
                  {t('announcements.history.by')}{' '}
                  <span className="font-medium" data-testid="detail-creator">
                    {announcement.creator.display_name || t('announcements.history.unknownAdmin')}
                  </span>
                </span>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            data-testid="detail-close-button"
          >
            {t('announcements.detail.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
