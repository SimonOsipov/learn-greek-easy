// src/components/charts/StageDistributionChart.tsx

import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

import { ChartContainer, ChartTooltip } from '@/components/charts';
import { useAnalytics } from '@/hooks/useAnalytics';
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

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PieDataItem }>;
}

interface LabelProps {
  percent: number;
}

interface LegendEntry {
  payload: PieDataItem;
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
    const { t } = useTranslation('statistics');
    const { data, loading, error } = useAnalytics();

    const chartHeight = height || 350;

    // Transform WordStatusBreakdown to Pie chart format
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

    // Stage-specific colors
    const stageColors: Record<string, string> = {
      new: colorSchemes.spectrum[5], // cyan (chart6)
      learning: colorSchemes.spectrum[0], // blue (chart1)
      review: colorSchemes.spectrum[4], // violet (chart5)
      mastered: colorSchemes.spectrum[1], // green (chart2)
      relearning: colorSchemes.spectrum[3], // red (chart4)
    };

    // Custom tooltip
    const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
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
    const renderLabel = ({ percent }: LabelProps): string => {
      return `${Math.round(percent)}%`;
    };

    // Handle error
    if (error) {
      return (
        <ChartContainer
          ref={ref}
          className={className}
          title={t('charts.stageDistribution.title')}
          description={t('charts.stageDistribution.description')}
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
          title={t('charts.stageDistribution.title')}
          description={t('charts.stageDistribution.description')}
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
          title={t('charts.stageDistribution.title')}
          description={t('charts.stageDistribution.description')}
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
        title={t('charts.stageDistribution.title')}
        description={t('charts.stageDistribution.description')}
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
                <Cell key={`cell-${index}`} fill={stageColors[entry.original]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(_value, entry: LegendEntry) =>
                `${entry.payload.name} (${Math.round(entry.payload.percent)}%)`
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
    );
  }
);

StageDistributionChart.displayName = 'StageDistributionChart';
