export type SituationStatus = 'draft' | 'partial_ready' | 'ready';

export const SITUATION_STATUS_BADGE_CLASSES: Record<SituationStatus, string> = {
  draft: 'badge b-gray',
  partial_ready: 'badge b-amber',
  ready: 'badge b-green',
};
