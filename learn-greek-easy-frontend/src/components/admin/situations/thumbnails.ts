// src/components/admin/situations/thumbnails.ts
// Shared tone logic + duration formatter for situation thumbnails.

// --- Tone type + picker ---

export type SitTone = 'blue' | 'amber' | 'violet' | 'cyan' | 'green' | 'red';

const SIT_TONES: SitTone[] = ['blue', 'amber', 'violet', 'cyan', 'green', 'red'];

/**
 * Deterministic tone: sum charCodes of id → mod 6 → palette key.
 * Relocated from SituationCard.tsx so thumbnails.ts is the single source.
 */
export function pickSitTone(id: string): SitTone {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return SIT_TONES[sum % SIT_TONES.length];
}

// --- Duration formatter ---

/**
 * Format seconds to m:ss (e.g. 125 → "2:05").
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
