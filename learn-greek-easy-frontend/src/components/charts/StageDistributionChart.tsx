// src/components/charts/StageDistributionChart.tsx

import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAnalytics } from '@/hooks/useAnalytics';
import { ChartContainer, ChartTooltip } from '@/components/charts';
import { colorSchemes } from '@/lib/chartConfig';

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

/**
 * PieChart showing distribution of words across learning stages
 * Displays: New, Learning, Review, Mastered, Relearning
 *
 * @example
 * ```tsx
 * <StageDistributionChart height={350} />
 * ```
 */
export const StageDistributionChart = React.forwardRef<HTMLDivElement, StageDistributionChartProps>(
  ({ height, className }, ref) => {
    const { data, loading, error } = useAnalytics();

    const chartHeight = height || 350;

    // Transform WordStatusBreakdown to Pie chart format
    const pieData = useMemo(() => {
      if (!data?.wordStatus) return [];

      const wordStatus = data.wordStatus;
      return [
        {
          name: 'New',
          value: wordStatus.new,
          percent: wordStatus.newPercent,
          original: 'new',
        },
        {
          name: 'Learning',
          value: wordStatus.learning,
          percent: wordStatus.learningPercent,
          original: 'learning',
        },
        {
          name: 'Review',
          value: wordStatus.review,
          percent: wordStatus.reviewPercent,
          original: 'review',
        },
        {
          name: 'Mastered',
          value: wordStatus.mastered,
          percent: wordStatus.masteredPercent,
          original: 'mastered',
        },
        {
          name: 'Relearning',
          value: wordStatus.relearning,
          percent: wordStatus.relearningPercent,
          original: 'relearning',
        },
      ].filter(item => item.value > 0);
    }, [data?.wordStatus]);

    // Stage-specific colors
    const stageColors: Record<string, string> = {
      new: colorSchemes.spectrum[5], // cyan (chart6)
      learning: colorSchemes.spectrum[0], // blue (chart1)
      review: colorSchemes.spectrum[4], // violet (chart5)
      mastered: colorSchemes.spectrum[1], // green (chart2)
      relearning: colorSchemes.spectrum[3], // red (chart4)
    };

    // Custom tooltip
    const CustomTooltip = (props: any) => {
      const { active, payload } = props;
      if (!active || !payload || payload.length === 0) return null;

      const data = payload[0].payload as PieDataItem;

      return (
        <ChartTooltip
          active={active}
          payload={[
            {
              name: data.name,
              value: `${data.value} cards (${Math.round(data.percent)}%)`,
              color: stageColors[data.original],
              dataKey: data.original,
            },
          ]}
        />
      );
    };

    // Custom label renderer for pie slices
    const renderLabel = (entry: any): string => {
      return `${Math.round(entry.percent)}%`;
    };

    // Handle error
    if (error) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title="Stage Distribution"
          description="Distribution across learning stages"
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
          title="Stage Distribution"
          description="Distribution across learning stages"
          loading
          height={chartHeight}
        >
          <div />
        </ChartContainer>
      );
    }

    // Handle empty
    if (!data?.wordStatus || data.wordStatus.total === 0 || pieData.length === 0) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title="Stage Distribution"
          description="Distribution across learning stages"
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
        title="Stage Distribution"
        description="Distribution across learning stages"
        height={chartHeight}
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
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
                <Cell
                  key={`cell-${index}`}
                  fill={stageColors[entry.original]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(_value, entry: any) => `${entry.payload.name} (${Math.round(entry.payload.percent)}%)`}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
    );
  }
);

StageDistributionChart.displayName = 'StageDistributionChart';
