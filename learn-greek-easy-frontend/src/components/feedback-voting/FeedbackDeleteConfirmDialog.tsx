// src/components/feedback-voting/FeedbackDeleteConfirmDialog.tsx

import React from 'react';

import { useTranslation } from 'react-i18next';

import { AlertDialog } from '@/components/dialogs';
import { useToast } from '@/hooks/use-toast';
import { useFeedbackStore } from '@/stores/feedbackStore';
import type { FeedbackItem } from '@/types/feedback';

interface FeedbackDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedback: FeedbackItem;
}

export const FeedbackDeleteConfirmDialog: React.FC<FeedbackDeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  feedback,
}) => {
  const { t } = useTranslation('feedback');
  const { deleteFeedback, isDeleting } = useFeedbackStore();
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      await deleteFeedback(feedback.id);
      toast({
        title: t('delete.success.title'),
        description: t('delete.success.message'),
      });
      onOpenChange(false);
    } catch {
      toast({
        title: t('delete.error.title'),
        description: t('delete.error.message'),
        variant: 'destructive',
      });
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('delete.title')}
      description={t('delete.description', { title: feedback.title })}
      variant="warning"
      dismissible={!isDeleting}
      actions={[
        {
          label: t('delete.cancel'),
          onClick: () => onOpenChange(false),
          variant: 'outline',
        },
        {
          label: isDeleting ? t('delete.deleting') : t('delete.confirm'),
          onClick: handleDelete,
          variant: 'destructive',
        },
      ]}
    />
  );
};
