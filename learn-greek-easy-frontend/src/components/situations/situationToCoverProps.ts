/**
 * SIT-27-01: situationToCoverProps adapter
 *
 * Maps a Situation's image fields + domain to the deck-typed Pick<Deck, ...>
 * that CultureHero (coverDeck/siblingDecks), DxCover, and the deckGradient
 * function require.
 *
 * CRITICAL: DeckLevel and DeckCategory are imported from '@/types/deck' (A1–B2,
 * vocabulary|grammar|phrases|culture) — NOT from '@/types/situation' which
 * incorrectly includes C1/C2 and would produce undefined gradient stops in
 * deckGradient's LEVEL_SHIFT / CATEGORY_HUE maps.
 *
 * The 'domain' field does not exist until SIT-27-02 adds it to the API payload.
 * This adapter tolerates domain being absent/null and falls back to a stable
 * B1/culture gradient so the cover always renders a valid gradient stop.
 */

import type { DeckCategory, DeckLevel } from '@/types/deck';

/** The minimal Situation shape the adapter needs. domain is optional
 *  because SIT-27-02 (not yet shipped) adds it to the API payload. */
export interface SituationCoverInput {
  id: string;
  domain?: string | null;
  source_image_url?: string | null;
  source_image_variants?: Record<number, string> | null;
}

/** Output matches the deck-typed Pick that CultureHero + DxCover accept. */
export type SituationCoverProps = Pick<
  {
    id: string;
    level: DeckLevel;
    category: DeckCategory;
    coverImageUrl?: string;
    coverImageVariants?: Record<number, string>;
  },
  'id' | 'level' | 'category' | 'coverImageUrl' | 'coverImageVariants'
>;

/**
 * Deterministic domain → {level, category} mapping.
 *
 * Values defined here are the expected domain labels from SIT-27-02 backfill.
 * Any unknown/missing domain falls back to {B1, culture} which is the canonical
 * "everyday Greek culture" gradient and always renders a valid gradient stop.
 */
const DOMAIN_GRADIENT: Record<string, { level: DeckLevel; category: DeckCategory }> = {
  news: { level: 'B1', category: 'culture' },
  everyday: { level: 'A2', category: 'phrases' },
  travel: { level: 'A2', category: 'vocabulary' },
  business: { level: 'B2', category: 'vocabulary' },
  culture: { level: 'B1', category: 'culture' },
};

const FALLBACK: { level: DeckLevel; category: DeckCategory } = {
  level: 'B1',
  category: 'culture',
};

/**
 * Convert a Situation to the deck-typed cover props required by CultureHero
 * and DxCover. Safe to call on list items (where source_image_variants is
 * undefined until SIT-27-02) and on detail responses (where it is present).
 */
export function situationToCoverProps(s: SituationCoverInput): SituationCoverProps {
  const gradient: { level: DeckLevel; category: DeckCategory } =
    (s.domain != null ? DOMAIN_GRADIENT[s.domain] : undefined) ?? FALLBACK;

  return {
    id: s.id,
    level: gradient.level,
    category: gradient.category,
    // null → undefined: the deck types use optional (undefined) not null
    coverImageUrl: s.source_image_url ?? undefined,
    // Only present on detail responses; tolerate undefined on list items
    coverImageVariants: s.source_image_variants ?? undefined,
  };
}
