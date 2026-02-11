import { cn } from '@/lib/utils';

export interface ScoreCardProps {
  /** Number of correct answers */
  correct: number;
  /** Total number of questions */
  total: number;
  /** Additional CSS classes for the outer container */
  className?: string;
}

export function ScoreCard({ correct, total, className }: ScoreCardProps) {
  // Derived values
  const rawPercentage = total === 0 ? 0 : Math.round((correct / total) * 100);
  const percentage = Math.min(100, Math.max(0, rawPercentage));
  const isPassing = percentage >= 60;

  // SVG Ring Math
  const RADIUS = 60;
  const STROKE_WIDTH = 8;
  const circumference = 2 * Math.PI * RADIUS;
  const dashArray = `${(percentage / 100) * circumference} ${circumference}`;

  return (
    <div data-testid="score-card" className={cn('flex flex-col items-center', className)}>
      <div className="relative inline-flex items-center justify-center">
        {/* SVG Ring */}
        <svg viewBox="0 0 140 140" width={140} height={140} aria-hidden="true">
          {/* Background ring */}
          <circle
            cx={70}
            cy={70}
            r={RADIUS}
            fill="none"
            stroke="rgba(0,0,0,0.04)"
            strokeWidth={STROKE_WIDTH}
            data-testid="score-ring-bg"
          />
          {/* Progress ring */}
          <circle
            cx={70}
            cy={70}
            r={RADIUS}
            fill="none"
            stroke={isPassing ? '#10b981' : '#f59e0b'}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={dashArray}
            data-testid="score-ring-progress"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              transition: 'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>

        {/* Center text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-bold leading-none"
            style={{ fontSize: '36px', color: isPassing ? '#10b981' : '#f59e0b' }}
            data-testid="score-percentage"
          >
            {percentage}%
          </span>
          <span
            className="mt-1 font-cult-mono text-sm text-[var(--cult-text-muted)]"
            data-testid="score-fraction"
          >
            {correct}/{total}
          </span>
        </div>
      </div>

      {/* Accessibility */}
      <span className="sr-only">
        Score: {correct} out of {total}, {percentage} percent
      </span>
    </div>
  );
}
