export interface WeekHeatProps {
  /** 7-element array; values clamped to 0–5 */
  heat?: number[];
  /** Index 0–6 of "today" (Mon=0, Sun=6); outlined with a focus ring */
  todayIdx?: number;
  label?: string;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * WeekHeat — 7-cell Mon–Sun heatmap.
 * Renders EXACTLY 7 cells regardless of heat array length (pad/slice).
 * Per-cell data-h clamped to 0..5 so CSS selector coverage is complete.
 */
export function WeekHeat({
  heat = [0, 0, 0, 0, 0, 0, 0],
  todayIdx,
  label = 'This week',
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
          title={`${DAY_LABELS[i]} · ${h} session${h === 1 ? '' : 's'}`}
          aria-label={`${DAY_LABELS[i]}: ${h} sessions${i === todayIdx ? ' (today)' : ''}`}
        />
      ))}
    </div>
  );
}
