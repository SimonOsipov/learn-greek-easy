import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SummaryCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  testId?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, testId }) => (
  <Card data-testid={testId}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </CardContent>
  </Card>
);

export { SummaryCard };
export type { SummaryCardProps };
