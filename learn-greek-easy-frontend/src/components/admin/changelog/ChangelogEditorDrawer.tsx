// src/components/admin/changelog/ChangelogEditorDrawer.tsx

/**
 * ChangelogEditorDrawer
 *
 * Shell drawer for creating/editing changelog entries. Built on the SidePanel
 * atom. Contains placeholder tabs (Form/JSON mode toggle, EN/RU language) and
 * empty body/footer containers — form logic lands in subsequent subtasks.
 */

import { useCallback } from 'react';

import { SidePanel } from '@/components/ui/side-panel';
import type { ChangelogEntryAdmin } from '@/types/changelog';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChangelogEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  entry?: ChangelogEntryAdmin;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ChangelogEditorDrawer({ open, onClose, entry }: ChangelogEditorDrawerProps) {
  // Bridge SidePanel's onOpenChange(boolean) API to caller's onClose() API,
  // mirroring the pattern in AnnouncementComposeDrawer.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onClose();
    },
    [onClose]
  );

  const title = entry ? 'Edit entry' : 'New entry';

  return (
    <SidePanel open={open} onOpenChange={handleOpenChange} data-testid="changelog-editor-drawer">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <SidePanel.Header>
        <div className="drawer-breadcrumb">Changelog</div>
        <div className="drawer-head-row">
          <h2 className="drawer-title">{title}</h2>
        </div>
        <SidePanel.CloseButton data-testid="changelog-editor-close-button" />
      </SidePanel.Header>

      {/* ── Tabs row ───────────────────────────────────────────────────── */}
      <SidePanel.Tabs>
        <div className="drawer-tabs-inner">
          {/* Left: Form / JSON mode toggle */}
          <div className="drawer-tab-group" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={true}
              className="drawer-tab is-active"
              data-testid="changelog-editor-tab-form"
            >
              Form
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={false}
              className="drawer-tab"
              data-testid="changelog-editor-tab-json"
            >
              JSON
            </button>
          </div>

          {/* Right: EN / RU language tabs */}
          <div className="drawer-tab-group" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={true}
              className="drawer-tab is-active"
              data-testid="changelog-editor-tab-en"
            >
              EN
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={false}
              className="drawer-tab"
              data-testid="changelog-editor-tab-ru"
            >
              RU
            </button>
          </div>
        </div>
      </SidePanel.Tabs>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <SidePanel.Body>
        <div data-testid="changelog-drawer-body" />
      </SidePanel.Body>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <SidePanel.Footer>
        <div data-testid="changelog-drawer-footer" />
      </SidePanel.Footer>
    </SidePanel>
  );
}
