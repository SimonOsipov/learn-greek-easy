import React from 'react';

export interface UnwiredDotProps {
  /** 'danger' (default) → --danger red; 'amber' → --warning amber */
  tone?: 'danger' | 'amber';
  children?: React.ReactNode;
}

/**
 * UnwiredDot — 8px indicator dot positioned top-right.
 * Signals that a metric or section is not yet connected to backend data.
 * The visual dot is aria-hidden; the wrapper carries the descriptive aria-label.
 */
export function UnwiredDot({ tone = 'danger', children }: UnwiredDotProps) {
  return (
    <span className="dx-unwired-dot" aria-label="Placeholder — not yet connected to backend data.">
      {children}
      <span
        className="dx-unwired-dot-marker"
        data-tone={tone === 'amber' ? 'amber' : undefined}
        aria-hidden="true"
      />
    </span>
  );
}
