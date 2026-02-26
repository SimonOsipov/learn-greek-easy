// src/components/charts/StageDistributionChart.tsx

import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Legend } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useAnalytics';

interface StageDistributionChartProps {
  height?: number;
  className?: string;
}

interface PieDataItem {
  name: string;
  value: number;
  percent: number;
  original: string;
}

interface LabelProps {
  percent: number;
}

interface LegendPayloadItem {
  value: string;
  color?: string;
  payload?: PieDataItem;
}

/**
 * PieChart showing distribution of words across learning stages
 * Displays: New, Learning, Review, Mastered, Relearning
 */
export const StageDistributionChart = React.forwardRef<HTMLDivElement, StageDistributionChartProps>(
  ({ height, className }, ref) => {
    const { t } = useTranslation('statistics');
    const { data, loading, error } = useAnalytics();

    const chartHeight = height || 350;

    const chartConfig = {
      new: {
        label: t('charts.stageDistribution.stages.new'),
        color: 'hsl(var(--chart-6))',
      },
      learning: {
        label: t('charts.stageDistribution.stages.learning'),
        color: 'hsl(var(--chart-1))',
      },
      review: {
        label: t('charts.stageDistribution.stages.review'),
        color: 'hsl(var(--chart-4))',
      },
      mastered: {
        label: t('charts.stageDistribution.stages.mastered'),
        color: 'hsl(var(--chart-2))',
      },
      relearning: {
        label: t('charts.stageDistribution.stages.relearning'),
        color: 'hsl(var(--chart-5))',
      },
    } satisfies ChartConfig;

    const pieData = useMemo(() => {
      if (!data?.wordStatus) return [];
      const wordStatus = data.wordStatus;
      return [
        {
          name: t('charts.stageDistribution.stages.new'),
          value: wordStatus.new,
          percent: wordStatus.newPercent,
          original: 'new',
        },
        {
          name: t('charts.stageDistribution.stages.learning'),
          value: wordStatus.learning,
          percent: wordStatus.learningPercent,
          original: 'learning',
        },
        {
          name: t('charts.stageDistribution.stages.review'),
          value: wordStatus.review,
          percent: wordStatus.reviewPercent,
          original: 'review',
        },
        {
          name: t('charts.stageDistribution.stages.mastered'),
          value: wordStatus.mastered,
          percent: wordStatus.masteredPercent,
          original: 'mastered',
        },
        {
          name: t('charts.stageDistribution.stages.relearning'),
          value: wordStatus.relearning,
          percent: wordStatus.relearningPercent,
          original: 'relearning',
        },
      ].filter((item) => item.value > 0);
    }, [data?.wordStatus, t]);

    const stageColorVar: Record<string, string> = {
      new: 'var(--color-new)',
      learning: 'var(--color-learning)',
      review: 'var(--color-review)',
      mastered: 'var(--color-mastered)',
      relearning: 'var(--color-relearning)',
    };

    const renderLabel = ({ percent }: LabelProps): string => `${Math.round((percent ?? 0) * 100)}%`;

    const renderLegend = ({ payload }: { payload?: LegendPayloadItem[] }) => {
      if (!payload || payload.length === 0) return null;
      return (
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-xs">
          {payload.map((entry, index) => (
            <div key={`legend-${index}`} className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">
                {entry.value}
                {entry.payload ? ` (${Math.round(entry.payload.percent * 100)}%)` : ''}
              </span>
            </div>
          ))}
        </div>
      );
    };

    if (error) {
      return (
        <Card ref={ref} className={className}>
          <CardHeader>
            <CardTitle>{t('charts.stageDistribution.title')}</CardTitle>
            <CardDescription>{t('charts.stageDistribution.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-center justify-center text-red-600">
              {t('error.loadingData', { error })}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (loading) {
      return (
        <Card ref={ref} className={className}>
          <CardHeader>
            <CardTitle>{t('charts.stageDistribution.title')}</CardTitle>
            <CardDescription>{t('charts.stageDistribution.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="w-full" style={{ height: chartHeight }} />
          </CardContent>
        </Card>
      );
    }

    if (!data?.wordStatus || data.wordStatus.total === 0 || pieData.length === 0) {
      return (
        <Card ref={ref} className={className}>
          <CardHeader>
            <CardTitle>{t('charts.stageDistribution.title')}</CardTitle>
            <CardDescription>{t('charts.stageDistribution.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="flex items-center justify-center text-muted-foreground"
              style={{ height: chartHeight }}
            >
              <p>{t('charts.noData')}</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card ref={ref} className={className}>
        <CardHeader>
          <CardTitle>{t('charts.stageDistribution.title')}</CardTitle>
          <CardDescription>{t('charts.stageDistribution.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={chartConfig}
            className="w-full"
            style={{ height: `${chartHeight}px` }}
          >
            <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                outerRadius={100}
                label={renderLabel}
                dataKey="value"
                isAnimationActive={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={stageColorVar[entry.original]} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      const pieItem = item.payload as PieDataItem;
                      return [
                        `${pieItem.value} ${t('charts.stageDistribution.cardsUnit')} (${Math.round(pieItem.percent * 100)}%)`,
                        name,
                      ];
                    }}
                  />
                }
              />
              <Legend content={renderLegend} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  }
);

StageDistributionChart.displayName = 'StageDistributionChart';
