import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

export interface ScoreCardProps {
  /** Number of correct answers */
  correct: number;
  /** Number of incorrect answers */
  incorrect: number;
  /** Total number of questions */
  total: number;
  /** Callback when "Try Again" button is clicked */
  onTryAgain: () => void;
  /** Additional CSS classes */
  className?: string;
}

function StatItem({
  value,
  label,
  color,
  testId,
}: {
  value: number;
  label: string;
  color: string;
  testId: string;
}) {
  return (
    <div className="flex flex-col items-center" data-testid={testId}>
      <span className="font-cult-mono text-[24px] font-bold leading-none" style={{ color }}>
        {value}
      </span>
      <span className="mt-1 text-[12px]" style={{ color: 'var(--cult-text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

export function ScoreCard({ correct, incorrect, total, onTryAgain, className }: ScoreCardProps) {
  const { t } = useTranslation('culture');

  // Derived values
  const rawPercentage = total === 0 ? 0 : Math.round((correct / total) * 100);
  const percentage = Math.min(100, Math.max(0, rawPercentage));
  const isPassing = percentage >= 60;

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // SVG Ring Math
  const RADIUS = 60;
  const STROKE_WIDTH = 8;
  const circumference = 2 * Math.PI * RADIUS;
  const dashArray = `${(percentage / 100) * circumference} ${circumference}`;

  return (
    <div
      data-testid="score-card"
      className={cn(
        'flex flex-col items-center',
        !prefersReducedMotion && 'animate-cult-fade-in',
        className
      )}
    >
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

      {/* Title */}
      <h2
        className="mt-4 font-cult-serif text-[22px] font-bold leading-tight"
        style={{ color: 'var(--cult-text)' }}
        data-testid="score-card-title"
      >
        {isPassing
          ? t('scoreCard.titlePass', { defaultValue: 'Well done, warrior!' })
          : t('scoreCard.titleFail', { defaultValue: 'Keep training!' })}
      </h2>

      {/* Subtitle */}
      <p
        className="mt-1 text-[14px]"
        style={{ color: 'var(--cult-text-muted)' }}
        data-testid="score-card-subtitle"
      >
        {isPassing
          ? t('scoreCard.subtitlePass', {
              defaultValue: 'You crushed it! Your knowledge of Greek culture is growing.',
            })
          : t('scoreCard.subtitleFail', {
              defaultValue: 'Every attempt makes you stronger. Review and try again!',
            })}
      </p>

      {/* Stats Row */}
      <div
        className="mt-5 flex w-full items-center justify-center gap-8 py-4"
        style={{
          borderTop: '1px solid var(--cult-border)',
          borderBottom: '1px solid var(--cult-border)',
        }}
        data-testid="score-card-stats"
      >
        <StatItem
          value={correct}
          label={t('scoreCard.correct', { defaultValue: 'Correct' })}
          color="var(--cult-correct)"
          testId="stat-correct"
        />
        <StatItem
          value={incorrect}
          label={t('scoreCard.incorrect', { defaultValue: 'Incorrect' })}
          color="var(--cult-incorrect)"
          testId="stat-incorrect"
        />
        <StatItem
          value={total}
          label={t('scoreCard.total', { defaultValue: 'Total' })}
          color="var(--cult-accent)"
          testId="stat-total"
        />
      </div>

      {/* Try Again Button */}
      <button
        type="button"
        onClick={onTryAgain}
        className={cn(
          'mt-5 w-full rounded-xl px-6 py-2.5',
          'text-[15px] font-semibold text-white',
          'bg-[var(--cult-accent)]',
          'shadow-[0_0_0_3px_var(--cult-accent-glow)]',
          'transition-colors hover:brightness-110',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
        data-testid="score-card-try-again"
      >
        {t('scoreCard.tryAgain', { defaultValue: 'Try Again' })}
      </button>

      {/* Accessibility */}
      <span className="sr-only">
        {t('scoreCard.srScore', {
          defaultValue: 'Score: {{correct}} out of {{total}}, {{percentage}} percent',
          correct,
          total,
          percentage,
        })}
      </span>
    </div>
  );
}
