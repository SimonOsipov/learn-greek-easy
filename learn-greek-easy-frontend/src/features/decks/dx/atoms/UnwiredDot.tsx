import React from 'react';

export interface UnwiredDotProps {
  /** 'danger' (default) → --danger red; 'amber' → --warning amber */
  tone?: 'danger' | 'amber';
  children?: React.ReactNode;
  'aria-label'?: string;
}

/**
 * UnwiredDot — 8px indicator dot positioned top-right.
 * Signals that a metric or section is not yet connected to backend data.
 * The visual dot is aria-hidden; the wrapper carries the descriptive aria-label.
 * Pass `aria-label` to override the generic placeholder string with a specific one.
 */
export function UnwiredDot({
  tone = 'danger',
  children,
  'aria-label': ariaLabel = 'Placeholder — not yet connected to backend data.',
}: UnwiredDotProps) {
  return (
    <span className="dx-unwired-dot" aria-label={ariaLabel} data-testid="unwired-dot">
      {children}
      <span
        className="dx-unwired-dot-marker"
        data-tone={tone === 'amber' ? 'amber' : undefined}
        aria-hidden="true"
      />
    </span>
  );
}
