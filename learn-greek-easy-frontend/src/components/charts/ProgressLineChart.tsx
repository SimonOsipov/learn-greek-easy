// src/components/charts/ProgressLineChart.tsx

import React from 'react';

import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { ChartContainer, ChartTooltip } from '@/components/charts';
import { useProgressData } from '@/hooks/useProgressData';
import { chartColors, colorSchemes } from '@/lib/chartConfig';

interface ProgressLineChartProps {
  height?: number;
  className?: string;
}

/**
 * LineChart visualization of word status progression over time
 * Shows three trends: New Cards, Learning Cards, Mastered Cards
 *
 * @example
 * ```tsx
 * <ProgressLineChart height={300} />
 * ```
 */
export const ProgressLineChart = React.forwardRef<HTMLDivElement, ProgressLineChartProps>(
  ({ height, className }, ref) => {
    const { progressData, loading, error } = useProgressData();

    const chartHeight = height || 300;

    // Format X-axis dates
    const formatXAxis = (dateString: string): string => {
      try {
        const date = new Date(dateString);
        return format(date, 'MMM dd');
      } catch {
        return dateString;
      }
    };

    // Custom tooltip for line chart
    const CustomTooltip = (props: any) => {
      const { active, payload, label } = props;
      if (!active || !payload || payload.length === 0) return null;

      return (
        <ChartTooltip
          active={active}
          payload={payload}
          label={label}
          labelFormatter={formatXAxis}
          formatter={(value) => `${Number(value).toLocaleString()}`}
        />
      );
    };

    // Handle error state
    if (error) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title="Progress Over Time"
          description="Word status progression trend"
          noData
        >
          <div className="text-red-600">Error loading data: {error}</div>
        </ChartContainer>
      );
    }

    // Handle loading state
    if (loading) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title="Progress Over Time"
          description="Word status progression trend"
          loading
          height={chartHeight}
        >
          <div />
        </ChartContainer>
      );
    }

    // Handle empty state
    if (!progressData || progressData.length === 0) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title="Progress Over Time"
          description="Word status progression trend"
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
        title="Progress Over Time"
        description="Word status progression trend"
        height={chartHeight}
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={progressData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gray200} />
            <XAxis
              dataKey="dateString"
              tick={{ fontSize: 12, fill: chartColors.gray600 }}
              tickFormatter={formatXAxis}
              stroke={chartColors.gray300}
            />
            <YAxis
              tick={{ fontSize: 12, fill: chartColors.gray600 }}
              stroke={chartColors.gray300}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            <Line
              type="monotone"
              dataKey="cardsNew"
              stroke={colorSchemes.progression[0]} // cyan
              name="New Cards"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="cardsLearning"
              stroke={colorSchemes.progression[1]} // blue
              name="Learning Cards"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="cardsMastered"
              stroke={colorSchemes.progression[2]} // green
              name="Mastered Cards"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    );
  }
);

ProgressLineChart.displayName = 'ProgressLineChart';
