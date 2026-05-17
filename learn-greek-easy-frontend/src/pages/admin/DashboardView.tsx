import { Dumbbell, Layers, MessageSquare, Newspaper } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Kicker } from '@/components/ui/kicker';
import { StatCard } from '@/components/ui/stat-card';
import type { AdminTabType } from '@/pages/admin/types';
import type { ContentStatsResponse } from '@/services/adminAPI';

interface DashboardViewProps {
  stats: ContentStatsResponse | null;
  setActiveTab: (tab: AdminTabType) => void;
}

const FLAT_BARS = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export default function DashboardView({ stats, setActiveTab }: DashboardViewProps) {
  const { t } = useTranslation('admin');

  return (
    <div>
      <section className="stat-grid">
        <StatCard
          title={t('dashboard.stats.decks.title')}
          sub={t('dashboard.stats.decks.sub', { count: stats?.total_cards ?? 0 })}
          n={stats?.total_decks ?? '—'}
          icon={<Layers />}
          tone="blue"
          bars={FLAT_BARS}
          onClick={() => setActiveTab('decks')}
        />
        <StatCard
          title={t('dashboard.stats.news.title')}
          sub={t('dashboard.stats.news.sub')}
          n="—"
          icon={<Newspaper />}
          tone="violet"
          bars={FLAT_BARS}
          onClick={() => setActiveTab('news')}
        />
        <StatCard
          title={t('dashboard.stats.situations.title')}
          sub={t('dashboard.stats.situations.sub')}
          n="—"
          icon={<MessageSquare />}
          tone="amber"
          bars={FLAT_BARS}
          onClick={() => setActiveTab('situations')}
        />
        <StatCard
          title={t('dashboard.stats.exercises.title')}
          sub={t('dashboard.stats.exercises.sub')}
          n="—"
          icon={<Dumbbell />}
          tone="cyan"
          bars={FLAT_BARS}
          onClick={() => setActiveTab('exercises')}
        />
      </section>

      <section className="dash-grid">
        <div className="dash-col">
          <article className="attention-card">
            <div className="attention-head">
              <div role="status" aria-live="polite">
                <Kicker dot="amber">{t('dashboard.inbox.kicker')}</Kicker>
                <h2 className="attention-h">{t('dashboard.inbox.title')}</h2>
                <p className="attention-sub">{t('dashboard.inbox.sub')}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('inbox')}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t('dashboard.inbox.viewAll')}
              </button>
            </div>
          </article>
        </div>

        <div className="dash-col">
          <article className="attention-card">
            <div className="attention-head">
              <div role="status" aria-live="polite">
                <h2 className="attention-h">{t('dashboard.activity.title')}</h2>
                <p className="attention-sub">{t('dashboard.activity.sub')}</p>
              </div>
            </div>
          </article>

          <article className="attention-card">
            <div className="attention-head">
              <div role="status" aria-live="polite">
                <h2 className="attention-h">{t('dashboard.pipeline.title')}</h2>
                <p className="attention-sub">{t('dashboard.pipeline.sub')}</p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
