import { AlertTriangle, CheckCircle, Clock, Gauge } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminCardErrorSection } from '@/components/admin/AdminCardErrorSection';
import { StatCard } from '@/components/ui/stat-card';

export default function CardErrorsView() {
  const { t } = useTranslation('admin');

  return (
    <div>
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

      <AdminCardErrorSection />
    </div>
  );
}
