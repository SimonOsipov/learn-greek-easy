import { VocabularyCardEditModal } from '@/components/admin/vocabulary';

export interface UserVocabularyCardEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  deckId: string;
  deckLevel?: string;
  onSuccess?: () => void;
}

/**
 * User-facing wrapper for vocabulary card editing.
 * Delegates to the admin VocabularyCardEditModal component.
 * Backend allows deck owners to edit cards (USRCARD-02).
 */
export function UserVocabularyCardEditModal({
  open,
  onOpenChange,
  cardId,
  deckId,
  deckLevel,
  onSuccess,
}: UserVocabularyCardEditModalProps) {
  return (
    <VocabularyCardEditModal
      open={open}
      onOpenChange={onOpenChange}
      cardId={cardId}
      deckId={deckId}
      deckLevel={deckLevel}
      onSuccess={onSuccess}
    />
  );
}
