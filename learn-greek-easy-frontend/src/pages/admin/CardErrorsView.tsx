import { AlertTriangle, CheckCircle, Clock, Gauge } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminCardErrorSection } from '@/components/admin/AdminCardErrorSection';
import { PageHead } from '@/components/admin/shell/page-head';
import { Kicker } from '@/components/ui/kicker';
import { StatCard } from '@/components/ui/stat-card';

export default function CardErrorsView() {
  const { t } = useTranslation('admin');

  return (
    <div>
      <PageHead
        breadcrumb={[{ label: t('page.title') }, { label: t('cardErrors.v2.pageHead.breadcrumb') }]}
        kicker={<Kicker dot="amber">{t('cardErrors.v2.pageHead.kicker')}</Kicker>}
        title={t('cardErrors.v2.pageHead.title')}
        sub={t('cardErrors.v2.pageHead.sub')}
      />

      <section className="stat-grid">
        <StatCard
          title={t('cardErrors.v2.statCards.total.label')}
          n="—"
          sub={t('cardErrors.v2.statCards.total.sub')}
          tone="cyan"
          icon={<AlertTriangle />}
        />
        <StatCard
          title={t('cardErrors.v2.statCards.open.label')}
          n="—"
          sub={t('cardErrors.v2.statCards.open.sub')}
          tone="amber"
          icon={<Clock />}
        />
        <StatCard
          title={t('cardErrors.v2.statCards.resolved.label')}
          n="—"
          sub={t('cardErrors.v2.statCards.resolved.sub')}
          tone="green"
          icon={<CheckCircle />}
        />
        <StatCard
          title={t('cardErrors.v2.statCards.avgTimeToResolve.label')}
          n="—"
          sub={t('cardErrors.v2.statCards.avgTimeToResolve.sub')}
          tone="violet"
          icon={<Gauge />}
        />
      </section>

      <section aria-labelledby="card-errors-heading">
        <h2 id="card-errors-heading" className="sr-only">
          {t('tabs.errors')}
        </h2>
        <AdminCardErrorSection />
      </section>
    </div>
  );
}
