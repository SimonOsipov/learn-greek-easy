import React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Metric } from '@/types/dashboard';

interface MetricCardProps extends Metric {
  loading?: boolean;
  onClick?: () => void;
  tooltip?: string;
}

const colorClasses = {
  primary: 'text-primary',
  orange: 'text-warning',
  green: 'text-success',
  blue: 'text-info',
  muted: 'text-text-muted',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  sublabel,
  color = 'primary',
  icon,
  loading,
  onClick,
  tooltip,
}) => {
  if (loading) {
    return (
      <Card className="p-6">
        <CardContent className="space-y-2 p-0">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  const content = (
    <Card
      className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-text-muted">{label}</span>
          {icon && <span className="text-2xl">{icon}</span>}
        </div>
        <div className={`text-2xl font-bold md:text-3xl ${colorClasses[color]}`}>{value}</div>
        <p className="mt-1 text-xs text-text-subtle">{sublabel}</p>
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
};
