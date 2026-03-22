export type SituationStatus = 'draft' | 'partial_ready' | 'ready';

export const SITUATION_STATUS_BADGE_CLASSES: Record<SituationStatus, string> = {
  draft: 'border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400',
  partial_ready: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  ready: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
};
