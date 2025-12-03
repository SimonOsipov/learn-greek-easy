import React, { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getResponsiveHeight } from '@/lib/chartConfig';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  loading?: boolean;
  noData?: boolean;
  className?: string;
  height?: number;
  bordered?: boolean;
  background?: boolean;
}

/**
 * Responsive container for Recharts charts
 * Provides consistent padding, loading states, and responsive height
 *
 * @example
 * ```tsx
 * <ChartContainer title="Progress Over Time" height={300}>
 *   <LineChart data={data}>
 *     <Line dataKey="value" />
 *   </LineChart>
 * </ChartContainer>
 * ```
 */
export const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  (
    {
      children,
      title,
      description,
      loading = false,
      noData = false,
      className,
      height,
      bordered = true,
      background = true,
    },
    ref
  ) => {
    const [responsiveHeight, setResponsiveHeight] = useState<number>(height || 300);

    useEffect(() => {
      if (height) return; // Don't auto-adjust if height is provided

      // Set initial height based on window width
      setResponsiveHeight(getResponsiveHeight(window.innerWidth));

      const handleResize = () => {
        setResponsiveHeight(getResponsiveHeight(window.innerWidth));
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [height]);

    const content = (
      <div ref={ref} className={cn('w-full', className)} style={{ height: responsiveHeight }}>
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : noData ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p>No data available</p>
          </div>
        ) : (
          children
        )}
      </div>
    );

    if (!title && !description) {
      return content;
    }

    return (
      <Card className={cn(bordered ? '' : 'border-0', background ? '' : 'bg-transparent')}>
        {(title || description) && (
          <CardHeader>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent>{content}</CardContent>
      </Card>
    );
  }
);

ChartContainer.displayName = 'ChartContainer';
