/**
 * Main admin tab for changelog management.
 *
 * Integrates table, edit modal, and delete dialog.
 * Features:
 * - JSON input card for creating changelog entries
 * - Table with edit/delete actions
 * - JSON-based edit modal for editing existing entries
 * - Delete confirmation dialog
 * - Pagination support
 */

import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/apiErrorUtils';
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
import type { ChangelogEntryAdmin } from '@/types/changelog';

import { ChangelogDeleteDialog } from './ChangelogDeleteDialog';
import { ChangelogEditModal } from './ChangelogEditModal';
import { validateChangelogJson, JSON_PLACEHOLDER } from './changelogJsonValidation';
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
  const { fetchList, createEntry, setPage, reset } = useAdminChangelogStore();

  // Local UI state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ChangelogEntryAdmin | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<ChangelogEntryAdmin | null>(null);

  // JSON input state for create card
  const [jsonInput, setJsonInput] = useState('');

  // Fetch on mount
  useEffect(() => {
    fetchList();
    return () => reset();
  }, [fetchList, reset]);

  // Handlers

  /**
   * Handle JSON submission for creating a changelog entry
   */
  const handleJsonSubmit = async () => {
    const validation = validateChangelogJson(jsonInput);

    if (!validation.valid) {
      const errorParams = validation.error.fields
        ? { fields: validation.error.fields.join(', ') }
        : undefined;
      toast({
        title: t('admin:changelog.create.validationError'),
        description: t(validation.error.messageKey, errorParams),
        variant: 'destructive',
      });
      return;
    }

    try {
      await createEntry(validation.data);
      toast({
        title: t('admin:changelog.toast.created'),
      });
      setJsonInput(''); // Clear input on success
    } catch (error) {
      const apiErrorMessage = getApiErrorMessage(error);
      toast({
        title: t('admin:changelog.toast.createError'),
        description: apiErrorMessage || undefined,
        variant: 'destructive',
      });
    }
  };

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

  return (
    <>
      <div className="space-y-6" data-testid="changelog-tab">
        {/* Create Changelog Entry Section */}
        <Card data-testid="changelog-create-card">
          <CardHeader>
            <CardTitle>{t('admin:changelog.create.title')}</CardTitle>
            <CardDescription>{t('admin:changelog.create.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={JSON_PLACEHOLDER}
                className="min-h-[200px] font-mono text-sm"
                data-testid="changelog-json-input"
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t('admin:changelog.create.hint')}</p>
                <Button
                  onClick={handleJsonSubmit}
                  disabled={isSaving || !jsonInput.trim()}
                  data-testid="changelog-submit-button"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('admin:changelog.create.submitting')}
                    </>
                  ) : (
                    t('admin:changelog.create.submit')
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
    </>
  );
}
