// src/features/decks/components/V2DeckPage/DxResumeHero.tsx
//
// DX-05 — Resume hero panel with a fanned sibling cover stack.
//
// Layout:
//   Left  (.dx-hero-resume-l): kicker, title, Greek subtitle, description, 3 stats
//   Right (.dx-cover-stack): 2 dimmed sibling covers + this deck's front cover
//                             Hidden when siblings.length < 2 or at ≤1100px.
//
// The cover stack is intentionally omitted on direct deep-links where rawDecks
// is empty (only selectDeck() ran). Never call fetchDecks() just for siblings.

import { useTranslation } from 'react-i18next';

import { getLocalizedDeckDescription, getLocalizedDeckName } from '@/lib/deckLocale';
import type { ProgressMetrics } from '@/services/progressAPI';
import { useDeckStore } from '@/stores/deckStore';
import type { Deck } from '@/types/deck';

import { DxCover, Kicker } from '../../dx';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

export interface DxResumeHeroProps {
  deck: Deck;
  progress: ProgressMetrics | undefined;
  siblings: Deck[];
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function DxResumeHero({ deck, progress, siblings }: DxResumeHeroProps) {
  const { t, i18n } = useTranslation('deck');

  const localizedName = getLocalizedDeckName(deck, i18n.language);
  // Greek subtitle: titleGreek field stores the Greek deck name
  const greekSubtitle = deck.titleGreek;
  const localizedDescription = getLocalizedDeckDescription(deck, i18n.language) ?? deck.description;

  // Stats derived from ProgressMetrics contract
  const totalCards = progress?.total_cards ?? deck.cardCount;
  const mastered = progress?.cards_mastered ?? 0;
  const pct = totalCards > 0 ? Math.round((mastered / totalCards) * 100) : 0;

  const showStack = siblings.length >= 2;

  return (
    <div className="dx-hero-resume">
      <div className="dx-hero-resume-grid">
        {/* ── Left column ─────────────────────────────────────────── */}
        <div className="dx-hero-resume-l">
          <Kicker tone="primary">{t('dx.vocabularyKicker', { level: deck.level })}</Kicker>

          <div>
            <h1 className="dx-hero-resume-h">{localizedName}</h1>
            {greekSubtitle && greekSubtitle !== localizedName && (
              <p className="dx-hero-resume-el" lang="el">
                {greekSubtitle}
              </p>
            )}
          </div>

          {localizedDescription && <p className="dx-hero-resume-desc">{localizedDescription}</p>}

          <div className="dx-hero-resume-stats">
            <div className="dx-hero-resume-stat">
              <b>{totalCards}</b>
              <span>{t('dx.resumeStatTotalCards')}</span>
            </div>
            <div className="dx-hero-resume-stat">
              <b>{mastered}</b>
              <span>{t('dx.resumeStatMastered')}</span>
            </div>
            <div className="dx-hero-resume-stat">
              <b>{pct}%</b>
              <span>{t('dx.resumeStatComplete')}</span>
            </div>
          </div>
        </div>

        {/* ── Right column: cover stack ────────────────────────────── */}
        {showStack && (
          <div className="dx-cover-stack">
            {/* Behind sibling 1 — rotated −6°, opacity ~.5 */}
            <DxCover deck={siblings[0]} variant="stack-1" className="dx-cover dx-cover-1">
              <span className="dx-cover-tag">
                {t('dx.coverTagVocabulary', { level: siblings[0].level })}
              </span>
              <div className="dx-cover-title">
                {getLocalizedDeckName(siblings[0], i18n.language)}
              </div>
            </DxCover>

            {/* Behind sibling 2 — rotated +4°, opacity ~.65 */}
            <DxCover deck={siblings[1]} variant="stack-2" className="dx-cover dx-cover-2">
              <span className="dx-cover-tag">
                {t('dx.coverTagVocabulary', { level: siblings[1].level })}
              </span>
              <div className="dx-cover-title">
                {getLocalizedDeckName(siblings[1], i18n.language)}
              </div>
            </DxCover>

            {/* Front cover — this deck, with progress foot */}
            <DxCover deck={deck} variant="stack-front" className="dx-cover dx-cover-3">
              <span className="dx-cover-tag">
                {t('dx.coverTagVocabulary', { level: deck.level })}
              </span>
              <div className="dx-cover-title">{localizedName}</div>
              {greekSubtitle && greekSubtitle !== localizedName && (
                <div className="dx-cover-el" lang="el">
                  {greekSubtitle}
                </div>
              )}
              <div className="dx-cover-foot">
                <span className="dx-cover-pct">{pct}%</span>
                <span className="dx-cover-bar">
                  <span style={{ width: `${pct}%` }} />
                </span>
              </div>
            </DxCover>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Convenience wrapper that reads siblings from the store.
// Used by V2DeckHeader so it doesn't need to know about useDeckStore.
// ────────────────────────────────────────────────────────────────────────────

interface DxResumeHeroConnectedProps {
  deck: Deck;
  progress: ProgressMetrics | undefined;
}

export function DxResumeHeroConnected({ deck, progress }: DxResumeHeroConnectedProps) {
  const siblings = useDeckStore((s) => s.rawDecks)
    .filter((d) => d.id !== deck.id)
    .slice(0, 2);

  return <DxResumeHero deck={deck} progress={progress} siblings={siblings} />;
}
