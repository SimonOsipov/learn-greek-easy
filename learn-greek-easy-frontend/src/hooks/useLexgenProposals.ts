// src/hooks/useLexgenProposals.ts
//
// Fetches and mutates the LEXGEN verification-inbox queue (needs_review proposals).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { toast } from '@/hooks/use-toast';
import {
  adminAPI,
  type LexgenApproveResponse,
  type LexgenProposalDetailResponse,
  type LexgenProposalListParams,
  type LexgenProposalListResponse,
} from '@/services/adminAPI';

const STALE_TIME_MS = 30 * 1000;
const DETAIL_STALE_TIME_MS = 60 * 1000;

/**
 * Fetches a page of `needs_review` LEXGEN proposals for the verification inbox.
 *
 * The list is score-free (anti-anchoring invariant) and ordered server-side
 * (most-flagged first, then FIFO). `status` is pinned to `needs_review` inside
 * the API client, so callers only choose the page.
 */
export function useLexgenProposals(params: LexgenProposalListParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.page_size;

  return useQuery<LexgenProposalListResponse>({
    queryKey: ['lexgen-proposals', page, pageSize],
    queryFn: () => adminAPI.listLexgenProposals({ page, page_size: pageSize }),
    staleTime: STALE_TIME_MS,
  });
}

/**
 * Fetches a single `needs_review` proposal detail for the inbox detail panel.
 *
 * Disabled until an `id` is selected. The detail is score-free (anti-anchoring)
 * and read-only — flagged state is the per-field `flagged` boolean only.
 */
export function useLexgenProposal(id: string | null) {
  return useQuery<LexgenProposalDetailResponse>({
    queryKey: ['lexgen-proposal', id],
    queryFn: () => adminAPI.getLexgenProposal(id as string),
    enabled: !!id,
    staleTime: DETAIL_STALE_TIME_MS,
  });
}

/**
 * Approve a needs_review proposal and ship it as a WordEntry.
 *
 * On success: invalidates both the queue list and the detail query, then toasts.
 * The caller is responsible for closing the sheet (proposal leaves the queue).
 */
export function useApproveProposal(proposalId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('admin');

  return useMutation<LexgenApproveResponse, Error, { deckId: string }>({
    mutationFn: ({ deckId }) => adminAPI.approveLexgenProposal(proposalId, deckId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lexgen-proposals'] });
      void queryClient.invalidateQueries({ queryKey: ['lexgen-proposal', proposalId] });
      toast({ title: t('lexgenInbox.action.shipped') });
    },
    onError: () => {
      toast({
        title: t('lexgenInbox.action.approve'),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Apply a single flat field edit to a needs_review proposal (re-scores via judge).
 *
 * On success: invalidates the detail query so the sheet re-renders in place.
 * The proposal stays `needs_review` — it does NOT disappear from the queue
 * (D-RESCORE-INPLACE decision record).
 */
export function useEditProposalField(proposalId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('admin');

  return useMutation<
    LexgenProposalDetailResponse,
    Error,
    { fieldKey: string; value: string | null }
  >({
    mutationFn: ({ fieldKey, value }) =>
      adminAPI.editLexgenProposal(proposalId, { [fieldKey]: value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lexgen-proposal', proposalId] });
      toast({ title: t('lexgenInbox.action.saved') });
    },
    onError: () => {
      toast({
        title: t('lexgenInbox.action.edit'),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Regenerate a needs_review proposal (re-runs the full pipeline).
 *
 * On success: invalidates both the queue list and the detail query so the sheet
 * re-renders in place with the fresh result.
 */
export function useRegenerateProposal(proposalId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('admin');

  return useMutation<LexgenProposalDetailResponse, Error, void>({
    mutationFn: () => adminAPI.regenerateLexgenProposal(proposalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lexgen-proposals'] });
      void queryClient.invalidateQueries({ queryKey: ['lexgen-proposal', proposalId] });
      toast({ title: t('lexgenInbox.action.regenerated') });
    },
    onError: () => {
      toast({
        title: t('lexgenInbox.action.regenerate'),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Reject a needs_review proposal.
 *
 * On success: invalidates both the queue list and the detail query.
 * The caller is responsible for closing the sheet.
 */
export function useRejectProposal(proposalId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('admin');

  return useMutation<void, Error, { reason: string }>({
    mutationFn: ({ reason }) => adminAPI.rejectLexgenProposal(proposalId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lexgen-proposals'] });
      void queryClient.invalidateQueries({ queryKey: ['lexgen-proposal', proposalId] });
      toast({ title: t('lexgenInbox.action.rejected') });
    },
    onError: () => {
      toast({
        title: t('lexgenInbox.action.reject'),
        variant: 'destructive',
      });
    },
  });
}
