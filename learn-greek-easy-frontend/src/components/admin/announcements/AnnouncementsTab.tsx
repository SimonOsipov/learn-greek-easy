// src/components/admin/announcements/AnnouncementsTab.tsx

/**
 * Announcements Tab Component
 *
 * Main container for announcements management in admin panel.
 * Features:
 * - Create announcement button (opens modal)
 * - History table with past announcements
 * - Detail modal for viewing announcement stats
 * - Success/error toasts
 */

import React, { useCallback, useEffect, useState } from 'react';

import { BarChart3, Megaphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SummaryCard } from '@/components/admin/SummaryCard';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { useAdminAnnouncementStore } from '@/stores/adminAnnouncementStore';

import { AnnouncementCreateModal } from './AnnouncementCreateModal';
import { AnnouncementDetailModal } from './AnnouncementDetailModal';
import { AnnouncementHistoryTable } from './AnnouncementHistoryTable';

/**
 * Announcements Tab Component
 */
export const AnnouncementsTab: React.FC = () => {
  const { t } = useTranslation('admin');

  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Detail modal state
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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
  } = useAdminAnnouncementStore();

  // Fetch announcements on mount
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

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
    <div className="space-y-6" data-testid="announcements-tab">
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
        onCreateClick={() => setCreateModalOpen(true)}
      />

      {/* Create Modal */}
      <AnnouncementCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          setPage(1);
          fetchAnnouncements();
        }}
      />

      {/* Detail Modal */}
      <AnnouncementDetailModal
        open={isDetailOpen}
        onOpenChange={handleDetailClose}
        announcement={selectedAnnouncement}
        isLoading={isLoadingDetail}
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
