import { type FC, useRef } from 'react';

import { cn } from '@/lib/utils';
import { generateBars } from '@/lib/waveform';

const BAR_COUNT = 48;

export interface WaveformPlayerProps {
  /** Additional CSS classes applied to the outer container. Parent must define a height for percentage-based bar heights to resolve. */
  className?: string;
}

export const WaveformPlayer: FC<WaveformPlayerProps> = ({ className }) => {
  const barsRef = useRef<number[] | null>(null);
  if (barsRef.current === null) {
    barsRef.current = generateBars(BAR_COUNT);
  }
  const bars = barsRef.current;

  return (
    <div
      data-testid="waveform-bars"
      className={cn('flex items-end gap-[2px]', className)}
      aria-hidden="true"
    >
      {bars.map((height, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{
            height: `${height * 100}%`,
            backgroundColor: 'var(--cult-accent)',
            opacity: 0.6,
          }}
          data-testid="waveform-bar"
        />
      ))}
    </div>
  );
};
