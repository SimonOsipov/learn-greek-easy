/**
 * Situations presentation helpers (MOB-08): scene gradient palette and
 * deterministic id → tone/monogram mapping. Pure functions — no React.
 *
 * Five scene tones per the MOB-08 handoff (practice.jsx → TONE map):
 *   amber | blue | cyan | green | violet
 * Stop values are full-colour rgb (MOB-13: no NativeWind /NN modifiers).
 */

// ---------------------------------------------------------------------------
// Scene gradient palette — five named tones, two stops each, 135deg
// ---------------------------------------------------------------------------

export type SceneTone = 'amber' | 'blue' | 'cyan' | 'green' | 'violet';

/**
 * Five scene-gradient stop pairs from the MOB-08 handoff (practice.jsx TONE map).
 * 135° linear gradients. hsl sources in comments.
 */
export const SITUATION_PALETTE: Record<SceneTone, readonly [string, string]> = {
  amber:  ['rgb(246,168,35)',  'rgb(153,82,22)'],   // hsl(38 92% 55%) → hsl(20 85% 34%)
  blue:   ['rgb(45,125,221)', 'rgb(33,57,131)'],    // hsl(212 80% 52%) → hsl(225 60% 32%)
  cyan:   ['rgb(26,178,199)', 'rgb(30,90,160)'],    // hsl(188 80% 44%) → hsl(212 70% 37%)
  green:  ['rgb(37,177,130)', 'rgb(20,110,90)'],    // hsl(160 65% 42%) → hsl(180 55% 25%)
  violet: ['rgb(164,82,224)', 'rgb(43,33,128)'],    // hsl(280 75% 60%) → hsl(248 59% 32%)
} as const;

export const SCENE_TONES: readonly SceneTone[] = ['amber', 'blue', 'cyan', 'green', 'violet'];

// ---------------------------------------------------------------------------
// djb2 hash — same algorithm as lib/decks/presentation.ts (stable across restarts)
// ---------------------------------------------------------------------------

function djb2(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministically maps a situation id to one of the five scene tones. */
export function sceneToneForId(id: string): SceneTone {
  return SCENE_TONES[djb2(id) % SCENE_TONES.length];
}

/** Returns the gradient stop pair for a situation id. */
export function gradientForSituationId(id: string): readonly [string, string] {
  return SITUATION_PALETTE[sceneToneForId(id)];
}

// ---------------------------------------------------------------------------
// Monogram — first 2 chars of the Greek scenario text, uppercased
// ---------------------------------------------------------------------------

/**
 * Derives a 1–2 char monogram from the Greek scenario title.
 * Falls back to '?' when the string is empty (shouldn't happen with real data).
 */
export function monogramForScenario(scenario_el: string): string {
  if (!scenario_el) return '?';
  // Take first word; if starts with article (Ο/Η/Το/Οι/Τα), skip it
  const words = scenario_el.trim().split(/\s+/);
  const articles = new Set(['ο', 'η', 'το', 'οι', 'τα', 'Ο', 'Η', 'Το', 'Οι', 'Τα']);
  const first = words[0] && !articles.has(words[0]) ? words[0] : (words[1] ?? words[0] ?? '');
  return (first.slice(0, 2) || '??').toUpperCase();
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

export type SituationFilter = 'All' | 'Ready' | 'In progress' | 'B1' | 'B2' | 'A2';
export const SITUATION_FILTERS: readonly SituationFilter[] = [
  'All',
  'Ready',
  'In progress',
  'B1',
  'B2',
  'A2',
];

/**
 * Derives a client-side status label from exercisesDone / exercisesTotal.
 * - done = 0                 → 'Ready'
 * - 0 < done < total         → 'In progress'
 * - done >= total && total>0 → 'Completed'
 */
export type ClientStatus = 'Ready' | 'In progress' | 'Completed';

export function clientStatusFor(exerciseCompleted: number, exerciseTotal: number): ClientStatus {
  if (exerciseTotal > 0 && exerciseCompleted >= exerciseTotal) return 'Completed';
  if (exerciseCompleted > 0) return 'In progress';
  return 'Ready';
}

/**
 * Derives a CEFR level string from exercise audio_level hint or defaults to 'B1'.
 * The situations list API does not include a level field — level is inferred
 * from the description's audio_level (only available in the detail response).
 * On the list screen we don't have that; level pills are driven by the filter
 * chosen, not by per-item data. This helper is used on the flow cover screen.
 */
export type CefrLevel = 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export function cefrForAudioLevel(audioLevel: string | undefined): CefrLevel {
  const valid: CefrLevel[] = ['A2', 'B1', 'B2', 'C1', 'C2'];
  if (audioLevel && (valid as string[]).includes(audioLevel)) return audioLevel as CefrLevel;
  return 'B1';
}

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

/** Formats seconds as "M:SS" (e.g. 90 → "1:30"). */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
