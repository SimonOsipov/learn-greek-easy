/**
 * Main admin tab for changelog management.
 *
 * Integrates table, form modal, and delete dialog.
 * Features:
 * - "Add New" button to create changelog entries
 * - Table with edit/delete actions
 * - Form modal for create/edit operations
 * - Delete confirmation dialog
 * - Pagination support
 */

import { useEffect, useState } from 'react';

import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  useAdminChangelogStore,
  selectAdminChangelogItems,
  selectAdminChangelogIsLoading,
  selectAdminChangelogIsSaving,
  selectAdminChangelogPage,
  selectAdminChangelogPageSize,
  selectAdminChangelogTotal,
  selectAdminChangelogTotalPages,
} from '@/stores/adminChangelogStore';
import type { ChangelogEntryAdmin, ChangelogCreateRequest } from '@/types/changelog';

import { ChangelogDeleteDialog } from './ChangelogDeleteDialog';
import { ChangelogFormModal } from './ChangelogFormModal';
import { ChangelogTable } from './ChangelogTable';

/**
 * ChangelogTab component
 */
export function ChangelogTab() {
  const { t } = useTranslation(['admin']);

  // Store state using selectors
  const items = useAdminChangelogStore(selectAdminChangelogItems);
  const isLoading = useAdminChangelogStore(selectAdminChangelogIsLoading);
  const isSaving = useAdminChangelogStore(selectAdminChangelogIsSaving);
  const page = useAdminChangelogStore(selectAdminChangelogPage);
  const pageSize = useAdminChangelogStore(selectAdminChangelogPageSize);
  const total = useAdminChangelogStore(selectAdminChangelogTotal);
  const totalPages = useAdminChangelogStore(selectAdminChangelogTotalPages);

  // Store actions
  const { fetchList, createEntry, updateEntry, setPage, reset } = useAdminChangelogStore();

  // Local UI state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ChangelogEntryAdmin | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<ChangelogEntryAdmin | null>(null);

  // Fetch on mount
  useEffect(() => {
    fetchList();
    return () => reset();
  }, [fetchList, reset]);

  // Handlers
  const handleCreate = () => {
    setEditingEntry(null);
    setIsFormOpen(true);
  };

  const handleEdit = (entry: ChangelogEntryAdmin) => {
    setEditingEntry(entry);
    setIsFormOpen(true);
  };

  const handleDelete = (entry: ChangelogEntryAdmin) => {
    setDeletingEntry(entry);
    setIsDeleteOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingEntry(null);
  };

  const handleDeleteDialogClose = (open: boolean) => {
    setIsDeleteOpen(open);
    if (!open) {
      setDeletingEntry(null);
    }
  };

  const handleFormSubmit = async (data: ChangelogCreateRequest) => {
    try {
      if (editingEntry) {
        await updateEntry(editingEntry.id, data);
        toast({
          title: t('admin:changelog.toast.updated'),
        });
      } else {
        await createEntry(data);
        toast({
          title: t('admin:changelog.toast.created'),
        });
      }
      handleFormClose();
    } catch {
      toast({
        title: editingEntry
          ? t('admin:changelog.toast.updateError')
          : t('admin:changelog.toast.createError'),
        variant: 'destructive',
      });
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <>
      <div className="space-y-6" data-testid="changelog-tab">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t('admin:changelog.title')}</h2>
          <Button onClick={handleCreate} data-testid="changelog-add-button">
            <Plus className="mr-2 h-4 w-4" />
            {t('admin:changelog.addNew')}
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

      {/* Form Modal */}
      <ChangelogFormModal
        open={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        entry={editingEntry}
        isSaving={isSaving}
      />

      {/* Delete Dialog - handles deletion internally */}
      <ChangelogDeleteDialog
        open={isDeleteOpen}
        onOpenChange={handleDeleteDialogClose}
        entry={deletingEntry}
      />
    </>
  );
}
