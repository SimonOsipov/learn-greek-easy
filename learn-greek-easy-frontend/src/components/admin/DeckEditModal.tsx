// src/components/admin/DeckEditModal.tsx

import React from 'react';

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UnifiedDeckItem } from '@/services/adminAPI';

import { CultureDeckEditForm, type CultureDeckFormData } from './CultureDeckEditForm';
import { VocabularyDeckEditForm, type VocabularyDeckFormData } from './VocabularyDeckEditForm';

export type DeckEditFormData = VocabularyDeckFormData | CultureDeckFormData;

interface DeckEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: UnifiedDeckItem | null;
  onSave: (data: DeckEditFormData) => void;
  isLoading?: boolean;
}

/**
 * Modal dialog for editing deck metadata
 *
 * Displays a type badge and renders the appropriate form based on deck type:
 * - VocabularyDeckEditForm for vocabulary decks
 * - CultureDeckEditForm for culture decks
 */
export const DeckEditModal: React.FC<DeckEditModalProps> = ({
  open,
  onOpenChange,
  deck,
  onSave,
  isLoading = false,
}) => {
  const { t } = useTranslation('admin');

  // Get deck name for display
  const getDeckDisplayName = () => {
    if (!deck) return '';
    return typeof deck.name === 'string' ? deck.name : deck.name.en;
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleSave = (data: DeckEditFormData) => {
    onSave(data);
  };

  // Don't render if no deck is selected
  if (!deck) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="deck-edit-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('deckEdit.title')}
            <Badge variant="outline" className="text-xs">
              {t(`deckTypes.${deck.type}`)}
            </Badge>
          </DialogTitle>
          <DialogDescription>{getDeckDisplayName()}</DialogDescription>
        </DialogHeader>

        {deck.type === 'vocabulary' ? (
          <VocabularyDeckEditForm
            deck={deck}
            onSave={handleSave}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        ) : (
          <CultureDeckEditForm
            deck={deck}
            onSave={handleSave}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
