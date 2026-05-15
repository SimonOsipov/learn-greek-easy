// src/pages/admin/InboxView.tsx

import { useTranslation } from 'react-i18next';

/**
 * Inbox tab body shell. Renders body only — `<PageHead>` is rendered once
 * by `AdminPage` via `pageHeadPropsFor('inbox', t)` (extended in INBPH-02),
 * and `<SectionTabs>` is rendered once by the admin shell.
 *
 * The two empty `<section>` slots are filled in by INBPH-04:
 *   - `.stat-grid`     -> 4 `StatCard`s (Open items / Feedback / Drafts / Errors)
 *   - `.attention-card` -> panel header (H2 + sub + `SegControl`) + empty state
 *
 * No data fetch. No `useQuery`. No `fetch`. All counts are hardcoded zeros
 * once INBPH-04 lands.
 */
export default function InboxView() {
  // `_t` is reserved for INBPH-04 (stat-card titles/subs, panel header, empty state).
  // Calling `useTranslation('admin')` here in INBPH-03 keeps the hook contract
  // stable across subtasks and avoids a churny diff in INBPH-04.
  // The underscore prefix satisfies noUnusedLocals until INBPH-04 consumes it.
  const { t: _t } = useTranslation('admin');

  return (
    <div>
      <section className="stat-grid" />
      <section className="attention-card" />
    </div>
  );
}
