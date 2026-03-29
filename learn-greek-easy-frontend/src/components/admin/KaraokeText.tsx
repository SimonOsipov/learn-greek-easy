import { cn } from '@/lib/utils';
import type { WordTimestamp } from '@/types/situation';

interface KaraokeTextProps {
  wordTimestamps: WordTimestamp[];
  currentTimeMs: number;
  fallbackText: string;
  className?: string;
}

export function KaraokeText({
  wordTimestamps,
  currentTimeMs,
  fallbackText,
  className,
}: KaraokeTextProps) {
  if (!wordTimestamps.length || currentTimeMs <= 0) {
    return <p className={cn('text-sm', className)}>{fallbackText}</p>;
  }

  return (
    <p className={cn('text-sm', className)}>
      {wordTimestamps.map((wt, idx) => {
        const state =
          wt.end_ms <= currentTimeMs
            ? 'spoken'
            : wt.start_ms <= currentTimeMs
              ? 'speaking'
              : 'pending';
        return (
          <span
            key={idx}
            className={cn(
              'transition-all duration-150',
              state === 'spoken' && 'text-foreground',
              state === 'speaking' && 'rounded bg-primary/20 px-0.5 font-medium',
              state === 'pending' && 'text-muted-foreground'
            )}
          >
            {wt.word}
            {idx < wordTimestamps.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </p>
  );
}
