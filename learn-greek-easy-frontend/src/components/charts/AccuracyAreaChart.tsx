// src/components/charts/AccuracyAreaChart.tsx

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { useProgressData } from '@/hooks/useProgressData';
import { ChartContainer, ChartTooltip } from '@/components/charts';
import { chartColors } from '@/lib/chartConfig';

interface AccuracyAreaChartProps {
  height?: number;
  className?: string;
}

/**
 * AreaChart visualization of accuracy percentage trend over time
 * Shows accuracy as a filled area with gradient
 *
 * @example
 * ```tsx
 * <AccuracyAreaChart height={300} />
 * ```
 */
export const AccuracyAreaChart = React.forwardRef<HTMLDivElement, AccuracyAreaChartProps>(
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

    // Format Y-axis as percentage
    const formatYAxis = (value: number): string => `${Math.round(value)}%`;

    // Custom tooltip
    const CustomTooltip = (props: any) => {
      const { active, payload, label } = props;
      if (!active || !payload || payload.length === 0) return null;

      return (
        <ChartTooltip
          active={active}
          payload={payload}
          label={label}
          labelFormatter={formatXAxis}
          formatter={(value) => `${Math.round(Number(value))}%`}
        />
      );
    };

    // Handle error
    if (error) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title="Accuracy Trend"
          description="Your accuracy percentage over time"
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
          title="Accuracy Trend"
          description="Your accuracy percentage over time"
          loading
          height={chartHeight}
        >
          <div />
        </ChartContainer>
      );
    }

    // Handle empty
    if (!progressData || progressData.length === 0) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title="Accuracy Trend"
          description="Your accuracy percentage over time"
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
        title="Accuracy Trend"
        description="Your accuracy percentage over time"
        height={chartHeight}
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart
            data={progressData}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.chart1} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chartColors.chart1} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartColors.gray200}
            />
            <XAxis
              dataKey="dateString"
              tick={{ fontSize: 12, fill: chartColors.gray600 }}
              tickFormatter={formatXAxis}
              stroke={chartColors.gray300}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: chartColors.gray600 }}
              stroke={chartColors.gray300}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="accuracy"
              stroke={chartColors.chart1}
              fill="url(#accuracyGradient)"
              isAnimationActive={false}
              name="Accuracy"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    );
  }
);

AccuracyAreaChart.displayName = 'AccuracyAreaChart';
