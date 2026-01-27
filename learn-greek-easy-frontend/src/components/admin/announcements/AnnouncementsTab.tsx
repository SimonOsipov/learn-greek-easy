// src/components/admin/announcements/AnnouncementsTab.tsx

/**
 * Announcements Tab Component
 *
 * Main container for announcements management in admin panel.
 * Features:
 * - Create announcement form
 * - Preview modal before sending
 * - History table with past announcements
 * - Detail modal for viewing announcement stats
 * - Success/error toasts
 * - Form reset on success
 */

import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';
import { useAdminAnnouncementStore } from '@/stores/adminAnnouncementStore';

import { AnnouncementCreateForm, type AnnouncementCreateFormData } from './AnnouncementCreateForm';
import { AnnouncementDetailModal } from './AnnouncementDetailModal';
import { AnnouncementHistoryTable } from './AnnouncementHistoryTable';
import { AnnouncementPreviewModal } from './AnnouncementPreviewModal';

/**
 * Announcements Tab Component
 */
export const AnnouncementsTab: React.FC = () => {
  const { t } = useTranslation('admin');

  // Preview modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<AnnouncementCreateFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail modal state
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Form key for forcing re-render/reset
  const [formKey, setFormKey] = useState(0);

  // Store state and actions
  const {
    announcements,
    selectedAnnouncement,
    page,
    totalPages,
    isLoading,
    isLoadingDetail,
    fetchAnnouncements,
    fetchAnnouncementDetail,
    setPage,
    clearSelectedAnnouncement,
    refresh,
  } = useAdminAnnouncementStore();

  // Fetch announcements on mount
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  /**
   * Handle preview button click from form
   */
  const handlePreview = useCallback((data: AnnouncementCreateFormData) => {
    setPreviewData(data);
    setIsPreviewOpen(true);
  }, []);

  /**
   * Handle confirmation from preview modal
   */
  const handleConfirm = useCallback(async () => {
    if (!previewData) return;

    setIsSubmitting(true);

    try {
      await adminAPI.createAnnouncement({
        title: previewData.title,
        message: previewData.message,
        link_url: previewData.linkUrl || undefined,
      });

      toast({
        title: t('announcements.create.success'),
      });

      // Close modal and reset form
      setIsPreviewOpen(false);
      setPreviewData(null);
      setFormKey((prev) => prev + 1); // Force form re-render to reset

      // Refresh the announcements list
      await refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: t('announcements.create.error'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [previewData, t, refresh]);

  /**
   * Handle preview modal close
   */
  const handlePreviewClose = useCallback(
    (open: boolean) => {
      if (!isSubmitting) {
        setIsPreviewOpen(open);
        if (!open) {
          setPreviewData(null);
        }
      }
    },
    [isSubmitting]
  );

  /**
   * Handle view detail click
   */
  const handleViewDetail = useCallback(
    async (id: string) => {
      setIsDetailOpen(true);
      await fetchAnnouncementDetail(id);
    },
    [fetchAnnouncementDetail]
  );

  /**
   * Handle detail modal close
   */
  const handleDetailClose = useCallback(
    (open: boolean) => {
      setIsDetailOpen(open);
      if (!open) {
        clearSelectedAnnouncement();
      }
    },
    [clearSelectedAnnouncement]
  );

  /**
   * Handle page change
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
    },
    [setPage]
  );

  return (
    <div className="space-y-6">
      {/* Create Form */}
      <Card data-testid="announcements-tab">
        <CardHeader>
          <CardTitle>{t('announcements.create.title')}</CardTitle>
          <CardDescription>{t('announcements.create.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementCreateForm
            key={formKey}
            onPreview={handlePreview}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>

      {/* History Table */}
      <AnnouncementHistoryTable
        announcements={announcements}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onViewDetail={handleViewDetail}
      />

      {/* Preview Modal */}
      <AnnouncementPreviewModal
        open={isPreviewOpen}
        onOpenChange={handlePreviewClose}
        data={previewData}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
      />

      {/* Detail Modal */}
      <AnnouncementDetailModal
        open={isDetailOpen}
        onOpenChange={handleDetailClose}
        announcement={selectedAnnouncement}
        isLoading={isLoadingDetail}
      />
    </div>
  );
};
