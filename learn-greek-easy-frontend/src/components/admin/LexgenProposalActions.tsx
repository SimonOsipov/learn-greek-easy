// src/components/admin/LexgenProposalActions.tsx
//
// Action bar for the LEXGEN verification inbox detail sheet (LEXGEN-13-04).
// Provides Approve / Regenerate / Reject buttons + AlertDialog confirms.
// Approve includes a vocabulary-deck selector. Edit is per-field (see FieldRow).

import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useApproveProposal,
  useRegenerateProposal,
  useRejectProposal,
} from '@/hooks/useLexgenProposals';
import { adminAPI } from '@/services/adminAPI';

interface LexgenProposalActionsProps {
  proposalId: string;
  /** Called after a successful approve or reject (sheet should close). */
  onShipOrReject: () => void;
}

/**
 * Action bar rendered below `LexgenProposalDetail` inside the inbox Sheet.
 *
 * Approve and Reject trigger AlertDialog confirms; Approve additionally shows a
 * deck selector. Regenerate shows a simple confirm. All buttons are disabled
 * while any mutation is pending. Edit is per-field inline (FieldRow in Detail).
 *
 * Anti-anchoring: no numeric score is rendered anywhere in this component.
 */
export function LexgenProposalActions({ proposalId, onShipOrReject }: LexgenProposalActionsProps) {
  const { t } = useTranslation('admin');

  const [approveOpen, setApproveOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const approveMutation = useApproveProposal(proposalId);
  const regenerateMutation = useRegenerateProposal(proposalId);
  const rejectMutation = useRejectProposal(proposalId);

  const isAnyPending =
    approveMutation.isPending || regenerateMutation.isPending || rejectMutation.isPending;

  // Eager-load vocabulary decks so the Select is ready when the dialog opens.
  // page_size: 200 is a practical cap — the production vocabulary deck count is
  // well under this limit. If it ever exceeds 200, add a search input here.
  const { data: deckData } = useQuery({
    queryKey: ['admin', 'decks', 'vocabulary'],
    queryFn: () => adminAPI.listDecks({ type: 'vocabulary', page_size: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const vocabularyDecks = deckData?.decks ?? [];

  const handleApproveConfirm = () => {
    if (!selectedDeckId) return;
    approveMutation.mutate(
      { deckId: selectedDeckId },
      {
        onSuccess: () => {
          setApproveOpen(false);
          setSelectedDeckId('');
          onShipOrReject();
        },
      }
    );
  };

  const handleRegenerateConfirm = () => {
    regenerateMutation.mutate(undefined, {
      onSuccess: () => {
        setRegenerateOpen(false);
      },
    });
  };

  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) return;
    rejectMutation.mutate(
      { reason: rejectReason.trim() },
      {
        onSuccess: () => {
          setRejectOpen(false);
          setRejectReason('');
          onShipOrReject();
        },
      }
    );
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {/* Approve */}
        <Button
          size="sm"
          variant="default"
          disabled={isAnyPending}
          onClick={() => setApproveOpen(true)}
          data-testid="lexgen-action-approve"
        >
          {t('lexgenInbox.action.approve')}
        </Button>

        {/* Regenerate */}
        <Button
          size="sm"
          variant="outline"
          disabled={isAnyPending}
          onClick={() => setRegenerateOpen(true)}
          data-testid="lexgen-action-regenerate"
        >
          {t('lexgenInbox.action.regenerate')}
        </Button>

        {/* Reject */}
        <Button
          size="sm"
          variant="outline"
          disabled={isAnyPending}
          onClick={() => setRejectOpen(true)}
          data-testid="lexgen-action-reject"
        >
          {t('lexgenInbox.action.reject')}
        </Button>
      </div>

      {/* ── Approve confirm ─────────────────────────────────────── */}
      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('lexgenInbox.action.approve')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('lexgenInbox.action.approveConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
              <SelectTrigger data-testid="lexgen-approve-deck-select">
                <SelectValue placeholder={t('lexgenInbox.action.approve')} />
              </SelectTrigger>
              <SelectContent>
                {vocabularyDecks.map((deck) => (
                  <SelectItem key={deck.id} value={deck.id}>
                    {typeof deck.name === 'string' ? deck.name : (deck.name_en ?? deck.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedDeckId('')}>
              {t('lexgenInbox.action.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveConfirm}
              disabled={!selectedDeckId || approveMutation.isPending}
              data-testid="lexgen-approve-confirm"
            >
              {t('lexgenInbox.action.approve')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Regenerate confirm ──────────────────────────────────── */}
      <AlertDialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('lexgenInbox.action.regenerate')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('lexgenInbox.action.regenerateConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('lexgenInbox.action.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerateConfirm}
              disabled={regenerateMutation.isPending}
              data-testid="lexgen-regenerate-confirm"
            >
              {t('lexgenInbox.action.regenerate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reject confirm ──────────────────────────────────────── */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('lexgenInbox.action.reject')}</AlertDialogTitle>
            <AlertDialogDescription>{t('lexgenInbox.action.rejectConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('lexgenInbox.action.reject')}
              rows={3}
              data-testid="lexgen-reject-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason('')}>
              {t('lexgenInbox.action.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              data-testid="lexgen-reject-confirm"
            >
              {t('lexgenInbox.action.reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
