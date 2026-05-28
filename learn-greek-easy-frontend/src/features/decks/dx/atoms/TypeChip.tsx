import React from 'react';

import type { DxTone } from './Kicker';

export interface TypeChipProps {
  tone?: DxTone;
  children: React.ReactNode;
}

/**
 * TypeChip — tiny uppercase mono pill for content-type labelling.
 * Pure presentational; tone drives `data-tone` → CSS handles background/colour.
 */
export function TypeChip({ tone, children }: TypeChipProps) {
  return (
    <span className="dx-type-chip" data-tone={tone}>
      {children}
    </span>
  );
}
