import { cn } from '@/lib/utils';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number | string;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  className?: string;
  formatter?: (value: number | string) => string;
  labelFormatter?: (label: string) => string;
}

/**
 * Custom tooltip for Recharts charts
 * Matches Shadcn/ui theme and provides consistent styling
 *
 * @example
 * ```tsx
 * <LineChart data={data}>
 *   <Tooltip content={<ChartTooltip />} />
 * </LineChart>
 * ```
 */
export const ChartTooltip = ({
  active,
  payload,
  label,
  className,
  formatter = (value) => String(value),
  labelFormatter = (label) => label,
}: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-background p-3 shadow-lg',
        'min-w-[120px]',
        className
      )}
    >
      {label && (
        <p className="mb-2 text-sm font-semibold text-foreground">
          {labelFormatter(label)}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={`tooltip-item-${index}`} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-muted-foreground">{entry.name}:</span>
            <span className="text-sm font-medium text-foreground">
              {formatter(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
