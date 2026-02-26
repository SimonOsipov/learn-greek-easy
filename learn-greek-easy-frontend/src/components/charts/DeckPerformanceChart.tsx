// src/components/charts/DeckPerformanceChart.tsx

import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeckPerformance } from '@/hooks/useDeckPerformance';
import type { DeckPerformanceStats } from '@/types/analytics';

interface DeckPerformanceChartProps {
  height?: number;
  maxDecks?: number;
  className?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DeckPerformanceStats }>;
}

/**
 * Horizontal BarChart showing deck completion/mastery percentages
 * Allows comparing performance across all decks
 */
export const DeckPerformanceChart = React.forwardRef<HTMLDivElement, DeckPerformanceChartProps>(
  ({ height, maxDecks = 8, className }, ref) => {
    const { t } = useTranslation('statistics');
    const { deckStats, loading, error } = useDeckPerformance();

    const chartHeight = height || 400;

    const chartConfig = {
      mastery: {
        label: t('charts.deckPerformance.title'),
        color: 'hsl(var(--chart-1))',
      },
    } satisfies ChartConfig;

    const sortedDecks = useMemo(() => {
      if (!deckStats) return [];
      return [...deckStats].sort((a, b) => b.mastery - a.mastery).slice(0, maxDecks);
    }, [deckStats, maxDecks]);

    const formatXAxis = (value: number): string => `${Math.round(value)}%`;

    const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
      if (!active || !payload || payload.length === 0) return null;
      const data = payload[0].payload as DeckPerformanceStats;
      const deckIndex = sortedDecks.findIndex((d) => d.deckId === data.deckId);
      const color = `hsl(var(--chart-${(deckIndex % 8) + 1}))`;
      return (
        <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: color }}
            />
            <span className="font-medium">{data.deckName}</span>
          </div>
          <div className="text-muted-foreground">
            {Math.round(data.mastery)}% ({data.cardsMastered}/{data.cardsInDeck} cards,{' '}
            {Math.round(data.accuracy)}% accuracy)
          </div>
        </div>
      );
    };

    if (error) {
      return (
        <Card ref={ref} className={className}>
          <CardHeader>
            <CardTitle>{t('charts.deckPerformance.title')}</CardTitle>
            <CardDescription>{t('charts.deckPerformance.description')}</CardDescription>
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
            <CardTitle>{t('charts.deckPerformance.title')}</CardTitle>
            <CardDescription>{t('charts.deckPerformance.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="w-full" style={{ height: chartHeight }} />
          </CardContent>
        </Card>
      );
    }

    if (!sortedDecks || sortedDecks.length === 0) {
      return (
        <Card ref={ref} className={className}>
          <CardHeader>
            <CardTitle>{t('charts.deckPerformance.title')}</CardTitle>
            <CardDescription>{t('charts.deckPerformance.description')}</CardDescription>
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
          <CardTitle>{t('charts.deckPerformance.title')}</CardTitle>
          <CardDescription>{t('charts.deckPerformance.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className={`h-[${chartHeight}px] w-full`}>
            <BarChart
              data={sortedDecks}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickFormatter={formatXAxis}
              />
              <YAxis
                type="category"
                dataKey="deckName"
                width={120}
                tick={{ fontSize: 12 }}
                tickFormatter={(name: string) =>
                  name.length > 12 ? name.slice(0, 12) + '…' : name
                }
              />
              <ChartTooltip content={<CustomTooltip />} />
              <Bar dataKey="mastery" isAnimationActive={false} radius={[0, 8, 8, 0]}>
                {sortedDecks.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 8) + 1}))`} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  }
);

DeckPerformanceChart.displayName = 'DeckPerformanceChart';
