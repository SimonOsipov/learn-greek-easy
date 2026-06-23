// src/components/situations/SituationsHero.tsx
//
// SIT-27-05: Thin Situations wrapper around the generic CultureHero.
//
// Resume hero for the /situations hub. Reuses CultureHero unchanged, feeding its
// deck-typed cover-stack props (coverDeck / siblingDecks) through the
// situationToCoverProps() adapter from SIT-27-01 — the hero is NOT forked and its
// prop types are NOT widened.

import React from 'react';

import {
  CultureHero,
  type CultureHeroCta,
  type CultureHeroStat,
} from '@/components/culture/redesign/CultureHero';
import { useLanguage } from '@/hooks/useLanguage';
import type { LearnerSituationListItem } from '@/types/situation';

import { situationToCoverProps } from './situationToCoverProps';

export interface SituationsHeroProps {
  /** The situation to resume / start. */
  situation: LearnerSituationListItem;
  /** Up to 2 sibling situations for the cover stack (rotated/dimmed behind the front cover). */
  siblings?: LearnerSituationListItem[];
  kicker: string;
  stats: CultureHeroStat[];
  ctas: CultureHeroCta[];
  /** Progress % shown on the cover foot. */
  coverFootPct?: number;
}

export const SituationsHero: React.FC<SituationsHeroProps> = ({
  situation,
  siblings = [],
  kicker,
  stats,
  ctas,
  coverFootPct,
}) => {
  const { currentLanguage } = useLanguage();

  // Hub hero shows the localized scenario as the title and the Greek scenario as
  // the Noto-Serif subtitle. When the localized scenario is missing fall back to
  // the Greek so the title is never empty.
  const localizedScenario =
    currentLanguage === 'ru' ? situation.scenario_ru : situation.scenario_en;
  const title = localizedScenario || situation.scenario_el;
  const greekSubtitle =
    situation.scenario_el && situation.scenario_el !== title ? situation.scenario_el : undefined;

  const siblingDecks = siblings.map((s) => ({
    ...situationToCoverProps(s),
    title: s.scenario_el,
  }));

  return (
    <CultureHero
      kicker={kicker}
      kickerTone="primary"
      title={title}
      greekSubtitle={greekSubtitle}
      stats={stats}
      ctas={ctas}
      coverDeck={situationToCoverProps(situation)}
      siblingDecks={siblingDecks}
      coverFootPct={coverFootPct}
    />
  );
};
