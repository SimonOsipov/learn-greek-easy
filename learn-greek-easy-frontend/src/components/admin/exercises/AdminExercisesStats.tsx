/**
 * EXR-19f: when this is built out in Cluster G, pass bars={[]} (or omit `bars`) to <StatCard>
 * whenever the underlying data is empty / single-bucket / missing. The primitive hides the
 * .stat-bars row entirely in that case (stat-card.tsx:35-37) — do NOT render flat muted bars.
 */
export function AdminExercisesStats({ modality }: { modality: 'listening' | 'reading' }) {
  void modality;
  return null;
}
