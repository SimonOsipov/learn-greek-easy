/**
 * Types for the XP / level endpoints.
 * Field names match backend JSON (snake_case) exactly.
 *
 * Source endpoint:
 *   GET /api/v1/xp/stats  → XPStatsResponse
 */

export interface XPStatsResponse {
  /** Total XP earned by the user. */
  total_xp: number;
  /** Current level (1-15). */
  current_level: number;
  /** Level name in Greek. */
  level_name_greek: string;
  /** Level name in English. */
  level_name_english: string;
  /** XP progress within current level. */
  xp_in_level: number;
  /** Total XP needed for next level. */
  xp_for_next_level: number;
  /** Progress to next level as percentage (0–100). */
  progress_percentage: number;
}
