// src/components/admin/news/NewsTab.tsx

/**
 * Admin News Tab Component
 *
 * Main container for managing news items in the admin panel.
 * Features:
 * - Modal dialog for creating new news items
 * - News items table with pagination
 * - Edit and delete functionality
 */

import React, { useEffect, useState } from 'react';

import { Newspaper, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SummaryCard } from '@/components/admin/SummaryCard';
import { useAdminNewsStore } from '@/stores/adminNewsStore';

import { NewsItemCreateModal } from './NewsItemCreateModal';
import { NewsItemDeleteDialog } from './NewsItemDeleteDialog';
import { NewsItemEditModal } from './NewsItemEditModal';
import { NewsItemsTable } from './NewsItemsTable';

/**
 * NewsTab component
 */
export const NewsTab: React.FC = () => {
  const { t } = useTranslation('admin');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    newsItems,
    selectedItem,
    page,
    pageSize,
    total,
    totalPages,
    isLoading,
    fetchNewsItems,
    setPage,
    setSelectedItem,
    setCountryFilter,
    countryFilter,
    audioCount,
  } = useAdminNewsStore();

  // Fetch news items on mount
  useEffect(() => {
    fetchNewsItems();
  }, [fetchNewsItems]);

  /**
   * Handle edit button click
   */
  const handleEdit = (item: typeof selectedItem) => {
    if (item) {
      setSelectedItem(item);
      setIsEditModalOpen(true);
    }
  };

  /**
   * Handle delete button click
   */
  const handleDelete = (item: typeof selectedItem) => {
    if (item) {
      setSelectedItem(item);
      setIsDeleteDialogOpen(true);
    }
  };

  /**
   * Handle edit modal close
   */
  const handleEditModalClose = (open: boolean) => {
    setIsEditModalOpen(open);
    if (!open) {
      setSelectedItem(null);
    }
  };

  /**
   * Handle delete dialog close
   */
  const handleDeleteDialogClose = (open: boolean) => {
    setIsDeleteDialogOpen(open);
    if (!open) {
      setSelectedItem(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard
            title={t('news.stats.total')}
            value={total}
            icon={<Newspaper className="h-5 w-5 text-muted-foreground" />}
            testId="news-total-card"
          />
          <SummaryCard
            title={t('news.stats.withAudio')}
            value={audioCount}
            icon={<Volume2 className="h-5 w-5 text-muted-foreground" />}
            testId="news-with-audio-card"
          />
        </div>

        {/* News Items Table Section */}
        <NewsItemsTable
          newsItems={newsItems}
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onEdit={handleEdit}
          onDelete={handleDelete}
          countryFilter={countryFilter}
          onCountryFilterChange={(v) =>
            setCountryFilter(v === null ? 'all' : (v as 'cyprus' | 'greece' | 'world'))
          }
          onCreateClick={() => setCreateModalOpen(true)}
        />
      </div>

      {/* Create Modal */}
      <NewsItemCreateModal open={createModalOpen} onOpenChange={setCreateModalOpen} />

      {/* Edit Modal */}
      <NewsItemEditModal
        open={isEditModalOpen}
        onOpenChange={handleEditModalClose}
        item={selectedItem}
      />

      {/* Delete Dialog */}
      <NewsItemDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogClose}
        item={selectedItem}
      />
    </>
  );
};
