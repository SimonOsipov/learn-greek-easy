// src/components/dashboard/WhatsNewStrip.tsx
//
// "Recently added" strip (DASH2-01-05).
// Renders one wired situations chip and two unwired placeholder chips.
// Pure component — receives whatsNewCount as a prop from Dashboard.tsx.

import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { UnwiredDot } from '@/features/decks/dx';

export interface WhatsNewStripProps {
  whatsNewCount: number;
}

export function WhatsNewStrip({ whatsNewCount }: WhatsNewStripProps) {
  const { t } = useTranslation('common');

  return (
    <div className="db-whatsnew" data-testid="whats-new-strip">
      {/* Heading with green success dot (via ::before) */}
      <span className="db-whatsnew-l">{t('dashboard.whatsNew.heading')}</span>

      {/* Wired: situations count from GET /situations/comprehension */}
      <span className="db-whatsnew-chip" data-testid="whats-new-situations">
        <b>{whatsNewCount}</b> {t('dashboard.whatsNew.situations')}
      </span>

      {/* Unwired: news items — backend not yet connected */}
      <span className="db-whatsnew-chip">
        <UnwiredDot tone="danger" aria-label={t('dashboard.whatsNew.newsItemsAria')}>
          <b>—</b> {t('dashboard.whatsNew.newsItems')}
        </UnwiredDot>
      </span>

      {/* Unwired: audio articles — backend not yet connected */}
      <span className="db-whatsnew-chip">
        <UnwiredDot tone="danger" aria-label={t('dashboard.whatsNew.audioArticlesAria')}>
          <b>—</b> {t('dashboard.whatsNew.audioArticles')}
        </UnwiredDot>
      </span>

      <span className="db-whatsnew-spacer" />

      {/* See-all link: plain <Link> + lucide ArrowRight (NOT shadcn <Button> — cascade trap) */}
      <Link to="/changelog" className="btn btn-ghost btn-sm" data-testid="whats-new-see-all">
        {t('dashboard.whatsNew.seeAll')} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
