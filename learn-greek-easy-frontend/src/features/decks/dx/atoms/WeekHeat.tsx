export interface WeekHeatProps {
  /** 7-element array; values clamped to 0–5 */
  heat?: number[];
  /** Index 0–6 of "today"; outlined with a focus ring */
  todayIdx?: number;
  label?: string;
  /** Per-cell letters for title/aria. Defaults to Mon–Sun; pass the actual
   *  weekday initials for a rolling (non-calendar-week) window. */
  dayLabels?: string[];
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // getUTCDay(): Sun=0

/**
 * Weekday initials for a rolling 7-day window ending today (UTC), oldest first.
 * Index 6 is today. Computed in UTC to match backend UTC date bucketing.
 * Pass to WeekHeat's `dayLabels` for rolling (non-calendar-week) windows.
 */
export function rollingDayLabels(): string[] {
  const now = new Date();
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayMs = 24 * 60 * 60 * 1000;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayUtcMs - (6 - i) * dayMs);
    return WEEKDAY_INITIALS[d.getUTCDay()];
  });
}

/**
 * WeekHeat — 7-cell heatmap.
 * Renders EXACTLY 7 cells regardless of heat array length (pad/slice).
 * Per-cell data-h clamped to 0..5 so CSS selector coverage is complete.
 */
export function WeekHeat({
  heat = [0, 0, 0, 0, 0, 0, 0],
  todayIdx,
  label = 'This week',
  dayLabels = DAY_LABELS,
}: WeekHeatProps) {
  // Ensure exactly 7 cells
  const cells = Array.from({ length: 7 }, (_, i) => {
    const raw = heat[i] ?? 0;
    return Math.max(0, Math.min(5, Math.floor(raw)));
  });

  return (
    <div className="dx-week">
      <span className="dx-week-l">{label}</span>
      {cells.map((h, i) => (
        <span
          key={i}
          className={['dx-week-cell', i === todayIdx ? 'dx-week-today' : '']
            .filter(Boolean)
            .join(' ')}
          data-h={h}
          title={`${dayLabels[i] ?? ''} · ${h} session${h === 1 ? '' : 's'}`}
          aria-label={`${dayLabels[i] ?? ''}: ${h} session${h === 1 ? '' : 's'}${i === todayIdx ? ' (today)' : ''}`}
        />
      ))}
    </div>
  );
}
