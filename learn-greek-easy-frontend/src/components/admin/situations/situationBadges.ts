export type SituationStatus = 'draft' | 'ready';

export const SITUATION_STATUS_BADGE_CLASSES: Record<SituationStatus, string> = {
  draft: 'badge b-gray',
  ready: 'badge b-green',
};
