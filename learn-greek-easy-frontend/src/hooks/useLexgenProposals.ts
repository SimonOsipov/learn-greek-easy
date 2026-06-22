// src/hooks/useLexgenProposals.ts
//
// Fetches the read-only LEXGEN verification-inbox queue (needs_review proposals).

import { useQuery } from '@tanstack/react-query';

import {
  adminAPI,
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
