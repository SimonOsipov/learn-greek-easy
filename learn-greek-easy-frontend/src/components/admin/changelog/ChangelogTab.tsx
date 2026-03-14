/**
 * Main admin tab for changelog management.
 *
 * Integrates table, edit modal, and delete dialog.
 * Features:
 * - Button to open create modal for adding changelog entries
 * - Table with edit/delete actions
 * - JSON-based edit modal for editing existing entries
 * - Delete confirmation dialog
 * - Pagination support
 */

import { useEffect, useState } from 'react';

import { Calendar, FileText, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SummaryCard } from '@/components/admin/SummaryCard';
import { Button } from '@/components/ui/button';
import {
  useAdminChangelogStore,
  selectAdminChangelogItems,
  selectAdminChangelogIsLoading,
  selectAdminChangelogPage,
  selectAdminChangelogPageSize,
  selectAdminChangelogTotal,
  selectAdminChangelogTotalPages,
} from '@/stores/adminChangelogStore';
import type { ChangelogEntryAdmin } from '@/types/changelog';

import { ChangelogCreateModal } from './ChangelogCreateModal';
import { ChangelogDeleteDialog } from './ChangelogDeleteDialog';
import { ChangelogEditModal } from './ChangelogEditModal';
import { ChangelogTable } from './ChangelogTable';

/**
 * ChangelogTab component
 */
export function ChangelogTab() {
  const { t } = useTranslation(['admin']);

  // Store state using selectors
  const items = useAdminChangelogStore(selectAdminChangelogItems);
  const isLoading = useAdminChangelogStore(selectAdminChangelogIsLoading);
  const page = useAdminChangelogStore(selectAdminChangelogPage);
  const pageSize = useAdminChangelogStore(selectAdminChangelogPageSize);
  const total = useAdminChangelogStore(selectAdminChangelogTotal);
  const totalPages = useAdminChangelogStore(selectAdminChangelogTotalPages);

  // Store actions
  const { fetchList, setPage, reset } = useAdminChangelogStore();

  // Local UI state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ChangelogEntryAdmin | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<ChangelogEntryAdmin | null>(null);

  // Fetch on mount
  useEffect(() => {
    fetchList();
    return () => reset();
  }, [fetchList, reset]);

  // Handlers

  const handleEdit = (entry: ChangelogEntryAdmin) => {
    setEditingEntry(entry);
    setIsEditOpen(true);
  };

  const handleDelete = (entry: ChangelogEntryAdmin) => {
    setDeletingEntry(entry);
    setIsDeleteOpen(true);
  };

  const handleDeleteDialogClose = (open: boolean) => {
    setIsDeleteOpen(open);
    if (!open) {
      setDeletingEntry(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const mostRecentDate =
    items.length > 0
      ? new Date(
          items.reduce(
            (latest, item) => (item.created_at > latest ? item.created_at : latest),
            items[0].created_at
          )
        ).toLocaleDateString()
      : '—';

  return (
    <>
      <div className="space-y-6" data-testid="changelog-tab">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard
            title={t('admin:changelog.stats.total')}
            value={total}
            icon={<FileText className="h-5 w-5 text-muted-foreground" />}
            testId="changelog-total-card"
          />
          <SummaryCard
            title={t('admin:changelog.stats.mostRecent')}
            value={mostRecentDate}
            icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
            testId="changelog-most-recent-card"
          />
        </div>

        {/* Create Button */}
        <div className="flex justify-end">
          <Button onClick={() => setIsCreateOpen(true)} data-testid="changelog-create-button">
            <Plus className="mr-2 h-4 w-4" />
            {t('admin:changelog.create.title')}
          </Button>
        </div>

        {/* Table */}
        <ChangelogTable
          items={items}
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      {/* Edit Modal - JSON-based editing */}
      {editingEntry && (
        <ChangelogEditModal
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) setEditingEntry(null);
          }}
          entry={editingEntry}
        />
      )}

      {/* Delete Dialog - handles deletion internally */}
      <ChangelogDeleteDialog
        open={isDeleteOpen}
        onOpenChange={handleDeleteDialogClose}
        entry={deletingEntry}
      />

      {/* Create Modal */}
      <ChangelogCreateModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </>
  );
}
