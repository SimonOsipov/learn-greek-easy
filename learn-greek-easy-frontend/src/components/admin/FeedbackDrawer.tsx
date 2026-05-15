// src/components/admin/FeedbackDrawer.tsx
//
// Shell component for the ADMIN2-05 Feedback Drawer.
// Inner tab content is implemented in subsequent subtasks:
//   FBDR-04 → Reply tab
//   FBDR-05 → Thread tab
//   FBDR-06 → Meta tab
// URL deep-link wiring (useSearchParams) is implemented in FBDR-09.

import { SidePanel } from '@/components/ui/side-panel';

// ── Types ──────────────────────────────────────────────────────────────────────

export type FeedbackDrawerInnerTab = 'reply' | 'thread' | 'meta';

export interface FeedbackDrawerProps {
  feedbackId: string;
  innerTab: FeedbackDrawerInnerTab;
  onClose: () => void;
  onInnerTabChange: (tab: FeedbackDrawerInnerTab) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS: { value: FeedbackDrawerInnerTab; label: string }[] = [
  { value: 'reply', label: 'Reply' },
  { value: 'thread', label: 'Thread' },
  { value: 'meta', label: 'Meta' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function FeedbackDrawer({
  feedbackId,
  innerTab,
  onClose,
  onInnerTabChange,
}: FeedbackDrawerProps) {
  return (
    <SidePanel
      size="default"
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      data-testid="feedback-drawer"
    >
      <SidePanel.CloseButton onClick={onClose} />

      <SidePanel.Header>
        <div className="text-sm text-muted-foreground">Feedback · #{feedbackId.slice(0, 8)}</div>
      </SidePanel.Header>

      <SidePanel.Tabs>
        <div className="drawer-tab-group" role="tablist">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={innerTab === value}
              className={innerTab === value ? 'drawer-tab is-active' : 'drawer-tab'}
              onClick={() => onInnerTabChange(value)}
              data-testid={`feedback-drawer-tab-${value}`}
            >
              {label}
            </button>
          ))}
        </div>
      </SidePanel.Tabs>

      <SidePanel.Body>
        {innerTab === 'reply' && (
          <div data-testid="drawer-tab-reply">Reply tab — implemented in FBDR-04</div>
        )}
        {innerTab === 'thread' && (
          <div data-testid="drawer-tab-thread">Thread tab — implemented in FBDR-05</div>
        )}
        {innerTab === 'meta' && (
          <div data-testid="drawer-tab-meta">Meta tab — implemented in FBDR-06</div>
        )}
      </SidePanel.Body>

      <SidePanel.Footer>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </SidePanel.Footer>
    </SidePanel>
  );
}
