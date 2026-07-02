// src/components/dashboard/HeroEntries.tsx
// Hero "3-up entry cards" for the Dashboard (DASH2-01-03).
// Replaces the TRANSITIONAL Start-Review button from subtask 02.

import React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { Bookmark, Flame, Layers, Trophy } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

import { UnwiredDot } from '@/features/decks/dx';
import { getDateLocale } from '@/lib/dateUtils';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import type { Deck } from '@/types/deck';

import { decksWithDue, pickResumeDeck } from './lib/heroEntries';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HeroEntriesProps {
  decks: Deck[];
  /** Total cards due today (from analytics.today.cardsDue) */
  cardsDue: number;
  /** Number of decks that have due cards */
  deckCount: number;
  /** Minutes studied today (real data) */
  minutesToday: number;
  /** Current streak in days (real data) */
  streak: number;
  /** Called with deckId when the Resume CTA is clicked */
  onResumeDeck: (deckId: string) => void;
  /** Called when Start Review CTA is clicked */
  onStartReview: () => void;
  /** Called when Browse Decks CTA is clicked */
  onBrowseDecks: () => void;
}

// ─── DailyRing ───────────────────────────────────────────────────────────────

interface DailyRingProps {
  minutesToday: number;
  streak: number;
}

function DailyRing({ minutesToday, streak }: DailyRingProps) {
  const { t } = useTranslation('common');
  const r = 34;

  return (
    <div className="db-ring">
      <svg className="db-ring-svg" viewBox="0 0 84 84" aria-hidden="true">
        <defs>
          <linearGradient id="dbringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
        {/* Track only — fill arc omitted (daily goal is D-MIN unwired) */}
        <circle className="db-ring-track" cx="42" cy="42" r={r} />
      </svg>
      <div className="db-ring-center">
        {/* Real minutes + unwired goal denominator (/—) */}
        <b>
          {minutesToday}
          <UnwiredDot tone="danger" aria-label={t('dashboard.hero.dailyGoal.goalUnwiredAria')}>
            <small
              style={{ fontSize: 13, color: 'hsl(var(--fg-3))', fontWeight: 500, marginLeft: 2 }}
            >
              /—
            </small>
          </UnwiredDot>
        </b>
        <span>{t('dashboard.hero.dailyGoal.minLabel')}</span>
      </div>
      {/* Streak lives here — not duplicated in foot-stat */}
      <div className="db-ring-side">
        <b>{streak}</b>{' '}
        <Flame
          size={13}
          style={{ display: 'inline', verticalAlign: 'middle', color: 'hsl(var(--warning))' }}
          aria-hidden="true"
        />{' '}
        {t('dashboard.hero.dailyGoal.streakLabel')}
      </div>
    </div>
  );
}

// ─── HeroEntries ─────────────────────────────────────────────────────────────

export function HeroEntries({
  decks,
  cardsDue,
  deckCount,
  minutesToday,
  streak,
  onResumeDeck,
  onStartReview,
  onBrowseDecks,
}: HeroEntriesProps) {
  const { t, i18n } = useTranslation('common');

  const resumeDeck = pickResumeDeck(decks);
  const dueDeckList = decksWithDue(decks);
  const hasResumeDeck = resumeDeck != null;
  const hasDue = cardsDue > 0;

  // Build human-readable "when" string from lastStudied date
  const whenStr = React.useMemo(() => {
    if (!resumeDeck?.progress?.lastStudied) return '';
    try {
      return formatDistanceToNow(new Date(resumeDeck.progress.lastStudied), {
        addSuffix: true,
        locale: getDateLocale(i18n.language),
      });
    } catch {
      return '';
    }
  }, [resumeDeck, i18n.language]);

  // Localized list of deck names for review card
  const deckNamesStr = React.useMemo(() => {
    if (dueDeckList.length === 0) return '';
    const names = dueDeckList.map((d) => getLocalizedDeckName(d, i18n.language));
    try {
      return new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(names);
    } catch {
      return names.join(', ');
    }
  }, [dueDeckList, i18n.language]);

  // Completion percentage for the resume deck's progress bar — server-computed
  // (DashboardDeckSlice.completion_pct, PERF-15), no client recomputation.
  const completionPct = resumeDeck?.progress?.completionPct ?? 0;

  return (
    <section className="db-hero" data-testid="hero-entries">
      {/* ── Card 1: Continue ──────────────────────────────────────────────── */}
      <article className="db-entry" data-tone="primary">
        <div className="db-entry-head">
          <span className="db-entry-kicker">{t('dashboard.hero.continue.kicker')}</span>
          <span className="db-entry-icon" aria-hidden="true">
            <Bookmark size={18} />
          </span>
        </div>

        {hasResumeDeck ? (
          <>
            <div>
              <h2 className="db-entry-h">{getLocalizedDeckName(resumeDeck, i18n.language)}</h2>
              {resumeDeck.titleGreek && (
                <p className="db-entry-h-el" lang="el">
                  {resumeDeck.titleGreek}
                </p>
              )}
            </div>

            {/* Progress bar */}
            <div className="db-entry-progress" aria-hidden="true">
              <span style={{ width: `${completionPct}%` }} />
            </div>

            <div className="db-entry-body">
              <Trans
                i18nKey="dashboard.hero.continue.body"
                ns="common"
                values={{ when: whenStr }}
                components={{
                  pos: (
                    <UnwiredDot
                      tone="danger"
                      aria-label={t('dashboard.hero.continue.cardIndexUnwiredAria')}
                    />
                  ),
                  b: <b />,
                }}
              />
            </div>

            <div className="db-entry-foot">
              <div className="db-entry-stat">
                <b>{resumeDeck.progress?.dueToday ?? 0}</b>
                <span>{t('dashboard.hero.continue.dueNow')}</span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onResumeDeck(resumeDeck.id)}
              >
                {t('dashboard.hero.continue.cta')}
              </button>
            </div>
          </>
        ) : (
          /* Empty state */
          <>
            <div>
              <h2 className="db-entry-h">{t('dashboard.hero.continue.emptyTitle')}</h2>
            </div>
            <div className="db-entry-body">{t('dashboard.hero.continue.emptyBody')}</div>
            <div className="db-entry-foot">
              <button className="btn btn-glass btn-sm" onClick={onBrowseDecks}>
                {t('dashboard.hero.review.ctaNothing')}
              </button>
            </div>
          </>
        )}
      </article>

      {/* ── Card 2: Today's review ────────────────────────────────────────── */}
      <article className="db-entry" data-tone="violet">
        <div className="db-entry-head">
          <span className="db-entry-kicker">{t('dashboard.hero.review.kicker')}</span>
          <span className="db-entry-icon" aria-hidden="true">
            <Layers size={18} />
          </span>
        </div>

        {hasDue ? (
          <>
            <div>
              <h2 className="db-entry-h">
                {t('dashboard.hero.review.title', { count: cardsDue, decks: deckCount })}
              </h2>
            </div>
            <div className="db-entry-body">
              {deckNamesStr && <b style={{ color: 'hsl(var(--fg))' }}>{deckNamesStr}</b>}
              {deckNamesStr && '. '}
              <Trans
                i18nKey="dashboard.hero.review.body"
                ns="common"
                components={{
                  est: (
                    <UnwiredDot
                      tone="danger"
                      aria-label={t('dashboard.hero.review.estimateUnwiredAria')}
                    />
                  ),
                }}
              />
            </div>
            <div className="db-entry-foot">
              <button className="btn btn-glass btn-sm" onClick={onStartReview}>
                {t('dashboard.hero.review.cta')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="db-entry-h">{t('dashboard.hero.review.titleNothing')}</h2>
            </div>
            <div className="db-entry-body">{t('dashboard.hero.review.bodyNothing')}</div>
            <div className="db-entry-foot">
              <button className="btn btn-glass btn-sm" onClick={onBrowseDecks}>
                {t('dashboard.hero.review.ctaNothing')}
              </button>
            </div>
          </>
        )}
      </article>

      {/* ── Card 3: Daily goal ────────────────────────────────────────────── */}
      <article className="db-entry" data-tone="amber">
        <div className="db-entry-head">
          <span className="db-entry-kicker">{t('dashboard.hero.dailyGoal.kicker')}</span>
          <span className="db-entry-icon" aria-hidden="true">
            <Trophy size={18} />
          </span>
        </div>

        <div>
          {/* Title: "{Y} min today" — goal denominator lives in ring center (D-MIN) */}
          <h2 className="db-entry-h">
            {minutesToday} {t('dashboard.hero.dailyGoal.minLabel')}
          </h2>
        </div>

        <div className="db-entry-body">
          <DailyRing minutesToday={minutesToday} streak={streak} />
        </div>

        {/* No CTA — goal-setting feature not available */}
      </article>
    </section>
  );
}
