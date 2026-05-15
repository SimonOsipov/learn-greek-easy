// src/pages/admin/InboxView.tsx

import { useState } from 'react';

import { Bell, MessageSquare, FilePen, Bug, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SegControl, type SegOption } from '@/components/ui/seg-control';
import { StatCard } from '@/components/ui/stat-card';

/**
 * Inbox tab body shell. Renders body only — `<PageHead>` is rendered once
 * by `AdminPage` via `pageHeadPropsFor('inbox', t)` (extended in INBPH-02),
 * and `<SectionTabs>` is rendered once by the admin shell.
 *
 * Stat grid (4 StatCards) and attention panel (SegControl + empty state)
 * added by INBPH-04. All counts are placeholder zeros — no data fetch.
 */

type InboxFilter = 'all' | 'feedback' | 'drafts' | 'audio' | 'errors';

export default function InboxView() {
  const { t } = useTranslation('admin');
  const [filter, setFilter] = useState<InboxFilter>('all');

  const filterOptions: SegOption<InboxFilter>[] = [
    { value: 'all', label: t('inbox.filter.all'), count: 0 },
    { value: 'feedback', label: t('inbox.filter.feedback'), count: 0 },
    { value: 'drafts', label: t('inbox.filter.drafts'), count: 0 },
    { value: 'audio', label: t('inbox.filter.audio'), count: 0 },
    { value: 'errors', label: t('inbox.filter.errors'), count: 0 },
  ];

  return (
    <div>
      <section className="stat-grid">
        <StatCard
          title={t('inbox.stats.open.title')}
          sub={t('inbox.stats.open.sub')}
          n={0}
          icon={<Bell />}
          tone="amber"
          bars={[0, 0, 0, 0, 0, 0, 0, 0, 0]}
        />
        <StatCard
          title={t('inbox.stats.feedback.title')}
          sub={t('inbox.stats.feedback.sub')}
          n={0}
          icon={<MessageSquare />}
          tone="blue"
          bars={[0, 0, 0, 0, 0, 0, 0, 0, 0]}
        />
        <StatCard
          title={t('inbox.stats.drafts.title')}
          sub={t('inbox.stats.drafts.sub')}
          n={0}
          icon={<FilePen />}
          tone="violet"
          bars={[0, 0, 0, 0, 0, 0, 0, 0, 0]}
        />
        <StatCard
          title={t('inbox.stats.errors.title')}
          sub={t('inbox.stats.errors.sub')}
          n={0}
          icon={<Bug />}
          tone="green"
          bars={[0, 0, 0, 0, 0, 0, 0, 0, 0]}
        />
      </section>

      <section className="attention-card">
        <div className="attention-head">
          <div>
            <h2 className="attention-h">{t('inbox.panel.title')}</h2>
            <p className="attention-sub">{t('inbox.panel.sub')}</p>
          </div>
          <SegControl options={filterOptions} value={filter} onChange={setFilter} />
        </div>
        <div role="status" aria-live="polite" className="py-12 text-center">
          <Inbox aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold">{t('inbox.empty.title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('inbox.empty.sub')}</p>
        </div>
      </section>
    </div>
  );
}
