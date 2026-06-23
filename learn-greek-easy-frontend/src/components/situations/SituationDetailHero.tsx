// src/components/situations/SituationDetailHero.tsx
//
// SIT-27-06: Thin Situations DETAIL wrapper around the generic CultureHero.
//
// Resume/summary hero for the /situations/:id detail page. Mirrors the hub
// SituationsHero (SIT-27-05) but feeds the detail response (which carries the
// localized scenario, Greek subtitle, domain, source image + variants) through
// the same situationToCoverProps() adapter from SIT-27-01. CultureHero is reused
// unchanged — not forked, prop types not widened.

import React from 'react';

import {
  CultureHero,
  type CultureHeroCta,
  type CultureHeroStat,
} from '@/components/culture/redesign/CultureHero';
import { useLanguage } from '@/hooks/useLanguage';
import type { LearnerSituationDetailResponse } from '@/types/situation';

import { situationToCoverProps } from './situationToCoverProps';

export interface SituationDetailHeroProps {
  situation: LearnerSituationDetailResponse;
  /** Eyebrow kicker (domain · level · source). */
  kicker: string;
  /** Up to 3 stats in the hero stat row. */
  stats: CultureHeroStat[];
  /** Hero CTAs (e.g. back link / practice). */
  ctas?: CultureHeroCta[];
}

export const SituationDetailHero: React.FC<SituationDetailHeroProps> = ({
  situation,
  kicker,
  stats,
  ctas = [],
}) => {
  const { currentLanguage } = useLanguage();

  // Title is the localized scenario; the Greek scenario becomes the Noto-Serif
  // subtitle. Fall back to Greek so the title is never empty.
  const localizedScenario =
    currentLanguage === 'ru' ? situation.scenario_ru : situation.scenario_en;
  const title = localizedScenario || situation.scenario_el;
  const greekSubtitle =
    situation.scenario_el && situation.scenario_el !== title ? situation.scenario_el : undefined;

  return (
    <CultureHero
      kicker={kicker}
      kickerTone="primary"
      title={title}
      greekSubtitle={greekSubtitle}
      stats={stats}
      ctas={ctas}
      coverDeck={situationToCoverProps(situation)}
    />
  );
};
