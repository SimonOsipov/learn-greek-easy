// src/components/decks/UserDeckEditModal.tsx

import React, { useState } from 'react';

import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { CreateDeckInput, DeckLevel, DeckResponse } from '@/services/deckAPI';
import { deckAPI } from '@/services/deckAPI';

import { UserDeckForm } from './UserDeckForm';

export interface UserDeckEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  deck?: {
    id: string;
    name: string;
    description?: string | null;
    level: DeckLevel;
  };
  onSuccess?: (deck: DeckResponse) => void;
}

/**
 * Modal for creating and editing user vocabulary decks
 *
 * Features:
 * - Create mode: Empty form for new deck creation
 * - Edit mode: Pre-populated form with existing deck data
 * - Loading state during API calls
 * - Toast notifications for success/error
 * - Prevents closing while loading
 */
export const UserDeckEditModal: React.FC<UserDeckEditModalProps> = ({
  isOpen,
  onClose,
  mode,
  deck,
  onSuccess,
}) => {
  const { t } = useTranslation('deck');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const isCreateMode = mode === 'create';
  const title = isCreateMode ? t('modal.createTitle') : t('modal.editTitle');
  const description = isCreateMode ? t('modal.createDescription') : t('modal.editDescription');

  const handleSubmit = async (data: CreateDeckInput) => {
    setIsLoading(true);
    try {
      let result: DeckResponse;

      if (isCreateMode) {
        result = await deckAPI.createDeck(data);
        toast({
          title: t('modal.createSuccess'),
        });
      } else {
        if (!deck?.id) {
          throw new Error('Deck ID is required for edit mode');
        }
        result = await deckAPI.updateMyDeck(deck.id, data);
        toast({
          title: t('modal.editSuccess'),
        });
      }

      onSuccess?.(result);
      onClose();
    } catch (error) {
      toast({
        title: isCreateMode ? t('modal.createError') : t('modal.editError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    // Prevent closing while loading
    if (!open && isLoading) {
      return;
    }
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="user-deck-modal">
        <DialogHeader>
          <DialogTitle data-testid="user-deck-modal-title">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <UserDeckForm
          key={deck?.id ?? 'create'}
          mode={mode}
          deck={deck}
          onSubmit={handleSubmit}
          onCancel={onClose}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
};
