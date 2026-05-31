// src/components/culture/redesign/CultureHero.tsx
//
// Resume / summary hero panel for Culture screens.
//
// Layout mirrors .dx-hero-resume: radial-gradient panel + optional cover stack.
// Generic via props so hub, deck-detail, and readiness can all use it.

import React from 'react';

import { Link } from 'react-router-dom';

import { DxCover, Kicker } from '@/features/decks/dx';
import type { Deck } from '@/types/deck';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface CultureHeroStat {
  label: string;
  value: React.ReactNode;
}

export interface CultureHeroCta {
  label: string;
  to: string;
  primary?: boolean;
  /** data-testid placed on the rendered <a> */
  testId?: string;
}

export interface CultureHeroProps {
  /** Eyebrow kicker text */
  kicker: string;
  kickerTone?: 'primary' | 'violet' | 'cyan' | 'amber' | 'green';
  /** Main heading */
  title: string;
  /** Optional Greek subtitle — rendered with lang="el" in Noto Serif */
  greekSubtitle?: string;
  /** Body paragraph */
  description?: string;
  /** Up to 3 stats in the stat row */
  stats?: CultureHeroStat[];
  /** Primary + secondary CTAs */
  ctas?: CultureHeroCta[];
  /**
   * Cover for the front of the stack.
   * When undefined the right cover-stack column is not rendered.
   */
  coverDeck?: Pick<Deck, 'id' | 'level' | 'category' | 'coverImageUrl'>;
  /**
   * Two sibling covers shown behind the front cover (rotated/dimmed).
   * Requires coverDeck. Fewer than 2 hides the stack.
   */
  siblingDecks?: Array<
    Pick<Deck, 'id' | 'level' | 'category' | 'coverImageUrl'> & { title: string }
  >;
  /** Optional cover foot label (e.g. progress %) — shown on front cover */
  coverFootLabel?: string;
  coverFootPct?: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function CultureHero({
  kicker,
  kickerTone = 'primary',
  title,
  greekSubtitle,
  description,
  stats = [],
  ctas = [],
  coverDeck,
  siblingDecks = [],
  coverFootLabel,
  coverFootPct,
}: CultureHeroProps) {
  const showStack = !!coverDeck && siblingDecks.length >= 2;

  return (
    <div className="dx-hero-resume">
      <div className="dx-hero-resume-grid">
        {/* ── Left column ───────────────────────────────────────────── */}
        <div className="dx-hero-resume-l">
          <Kicker tone={kickerTone}>{kicker}</Kicker>

          <div>
            <h2 className="dx-hero-resume-h">{title}</h2>
            {greekSubtitle && (
              <p className="dx-hero-resume-el" lang="el">
                {greekSubtitle}
              </p>
            )}
          </div>

          {description && <p className="dx-hero-resume-desc">{description}</p>}

          {stats.length > 0 && (
            <div className="dx-hero-resume-stats">
              {stats.map((s, i) => (
                <div key={i} className="dx-hero-resume-stat">
                  <b>{s.value}</b>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {ctas.length > 0 && (
            <div className="cx-hero-ctas">
              {ctas.map((cta, i) => (
                <Link
                  key={i}
                  to={cta.to}
                  className={cta.primary ? 'cx-cta-primary' : 'cx-cta-ghost'}
                  data-testid={cta.testId}
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Right column: cover stack ──────────────────────────────── */}
        {showStack && coverDeck && (
          <div className="dx-cover-stack">
            {/* Behind sibling 1 — rotated −6°, opacity ~.5 */}
            <DxCover deck={siblingDecks[0]} variant="stack-1" className="dx-cover dx-cover-1">
              <span className="dx-cover-tag">{siblingDecks[0].title}</span>
            </DxCover>

            {/* Behind sibling 2 — rotated +4°, opacity ~.65 */}
            <DxCover deck={siblingDecks[1]} variant="stack-2" className="dx-cover dx-cover-2">
              <span className="dx-cover-tag">{siblingDecks[1].title}</span>
            </DxCover>

            {/* Front cover — main deck with optional progress foot */}
            <DxCover deck={coverDeck} variant="stack-front" className="dx-cover dx-cover-3">
              <div className="dx-cover-title">{title}</div>
              {greekSubtitle && (
                <div className="dx-cover-el" lang="el">
                  {greekSubtitle}
                </div>
              )}
              {coverFootPct !== undefined && (
                <div className="dx-cover-foot">
                  <span className="dx-cover-pct">{coverFootLabel ?? `${coverFootPct}%`}</span>
                  <span className="dx-cover-bar">
                    <span style={{ width: `${coverFootPct}%` }} />
                  </span>
                </div>
              )}
            </DxCover>
          </div>
        )}
      </div>
    </div>
  );
}
