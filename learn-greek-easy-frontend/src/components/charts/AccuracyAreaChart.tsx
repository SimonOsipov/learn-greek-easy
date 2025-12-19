// src/components/charts/AccuracyAreaChart.tsx

import React from 'react';

import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { ChartContainer, ChartTooltip } from '@/components/charts';
import { useProgressData } from '@/hooks/useProgressData';
import { chartColors } from '@/lib/chartConfig';

interface AccuracyAreaChartProps {
  height?: number;
  className?: string;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
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
    const { t } = useTranslation('statistics');
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
    const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
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
          title={t('charts.accuracyTrend.title')}
          description={t('charts.accuracyTrend.description')}
          noData
        >
          <div className="text-red-600">{t('error.loadingData', { error })}</div>
        </ChartContainer>
      );
    }

    // Handle loading
    if (loading) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title={t('charts.accuracyTrend.title')}
          description={t('charts.accuracyTrend.description')}
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
          title={t('charts.accuracyTrend.title')}
          description={t('charts.accuracyTrend.description')}
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
        title={t('charts.accuracyTrend.title')}
        description={t('charts.accuracyTrend.description')}
        height={chartHeight}
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={progressData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.chart1} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chartColors.chart1} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gray200} />
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
              name={t('charts.accuracyTrend.accuracy')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    );
  }
);

AccuracyAreaChart.displayName = 'AccuracyAreaChart';
