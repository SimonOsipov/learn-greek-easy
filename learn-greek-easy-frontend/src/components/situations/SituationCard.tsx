// src/components/situations/SituationCard.tsx
//
// SIT-27-05: Rich situation card for the redesigned hub.
//
// Mirrors the .dx-deck-card recipe used by DeckCard (gradient/photo DxCover
// background + kicker + frosted status badge + meta line + progress bar), fed
// via the situationToCoverProps() adapter so the deck-typed DxCover renders a
// valid gradient/cover for a Situation.
//
// A Situation is NOT a Deck, so this is a net-new card rather than a reuse of
// DeckCard — but it reuses the same CSS recipe and DxCover primitive (no forked
// styles, no widened deck prop types).

import React from 'react';

import { BookOpen, Check, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { DxCover, Kicker } from '@/features/decks/dx';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { LearnerSituationListItem } from '@/types/situation';

import { situationToCoverProps } from './situationToCoverProps';

export interface SituationCardProps {
  item: LearnerSituationListItem;
  /** Localized scenario subtitle (en or ru depending on UI language). */
  scenario: string;
  /** Zero-based grid index — first card gets the is-active accent + drives analytics position. */
  index: number;
}

/** Completion % from exercise counts (0 when no exercises). */
function completionPct(item: LearnerSituationListItem): number {
  if (item.exercise_total <= 0) return 0;
  return Math.round((item.exercise_completed / item.exercise_total) * 100);
}

export const SituationCard: React.FC<SituationCardProps> = ({ item, scenario, index }) => {
  const { t } = useTranslation('common');

  const pct = completionPct(item);
  const complete = item.exercise_total > 0 && item.exercise_completed === item.exercise_total;

  // Status badge: Complete / {pct}% / Start
  const badge = complete
    ? t('situations.card.statusComplete', 'Complete')
    : pct > 0
      ? `${pct}%`
      : t('situations.card.statusStart', 'Start');

  // domain · level kicker. domain is the human-facing label from SIT-27-02;
  // when absent fall back to a neutral "Situation" label.
  const cover = situationToCoverProps(item);
  const kickerLabel = item.domain
    ? `${item.domain} · ${cover.level}`
    : t('situations.card.kickerFallback', 'Situation · {{level}}', { level: cover.level });

  return (
    <Link
      to={`/situations/${item.id}`}
      className="block"
      data-testid="situation-item"
      onClick={() =>
        track('situation_card_clicked', {
          situation_id: item.id,
          has_audio: item.has_audio,
          exercise_completed: item.exercise_completed,
          exercise_total: item.exercise_total,
          position: index,
        })
      }
    >
      <article className={cn('dx-deck-card group', index === 0 && 'is-active')}>
        <DxCover deck={cover} variant="card">
          <div className="dx-deck-card-inner">
            {/* Top row: domain·level kicker + status badge */}
            <div className="dx-deck-card-head">
              <Kicker tone="white">{kickerLabel}</Kicker>
              <span className={cn('dx-deck-card-badge', complete && 'is-primary')}>{badge}</span>
            </div>

            {/* Middle: Greek scenario title + localized subtitle */}
            <div>
              <h3 className="dx-deck-card-h" lang="el">
                {item.scenario_el}
              </h3>
              {scenario && scenario !== item.scenario_el && (
                <p className="dx-deck-card-el">{scenario}</p>
              )}
            </div>

            {/* Bottom: meta (exercises + audio) + progress / complete */}
            <div className="dx-deck-card-bottom">
              <div className="dx-deck-card-meta">
                <span className="inline-flex items-center gap-1" data-testid="exercise-badge">
                  <BookOpen className="h-3 w-3" aria-hidden="true" />
                  {t('situations.card.exercises', {
                    completed: item.exercise_completed,
                    total: item.exercise_total,
                  })}
                </span>
                {item.has_audio && (
                  <>
                    <span className="dx-dot" aria-hidden="true" />
                    <span className="inline-flex items-center gap-1">
                      <Volume2 className="h-3 w-3" aria-hidden="true" />
                      {t('situations.card.audio')}
                    </span>
                  </>
                )}
              </div>

              {complete ? (
                <span className="dx-deck-card-complete">
                  <Check aria-hidden="true" />
                  {t('situations.card.statusComplete', 'Complete')}
                </span>
              ) : pct > 0 ? (
                <div className="dx-deck-card-progress">
                  <span className="dx-deck-card-progress-bar">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="dx-deck-card-progress-pct">{pct}%</span>
                </div>
              ) : null}
            </div>
          </div>
        </DxCover>
      </article>
    </Link>
  );
};
