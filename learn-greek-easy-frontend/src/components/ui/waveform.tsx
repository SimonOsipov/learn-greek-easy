import { cn } from '@/lib/utils';

export type WaveformProps = {
  bars: 24 | 60;
  progressPct?: number;
  className?: string;
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

function Waveform({ bars, progressPct, className }: WaveformProps) {
  const spans = Array.from({ length: bars }, (_, k) => {
    const heightPx = bars === 24 ? 4 + ((k * 5) % 12) : 6 + ((k * 7) % 18);
    return <span key={k} className="audio-wave" style={{ height: heightPx + 'px' }} />;
  });

  return (
    <div className={cn('audio-track', className)} aria-hidden="true">
      {spans}
      {progressPct !== undefined && (
        <div className="audio-progress" style={{ width: clamp(progressPct) + '%' }} />
      )}
    </div>
  );
}

export { Waveform };
