// src/components/admin/CannedReplyPills.tsx
//
// Stateless presentational component that renders a labeled row of quick-
// response pills. Clicking a pill calls onSelect(pill.body) — the caller
// (e.g. CER-32) decides whether to replace, append, or prepend the body
// into their textarea. This component holds no internal state.

import type { FC } from 'react';

export type Pill = {
  key: string;
  label: string;
  body: string;
};

export type CannedReplyPillsProps = {
  pills: Pill[];
  /** Called with (body, key) when a pill is clicked */
  onSelect: (body: string, key: string) => void;
  label?: string;
};

const CannedReplyPills: FC<CannedReplyPillsProps> = ({
  pills,
  onSelect,
  label = 'Quick responses',
}) => (
  <div className="admin-canned">
    <div className="admin-canned-label">{label}</div>
    <div className="admin-canned-row">
      {pills.map((p) => (
        <button
          key={p.key}
          type="button"
          className="admin-canned-pill"
          onClick={() => onSelect(p.body, p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  </div>
);

export default CannedReplyPills;
