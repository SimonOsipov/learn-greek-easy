// src/components/admin/MetaTable.tsx
//
// Shared meta-data table primitive used by Feedback (Meta tab) and
// Card Errors (Meta tab, CER-36). Renders label/value rows in a bordered
// grid layout using the admin-meta-* CSS class family.

import * as React from 'react';

export type MetaRow = { label: string; value: React.ReactNode };

export type MetaTableProps = {
  rows: MetaRow[];
  ariaLabel?: string;
};

export function MetaTable({ rows, ariaLabel }: MetaTableProps) {
  return (
    <div className="admin-meta-table" role="list" aria-label={ariaLabel}>
      {rows.map((row) => (
        <div key={row.label} className="admin-meta-row" role="listitem">
          <span className="admin-meta-l">{row.label}</span>
          <span className="admin-meta-v">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
