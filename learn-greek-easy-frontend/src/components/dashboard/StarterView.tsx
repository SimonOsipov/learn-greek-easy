// src/components/dashboard/StarterView.tsx
// DASH2-01-07 — New-user "starter state" view.
//
// Shown in place of HeroEntries + WhatsNewStrip + Feed when isNewUser() is true.
// Three static cards link to /decks, /news, /situations. All text is i18n-driven.
//
// Cascade trap: CTAs are plain <Link> elements with .btn classes — NOT shadcn <Button>.
// shadcn Button emits Tailwind utilities (h-10 w-10 etc.) that beat @layer components,
// clobbering the .btn sizing. Using plain <Link className="btn ..."> is the established
// pattern for all dashboard CTAs (see HeroEntries.tsx, FeedCards.tsx).

import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

// ─── Static rec map (single-use → inline; no separate lib) ───────────────────
const RECS = [
  { id: 'deck', to: '/decks' },
  { id: 'article', to: '/news' },
  { id: 'dialog', to: '/situations' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────

export function StarterView() {
  const { t } = useTranslation('common');

  return (
    <section className="db-empty" data-testid="starter-view">
      <div>
        {/* Kicker — reuses existing .kicker-atom / .kicker-dot atoms (index.css ~2279).
            CD adds style={{marginBottom:8}} here — dropped; .kicker-atom already has margin-bottom:10px. */}
        <span className="kicker-atom">
          <span className="kicker-dot" />
          {t('dashboard.starter.kicker')}
        </span>
        <h2 className="db-empty-h">{t('dashboard.starter.heading')}</h2>
        <p className="db-empty-sub">{t('dashboard.starter.sub')}</p>
      </div>

      <div className="db-empty-grid">
        {RECS.map((rec, i) => (
          <article key={rec.id} className="db-empty-card">
            <div className="db-empty-num">{i + 1}</div>
            <div>
              <h3 className="db-empty-h2">{t(`dashboard.starter.${rec.id}.title`)}</h3>
              <p className="db-empty-sub2">{t(`dashboard.starter.${rec.id}.sub`)}</p>
            </div>
            <p className="db-empty-meta">{t(`dashboard.starter.${rec.id}.meta`)}</p>
            <div className="db-empty-foot">
              <Link to={rec.to} className={`btn ${i === 0 ? 'btn-primary' : 'btn-glass'} btn-sm`}>
                {t(`dashboard.starter.${rec.id}.cta`)}{' '}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
