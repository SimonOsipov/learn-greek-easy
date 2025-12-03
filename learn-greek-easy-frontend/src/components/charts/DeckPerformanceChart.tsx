// src/components/charts/DeckPerformanceChart.tsx

import React, { useMemo } from 'react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';

import { ChartContainer, ChartTooltip } from '@/components/charts';
import { useDeckPerformance } from '@/hooks/useDeckPerformance';
import { chartColors, colorSchemes } from '@/lib/chartConfig';
import type { DeckPerformanceStats } from '@/types/analytics';

interface DeckPerformanceChartProps {
  height?: number;
  maxDecks?: number;
  className?: string;
}

/**
 * Horizontal BarChart showing deck completion/mastery percentages
 * Allows comparing performance across all decks
 *
 * @example
 * ```tsx
 * <DeckPerformanceChart height={400} />
 * ```
 */
export const DeckPerformanceChart = React.forwardRef<HTMLDivElement, DeckPerformanceChartProps>(
  ({ height, maxDecks = 8, className }, ref) => {
    const { deckStats, loading, error } = useDeckPerformance();

    const chartHeight = height || 400;

    // Sort and limit decks
    const sortedDecks = useMemo(() => {
      if (!deckStats) return [];
      return deckStats.sort((a, b) => b.mastery - a.mastery).slice(0, maxDecks);
    }, [deckStats, maxDecks]);

    // Format X-axis as percentage
    const formatXAxis = (value: number): string => `${Math.round(value)}%`;

    // Custom tooltip with detailed info
    const CustomTooltip = (props: any) => {
      const { active, payload } = props;
      if (!active || !payload || payload.length === 0) return null;

      const data = payload[0].payload as DeckPerformanceStats;
      const deckIndex = sortedDecks.findIndex((d) => d.deckId === data.deckId);

      return (
        <ChartTooltip
          active={active}
          payload={[
            {
              name: data.deckName,
              value: `${Math.round(data.mastery)}% (${data.cardsMastered}/${data.cardsInDeck} cards, ${Math.round(data.accuracy)}% accuracy)`,
              color: colorSchemes.spectrum[deckIndex % 8],
              dataKey: 'mastery',
            },
          ]}
        />
      );
    };

    // Handle error
    if (error) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title="Deck Performance"
          description="Mastery percentage by deck"
          noData
        >
          <div className="text-red-600">Error loading data: {error}</div>
        </ChartContainer>
      );
    }

    // Handle loading
    if (loading) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title="Deck Performance"
          description="Mastery percentage by deck"
          loading
          height={chartHeight}
        >
          <div />
        </ChartContainer>
      );
    }

    // Handle empty
    if (!sortedDecks || sortedDecks.length === 0) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title="Deck Performance"
          description="Mastery percentage by deck"
          noData
          height={chartHeight}
        >
          <div />
        </ChartContainer>
      );
    }

    return (
      <ChartContainer
        ref={ref}
        className={className}
        title="Deck Performance"
        description="Mastery percentage by deck"
        height={chartHeight}
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={sortedDecks}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gray200} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: chartColors.gray600 }}
              stroke={chartColors.gray300}
              tickFormatter={formatXAxis}
            />
            <YAxis
              type="category"
              dataKey="deckName"
              width={120}
              tick={{ fontSize: 12, fill: chartColors.gray600 }}
              stroke={chartColors.gray300}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="mastery"
              fill={chartColors.chart1}
              isAnimationActive={false}
              radius={[0, 8, 8, 0]}
            >
              {sortedDecks.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={colorSchemes.spectrum[index % 8]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    );
  }
);

DeckPerformanceChart.displayName = 'DeckPerformanceChart';
