// src/components/situations/SituationTopicCatRow.tsx
//
// SIT-27-10: One per-topic confidence bar for the comprehension overview.
//
// Thin wrapper around the shared `.cx-cat-row` markup (label · bar · meta) used
// by the culture-readiness CategoryPanel. The bar tone is driven by confidence:
//   < 40  → 'danger'  (uses the .cx-cat-bar[data-tone='danger'] rule from SIT-27-01)
//   < 60  → 'warning'
//   ≥ 60  → 'success'
//
// Accuracy is null until the topic has at least one reviewed exercise — in that
// case the meta line shows "No attempts yet" (NOT 0%), honouring the empty state.

import React from 'react';

import { useTranslation } from 'react-i18next';

type CatTone = 'danger' | 'warning' | 'success';

/** Confidence → bar tone. Danger threshold is < 40 (SIT-27-10 AC-1). */
export function topicConfidenceTone(confidence: number): CatTone {
  if (confidence >= 60) return 'success';
  if (confidence >= 40) return 'warning';
  return 'danger';
}

export interface SituationTopicCatRowProps {
  /** Human-facing topic label (already localized by the caller). */
  label: string;
  /** Weighted SRS-stage confidence 0-100 for this topic. */
  confidence: number;
  /** Review accuracy 0-100; null when the topic has no attempts yet. */
  accuracy: number | null;
  /** Coloured dot tone for the label (cycles through the cx-cat-l tones). */
  dotTone?: 'amber' | 'primary' | 'green';
  /** data-testid placed on the row container. */
  testId?: string;
}

export const SituationTopicCatRow: React.FC<SituationTopicCatRowProps> = ({
  label,
  confidence,
  accuracy,
  dotTone,
  testId,
}) => {
  const { t } = useTranslation('common');
  const tone = topicConfidenceTone(confidence);

  return (
    <div className="cx-cat-row" data-testid={testId}>
      <div className="cx-cat-l" data-tone={dotTone}>
        {label}
      </div>
      {/* min-width keeps a 0% bar visible; mirrors the readiness CategoryPanel. */}
      <div className="cx-cat-bar" data-tone={tone}>
        <span style={{ width: `${Math.max(confidence, 1)}%` }} />
      </div>
      <div className="cx-cat-meta">
        <span className="cx-cat-pct">{Math.round(confidence)}%</span>
        <span
          className="cx-cat-accuracy"
          data-tone={accuracy !== null ? tone : undefined}
          data-testid={testId ? `${testId}-accuracy` : undefined}
        >
          {accuracy !== null
            ? t('situations.comprehension.topicAccuracy', {
                pct: Math.round(accuracy),
                defaultValue: 'Accuracy: {{pct}}%',
              })
            : t('situations.comprehension.noAttempts', 'No attempts yet')}
        </span>
      </div>
    </div>
  );
};
