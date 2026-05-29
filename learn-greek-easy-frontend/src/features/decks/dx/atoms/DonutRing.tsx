export interface DonutRingProps {
  done: number;
  total: number;
  label?: string;
}

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * DonutRing — SVG progress ring showing done/total ratio.
 * Stroke references #dxringGrad defined in DxSvgDefs (mounted once at route root).
 *
 * NaN guard: when total=0, pct=0 (empty ring, no NaN).
 * Formula: pct = total > 0 ? clamp(done/total, 0, 1) : 0
 */
export function DonutRing({ done, total, label = 'mastered' }: DonutRingProps) {
  const pct = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
  const offset = CIRCUMFERENCE * (1 - pct);

  return (
    <div className="dx-ring">
      <svg className="dx-ring-svg" viewBox="0 0 84 84" aria-hidden="true">
        <circle className="dx-ring-track" cx="42" cy="42" r={RADIUS} />
        <circle
          className="dx-ring-fill"
          cx="42"
          cy="42"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          stroke="url(#dxringGrad)"
        />
      </svg>
      <div className="dx-ring-center">
        <b>
          {done}
          <small>/{total}</small>
        </b>
        <span>{label}</span>
      </div>
    </div>
  );
}
