import type { LexgenProposalDetailResponse } from '@/services/adminAPI';

/**
 * RED-phase stub for LEXGEN-12-03.
 *
 * Renders nothing but the test anchor so the test file collects + imports
 * cleanly while its assertions fail. The executor fleshes this out in Stage 3
 * (per-field value/provenance/flagged rows for BOTH `fields` and `content`,
 * i18n labels, read-only note, NO numeric score rendered anywhere).
 */
export function LexgenProposalDetail({
  proposal: _proposal,
}: {
  proposal: LexgenProposalDetailResponse;
}) {
  return <div data-testid="lexgen-proposal-detail" />;
}
