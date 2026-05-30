// src/components/culture/redesign/CultureMetricStrip.tsx
//
// 4-up metric card strip for Culture screens.
// Mirrors DxMetricStrip's class structure (dx-metrics / dx-metric / dx-metric-icon / dx-metric-body).
// Each metric accepts an `unwired` prop; when true wraps the value in <UnwiredDot tone="danger">.

import React from 'react';

import { UnwiredDot } from '@/features/decks/dx';
import type { DxTone } from '@/features/decks/dx';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface CultureMetric {
  /** Lucide icon or any svg element */
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** Small sub-value suffix (e.g. "days", "min") */
  sub?: string;
  /** Optional trend line below the value */
  trend?: string;
  trendFlat?: boolean;
  /** Card tone — drives .dx-metric data-tone */
  tone?: DxTone | 'green';
  /**
   * When true wraps `value` in <UnwiredDot tone="danger"> to signal
   * the metric is not yet connected to a backend source.
   */
  unwired?: boolean;
  /** Accessible label for the UnwiredDot — overrides the default generic one */
  unwiredLabel?: string;
}

export interface CultureMetricStripProps {
  metrics: CultureMetric[];
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function CultureMetricStrip({ metrics }: CultureMetricStripProps) {
  return (
    <div className="dx-metrics" data-testid="culture-metric-strip">
      {metrics.map((m, i) => (
        <div
          key={i}
          className="dx-metric"
          data-tone={m.tone ?? 'primary'}
          data-testid={`culture-metric-${i}`}
        >
          <div className="dx-metric-icon">{m.icon}</div>
          <div className="dx-metric-body">
            <div className="dx-metric-l">{m.label}</div>
            <div className="dx-metric-v">
              {m.unwired ? (
                <UnwiredDot tone="danger" aria-label={m.unwiredLabel}>
                  {m.value}
                </UnwiredDot>
              ) : (
                m.value
              )}
              {m.sub && <small>{m.sub}</small>}
            </div>
            {m.trend && (
              <div className={`dx-metric-trend${m.trendFlat ? 'is-flat' : ''}`}>{m.trend}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
