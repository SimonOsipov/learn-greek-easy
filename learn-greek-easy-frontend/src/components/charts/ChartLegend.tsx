import { cn } from '@/lib/utils';

interface LegendPayload {
  value: string;
  type?: string;
  id?: string;
  color?: string;
}

interface ChartLegendProps {
  payload?: LegendPayload[];
  wrapperClassName?: string;
  className?: string;
  vertical?: boolean;
  onClick?: (dataKey: string) => void;
}

/**
 * Custom legend for Recharts charts
 * Provides consistent styling and optional click handling
 *
 * @example
 * ```tsx
 * <LineChart data={data}>
 *   <Legend content={<ChartLegend />} />
 * </LineChart>
 * ```
 */
export const ChartLegend = ({
  payload,
  wrapperClassName,
  className,
  vertical = false,
  onClick,
}: ChartLegendProps) => {
  if (!payload || payload.length === 0) {
    return null;
  }

  return (
    <div className={cn('pt-4', wrapperClassName)}>
      <ul
        className={cn(
          'flex gap-4 text-sm',
          vertical ? 'flex-col' : 'flex-wrap items-center justify-center',
          className
        )}
      >
        {payload.map((entry, index) => (
          <li
            key={`legend-item-${index}`}
            className={cn(
              'flex items-center gap-2',
              onClick && 'cursor-pointer hover:opacity-80 transition-opacity'
            )}
            onClick={() => onClick && entry.value && onClick(entry.value)}
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
