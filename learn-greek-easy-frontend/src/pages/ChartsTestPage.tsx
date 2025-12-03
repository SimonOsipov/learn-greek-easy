// Test page to verify all chart components
import React from 'react';

import {
  ProgressLineChart,
  AccuracyAreaChart,
  DeckPerformanceChart,
  StageDistributionChart,
} from '@/components/charts';

const ChartsTestPage: React.FC = () => {
  return (
    <div className="container mx-auto space-y-8 px-4 py-6">
      <div>
        <h1 className="text-3xl font-bold">Chart Components Test</h1>
        <p className="mt-2 text-muted-foreground">
          Verification page for Task 06.04 - Progress Analytics Charts
        </p>
      </div>

      {/* Progress Line Chart */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="mb-4 text-xl font-semibold">1. Progress Line Chart</h2>
        <ProgressLineChart height={300} />
      </div>

      {/* Accuracy Area Chart */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="mb-4 text-xl font-semibold">2. Accuracy Area Chart</h2>
        <AccuracyAreaChart height={300} />
      </div>

      {/* Deck Performance Chart */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="mb-4 text-xl font-semibold">3. Deck Performance Chart</h2>
        <DeckPerformanceChart height={400} />
      </div>

      {/* Stage Distribution Chart */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="mb-4 text-xl font-semibold">4. Stage Distribution Chart</h2>
        <StageDistributionChart height={350} />
      </div>
    </div>
  );
};

export default ChartsTestPage;
