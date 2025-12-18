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
        <div className="bg-card rounded-lg border p-4">
          <ProgressLineChart height={280} />
        </div>

        {/* Accuracy Trend */}
        <div className="bg-card rounded-lg border p-4">
          <AccuracyAreaChart height={280} />
        </div>

        {/* Deck Performance */}
        <div className="bg-card rounded-lg border p-4">
          <DeckPerformanceChart height={320} maxDecks={6} />
        </div>

        {/* Stage Distribution */}
        <div className="bg-card rounded-lg border p-4">
          <StageDistributionChart height={320} />
        </div>
      </div>
    </div>
  );
};

export default Statistics;
