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

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { BarChart3, Megaphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SummaryCard } from '@/components/admin/SummaryCard';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';
import { useAdminAnnouncementStore } from '@/stores/adminAnnouncementStore';

import { AnnouncementCreateForm, type AnnouncementCreateFormData } from './AnnouncementCreateForm';
import { AnnouncementDetailModal } from './AnnouncementDetailModal';
import { AnnouncementHistoryTable } from './AnnouncementHistoryTable';
import { AnnouncementJsonInput } from './AnnouncementJsonInput';
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

  // Create mode toggle state
  const [createMode, setCreateMode] = useState<'form' | 'json'>('form');
  const [pendingMode, setPendingMode] = useState<'form' | 'json' | null>(null);
  const jsonDirtyRef = useRef(false);
  const formDirtyRef = useRef(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Store state and actions
  const {
    announcements,
    selectedAnnouncement,
    page,
    total,
    totalPages,
    isLoading,
    isLoadingDetail,
    isDeleting,
    fetchAnnouncements,
    fetchAnnouncementDetail,
    deleteAnnouncement,
    setPage,
    clearSelectedAnnouncement,
    refresh,
  } = useAdminAnnouncementStore();

  // Fetch announcements on mount
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  /**
   * Handle mode tab change with dirty-state guard
   */
  const handleModeChange = (newMode: string) => {
    const mode = newMode as 'form' | 'json';
    const isDirty = createMode === 'json' ? jsonDirtyRef.current : formDirtyRef.current;
    if (isDirty) {
      setPendingMode(mode);
    } else {
      setCreateMode(mode);
      setFormKey((k) => k + 1);
    }
  };

  const handleConfirmModeSwitch = () => {
    if (pendingMode) {
      setCreateMode(pendingMode);
      setFormKey((k) => k + 1);
      jsonDirtyRef.current = false;
      formDirtyRef.current = false;
      setPendingMode(null);
    }
  };

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

  const avgReadPct =
    announcements.length > 0
      ? Math.round(
          announcements.reduce(
            (sum, a) =>
              sum + (a.total_recipients > 0 ? (a.read_count / a.total_recipients) * 100 : 0),
            0
          ) / announcements.length
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard
          title={t('announcements.stats.total')}
          value={total}
          icon={<Megaphone className="h-5 w-5 text-muted-foreground" />}
          testId="announcements-total-card"
        />
        <SummaryCard
          title={t('announcements.stats.avgRead')}
          value={`${avgReadPct}%`}
          icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}
          testId="announcements-avg-read-card"
        />
      </div>

      {/* Create Form */}
      <Card data-testid="announcements-tab">
        <CardHeader>
          <CardTitle>{t('announcements.create.title')}</CardTitle>
          <CardDescription>{t('announcements.create.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={createMode} onValueChange={handleModeChange}>
            <TabsList className="mb-4">
              <TabsTrigger value="form" data-testid="create-mode-form-tab">
                {t('announcements.create.modeForm')}
              </TabsTrigger>
              <TabsTrigger value="json" data-testid="create-mode-json-tab">
                {t('announcements.create.modeJson')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="form">
              <div
                onInput={() => {
                  formDirtyRef.current = true;
                }}
              >
                <AnnouncementCreateForm
                  key={formKey}
                  onPreview={handlePreview}
                  isSubmitting={isSubmitting}
                />
              </div>
            </TabsContent>
            <TabsContent value="json">
              <AnnouncementJsonInput
                onPreview={handlePreview}
                isSubmitting={isSubmitting}
                resetKey={formKey}
                onDirtyChange={(dirty) => {
                  jsonDirtyRef.current = dirty;
                }}
              />
            </TabsContent>
          </Tabs>
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
        onDelete={(id) => setDeleteTarget(id)}
        isDeleting={isDeleting}
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

      {/* Mode Switch Confirm Dialog */}
      <ConfirmDialog
        open={pendingMode !== null}
        onOpenChange={(open) => {
          if (!open) setPendingMode(null);
        }}
        title={t('announcements.create.switchModeConfirmTitle')}
        description={t('announcements.create.switchModeConfirm')}
        onConfirm={handleConfirmModeSwitch}
      />

      {/* Delete Announcement Confirm Dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('announcements.delete.title')}
        description={t('announcements.delete.warning')}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteAnnouncement(deleteTarget);
            setDeleteTarget(null);
          }
        }}
        variant="destructive"
      />
    </div>
  );
};
