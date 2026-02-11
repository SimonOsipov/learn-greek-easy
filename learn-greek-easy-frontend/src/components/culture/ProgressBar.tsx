import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
}

export function ProgressBar({ current, total, className }: ProgressBarProps) {
  const percentage = total === 0 ? 0 : Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div data-testid="progress-bar" className={cn(className)}>
      <span
        data-testid="progress-bar-counter"
        className="mb-1 block font-cult-mono text-sm text-muted-foreground"
      >
        {current} / {total}
      </span>
      <div
        className="overflow-hidden rounded-full bg-secondary"
        style={{ height: '3px' }}
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Session progress"
      >
        <div
          data-testid="progress-bar-fill"
          className="h-full rounded-full transition-all duration-300 ease-smooth"
          style={{
            width: `${percentage}%`,
            backgroundColor: 'var(--cult-accent)',
          }}
        />
      </div>
    </div>
  );
}
