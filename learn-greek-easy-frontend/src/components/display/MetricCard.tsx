import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import type { Metric } from '@/types/dashboard';

interface MetricCardProps extends Metric {
  loading?: boolean;
}

export const MetricCard = React.memo<MetricCardProps>(
  ({ label, value, sublabel, color: _color, icon, loading }) => {
    if (loading) {
      return (
        <div className="card space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      );
    }

    return (
      <div className="card transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="mb-2 flex items-center justify-between">
          <span className="metric-label">{label}</span>
          {icon && <span className="text-2xl">{icon}</span>}
        </div>
        <div className="metric-value">{value}</div>
        <p className="metric-sublabel">{sublabel}</p>
      </div>
    );
  }
);

MetricCard.displayName = 'MetricCard';
