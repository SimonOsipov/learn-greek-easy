// src/components/charts/AccuracyAreaChart.tsx

import React from 'react';

import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressData } from '@/hooks/useProgressData';

interface AccuracyAreaChartProps {
  height?: number;
  className?: string;
}

/**
 * AreaChart visualization of accuracy percentage trend over time
 * Shows vocab and culture accuracy as two separate area series
 */
export const AccuracyAreaChart = React.forwardRef<HTMLDivElement, AccuracyAreaChartProps>(
  ({ height, className }, ref) => {
    const { t } = useTranslation('statistics');
    const { progressData, loading, error } = useProgressData();

    const chartHeight = height || 300;

    const chartConfig = {
      vocabAccuracy: {
        label: t('charts.accuracyTrend.vocabulary'),
        color: 'hsl(var(--chart-1))',
      },
      cultureAccuracy: {
        label: t('charts.accuracyTrend.culture'),
        color: 'hsl(var(--chart-2))',
      },
    } satisfies ChartConfig;

    const formatXAxis = (dateString: string): string => {
      try {
        const date = new Date(dateString);
        return format(date, 'MMM dd');
      } catch {
        return dateString;
      }
    };

    const formatYAxis = (value: number): string => `${Math.round(value)}%`;

    if (error) {
      return (
        <Card ref={ref} className={className}>
          <CardHeader>
            <CardTitle>{t('charts.accuracyTrend.title')}</CardTitle>
            <CardDescription>{t('charts.accuracyTrend.description')}</CardDescription>
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
            <CardTitle>{t('charts.accuracyTrend.title')}</CardTitle>
            <CardDescription>{t('charts.accuracyTrend.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="w-full" style={{ height: chartHeight }} />
          </CardContent>
        </Card>
      );
    }

    if (!progressData || progressData.length === 0) {
      return (
        <Card ref={ref} className={className}>
          <CardHeader>
            <CardTitle>{t('charts.accuracyTrend.title')}</CardTitle>
            <CardDescription>{t('charts.accuracyTrend.description')}</CardDescription>
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
          <CardTitle>{t('charts.accuracyTrend.title')}</CardTitle>
          <CardDescription>{t('charts.accuracyTrend.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className={`h-[${chartHeight}px] w-full`}>
            <AreaChart data={progressData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="vocabAccuracyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-vocabAccuracy)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-vocabAccuracy)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="cultureAccuracyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-cultureAccuracy)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-cultureAccuracy)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateString" tick={{ fontSize: 12 }} tickFormatter={formatXAxis} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatXAxis(value as string)}
                    formatter={(value) => [`${Math.round(Number(value))}%`, '']}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="vocabAccuracy"
                stroke="var(--color-vocabAccuracy)"
                fill="url(#vocabAccuracyGradient)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="cultureAccuracy"
                stroke="var(--color-cultureAccuracy)"
                fill="url(#cultureAccuracyGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  }
);

AccuracyAreaChart.displayName = 'AccuracyAreaChart';
