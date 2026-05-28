import React from 'react';

export type DxTone = 'primary' | 'violet' | 'cyan' | 'amber' | 'green' | 'white';

export interface KickerProps {
  tone?: DxTone;
  children: React.ReactNode;
  className?: string;
}

/**
 * Kicker — uppercase mono eyebrow label with a coloured dot ::before.
 * Pure presentational; tone drives `data-tone` → CSS handles the ::before colour.
 */
export function Kicker({ tone = 'primary', children, className }: KickerProps) {
  return (
    <span className={`dx-kicker${className ? ` ${className}` : ''}`} data-tone={tone}>
      {children}
    </span>
  );
}
