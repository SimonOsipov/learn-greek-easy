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
          title={t('cardErrors.stats.totalReports.label')}
          n="—"
          sub={t('cardErrors.stats.totalReports.subline')}
          tone="cyan"
          icon={<AlertTriangle />}
        />
        <StatCard
          title={t('cardErrors.stats.awaitingReview.label')}
          n="—"
          sub={t('cardErrors.stats.awaitingReview.subline')}
          tone="amber"
          icon={<Clock />}
        />
        <StatCard
          title={t('cardErrors.stats.fixedAllTime.label')}
          n="—"
          sub={t('cardErrors.stats.fixedAllTime.subline')}
          tone="green"
          icon={<CheckCircle />}
        />
        <StatCard
          title={t('cardErrors.stats.medianTimeToFix.label')}
          n="—"
          sub={t('cardErrors.stats.medianTimeToFix.subline')}
          tone="violet"
          icon={<Gauge />}
        />
      </section>

      <AdminCardErrorSection />
    </div>
  );
}
