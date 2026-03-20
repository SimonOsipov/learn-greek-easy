import React from 'react';

import { cn } from '@/lib/utils';

export interface SessionSummaryStat {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface SessionSummaryProps {
  title: string;
  stats: SessionSummaryStat[];
  actions: React.ReactNode;
  details?: React.ReactNode;
  className?: string;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  title,
  stats,
  actions,
  details,
  className,
}) => {
  return (
    <div
      className={cn('mx-auto w-full max-w-lg px-4 py-8', className)}
      data-testid="session-summary"
    >
      <h2 className="mb-6 text-center text-2xl font-bold" data-testid="session-summary-title">
        {title}
      </h2>

      <div
        className="mb-6 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${Math.max(stats.length, 1)}, minmax(0, 1fr))` }}
        data-testid="session-summary-stats"
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="flex flex-col items-center rounded-lg border p-4"
              data-testid="session-summary-stat"
            >
              {Icon && <Icon className="mb-2 h-5 w-5 text-muted-foreground" />}
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          );
        })}
      </div>

      {details && <div data-testid="session-summary-details">{details}</div>}

      <div className="flex flex-col items-center gap-3">{actions}</div>
    </div>
  );
};
