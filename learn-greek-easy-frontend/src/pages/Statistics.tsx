import React from 'react';

import {
  ProgressLineChart,
  AccuracyAreaChart,
  DeckPerformanceChart,
  StageDistributionChart,
} from '@/components/charts';

/**
 * Statistics Page
 *
 * Displays comprehensive analytics and learning statistics:
 * - Progress over time (line chart)
 * - Accuracy trend (area chart)
 * - Deck performance comparison (bar chart)
 * - Learning stage distribution (pie chart)
 *
 * All charts fetch their own data via hooks.
 */
const Statistics: React.FC = () => {
  return (
    <div className="space-y-6 pb-8" data-testid="statistics-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary md:text-3xl">Statistics</h1>
        <p className="mt-2 text-muted-foreground">Track your learning progress and achievements.</p>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Progress Over Time */}
        <ProgressLineChart height={280} />

        {/* Accuracy Trend */}
        <AccuracyAreaChart height={280} />

        {/* Deck Performance */}
        <DeckPerformanceChart height={320} maxDecks={6} />

        {/* Stage Distribution */}
        <StageDistributionChart height={320} />
      </div>
    </div>
  );
};

export default Statistics;
