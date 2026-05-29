/**
 * DxSvgDefs — emits exactly ONE SVG <defs> block with the shared #dxringGrad gradient.
 * Mount ONCE at the decks route root (e.g. in the route layout component).
 * Do NOT render per-DonutRing to avoid duplicate-id warnings.
 */
export function DxSvgDefs() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dxringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--accent))" />
        </linearGradient>
      </defs>
    </svg>
  );
}
