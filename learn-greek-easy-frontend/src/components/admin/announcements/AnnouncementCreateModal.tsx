// src/components/admin/announcements/AnnouncementCreateModal.tsx

/**
 * Announcement Create Modal Component
 *
 * Modal dialog for creating announcements with:
 * - Two input modes: Form tab and JSON tab
 * - Dirty-state guard when switching modes (ConfirmDialog)
 * - Dirty-state guard when closing the modal
 * - Preview modal (AnnouncementPreviewModal) as second-level modal
 * - Success callback to refresh parent data
 */

import React, { useCallback, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';

import { AnnouncementCreateForm, type AnnouncementCreateFormData } from './AnnouncementCreateForm';
import { AnnouncementJsonInput } from './AnnouncementJsonInput';
import { AnnouncementPreviewModal } from './AnnouncementPreviewModal';

interface AnnouncementCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const AnnouncementCreateModal: React.FC<AnnouncementCreateModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { t } = useTranslation('admin');

  // Create mode toggle state
  const [createMode, setCreateMode] = useState<'form' | 'json'>('form');
  const [pendingMode, setPendingMode] = useState<'form' | 'json' | null>(null);
  const jsonDirtyRef = useRef(false);
  const formDirtyRef = useRef(false);

  // Form key for forcing re-render/reset
  const [formKey, setFormKey] = useState(0);

  // Preview modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<AnnouncementCreateFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close guard state
  const [pendingClose, setPendingClose] = useState(false);

  /**
   * Reset all state and close the modal
   */
  const resetAndClose = useCallback(() => {
    setCreateMode('form');
    setFormKey((k) => k + 1);
    jsonDirtyRef.current = false;
    formDirtyRef.current = false;
    setPendingMode(null);
    setPreviewData(null);
    setIsPreviewOpen(false);
    setPendingClose(false);
    onOpenChange(false);
  }, [onOpenChange]);

  /**
   * Handle dialog open/close — guard against closing with dirty state
   */
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        const isDirty = jsonDirtyRef.current || formDirtyRef.current;
        if (isDirty) {
          setPendingClose(true);
        } else {
          resetAndClose();
        }
      } else {
        onOpenChange(true);
      }
    },
    [onOpenChange, resetAndClose]
  );

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
   * Handle preview modal close — blocked while submitting
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

      onSuccess?.();
      resetAndClose();
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
  }, [previewData, t, onSuccess, resetAndClose]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="announcement-create-modal" className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('announcements.create.title')}</DialogTitle>
          <DialogDescription>{t('announcements.create.description')}</DialogDescription>
        </DialogHeader>

        <Tabs value={createMode} onValueChange={handleModeChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="form" data-testid="create-mode-form-tab">
              {t('announcements.create.formTab')}
            </TabsTrigger>
            <TabsTrigger value="json" data-testid="create-mode-json-tab">
              {t('announcements.create.jsonTab')}
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

        {/* Preview modal - second level */}
        <AnnouncementPreviewModal
          open={isPreviewOpen}
          onOpenChange={handlePreviewClose}
          data={previewData}
          onConfirm={handleConfirm}
          isSubmitting={isSubmitting}
        />

        {/* Mode switch confirm dialog */}
        <ConfirmDialog
          open={pendingMode !== null}
          onOpenChange={(open) => {
            if (!open) setPendingMode(null);
          }}
          title={t('announcements.create.switchModeConfirmTitle')}
          description={t('announcements.create.switchModeConfirm')}
          onConfirm={handleConfirmModeSwitch}
        />

        {/* Close confirm dialog */}
        <ConfirmDialog
          open={pendingClose}
          onOpenChange={(open) => {
            if (!open) setPendingClose(false);
          }}
          title={t('announcements.create.unsavedTitle')}
          description={t('announcements.create.unsavedDescription')}
          onConfirm={resetAndClose}
          onCancel={() => setPendingClose(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
