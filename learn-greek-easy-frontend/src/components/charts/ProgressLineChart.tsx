// src/components/charts/ProgressLineChart.tsx

import React from 'react';

import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

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

interface ProgressLineChartProps {
  height?: number;
  className?: string;
}

/**
 * LineChart visualization of word status progression over time
 * Shows trends: Learning Cards, Mastered Cards
 */
export const ProgressLineChart = React.forwardRef<HTMLDivElement, ProgressLineChartProps>(
  ({ height, className }, ref) => {
    const { t } = useTranslation('statistics');
    const { progressData, loading, error } = useProgressData();

    const chartHeight = height || 300;

    const chartConfig = {
      cardsLearning: {
        label: t('charts.progressOverTime.learningCards'),
        color: 'hsl(var(--chart-1))',
      },
      cardsMastered: {
        label: t('charts.progressOverTime.masteredCards'),
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

    if (error) {
      return (
        <Card ref={ref} className={className}>
          <CardHeader>
            <CardTitle>{t('charts.progressOverTime.title')}</CardTitle>
            <CardDescription>{t('charts.progressOverTime.description')}</CardDescription>
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
            <CardTitle>{t('charts.progressOverTime.title')}</CardTitle>
            <CardDescription>{t('charts.progressOverTime.description')}</CardDescription>
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
            <CardTitle>{t('charts.progressOverTime.title')}</CardTitle>
            <CardDescription>{t('charts.progressOverTime.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="flex items-center justify-center text-muted-foreground"
              style={{ height: chartHeight }}
            >
              <p>No data available</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card ref={ref} className={className}>
        <CardHeader>
          <CardTitle>{t('charts.progressOverTime.title')}</CardTitle>
          <CardDescription>{t('charts.progressOverTime.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className={`h-[${chartHeight}px] w-full`}>
            <LineChart data={progressData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateString" tick={{ fontSize: 12 }} tickFormatter={formatXAxis} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}`} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatXAxis(value as string)}
                    formatter={(value) => [`${Number(value).toLocaleString()}`, '']}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                type="monotone"
                dataKey="cardsLearning"
                stroke="var(--color-cardsLearning)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="cardsMastered"
                stroke="var(--color-cardsMastered)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  }
);

ProgressLineChart.displayName = 'ProgressLineChart';
