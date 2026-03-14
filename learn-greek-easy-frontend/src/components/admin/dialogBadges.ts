import type { DialogStatus } from '@/services/adminAPI';

export const CEFR_BADGE_CLASSES: Record<string, string> = {
  A1: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  A2: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  B1: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400',
  B2: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
};

export const CEFR_BADGE_FALLBACK =
  'border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400';

export const STATUS_BADGE_CLASSES: Record<DialogStatus, string> = {
  draft: 'border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400',
  audio_ready: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  exercises_ready: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
};

export function formatAudioDuration(seconds: number): string {
  const safe = Math.max(0, seconds || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
