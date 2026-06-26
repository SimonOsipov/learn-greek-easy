// src/components/admin/announcements/AnnouncementComposeDrawer.tsx

/**
 * AnnouncementComposeDrawer
 *
 * Half-width SidePanel (size="half") for composing and sending announcements.
 * Replaces the v1 AnnouncementCreateModal + AnnouncementPreviewModal pair.
 *
 * Features:
 * - Form / JSON tab toggle with dirty-state guard on tab switch
 * - Live notification preview panel (form mode only)
 * - Audience picker (All learners active; 6 segments gated with Coming-soon)
 * - Schedule section (Send now active; Schedule-later gated with Coming-soon)
 * - Footer: Ready/Needs badge + Cancel / Save-draft (gated) / Send now
 * - Dirty-state guard on every close path (Cancel, ESC, click-outside, URL
 *   transition from ?compose=1 to ?edit=<id>)
 * - Submission lock while form.formState.isSubmitting
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { Bell, BellOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { SidePanel } from '@/components/ui/side-panel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';
import { useAdminAnnouncementStore } from '@/stores/adminAnnouncementStore';
import { useAdminTabCountsStore } from '@/stores/adminTabCountsStore';

import { AnnouncementCreateForm, useAnnouncementCreateForm } from './AnnouncementCreateForm';
import { AnnouncementJsonView } from './AnnouncementJsonView';
import { AnnouncementNotificationPreview } from './AnnouncementNotificationPreview';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AnnouncementComposeDrawerProps {
  open: boolean;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AnnouncementComposeDrawer({ open, onClose }: AnnouncementComposeDrawerProps) {
  const { t } = useTranslation('admin');
  const [searchParams, setSearchParams] = useSearchParams();
  const fetchAnnouncements = useAdminAnnouncementStore((s) => s.fetchAnnouncements);

  // ── Form instance (owned here, passed down) ──────────────────────────────
  const form = useAnnouncementCreateForm();

  // Single array-form watch — perf-critical (NOT three separate calls)
  const [title, message, linkUrl] = form.watch(['title', 'message', 'linkUrl']);

  // ── Tab / preview state ──────────────────────────────────────────────────
  const [tab, setTab] = useState<'form' | 'json'>('form');
  const [showPreview, setShowPreview] = useState(true);

  // ── Dirty-state ref ──────────────────────────────────────────────────────
  // JSON mode is now a read-only serialized view of the live form values
  // (ADMIN2-43-06, D15) — it has no editable state, so only the form can be
  // dirty.
  const formDirtyRef = useRef(false);

  // Track form dirty via react-hook-form
  useEffect(() => {
    formDirtyRef.current = form.formState.isDirty;
  }, [form.formState.isDirty]);

  // ── Pending state for the close-guard ConfirmDialog ──────────────────────
  const [pendingClose, setPendingClose] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const isDirty = useCallback(() => formDirtyRef.current, []);

  /** Reset all ephemeral state after successful close or submit */
  const resetAndClose = useCallback(() => {
    form.reset();
    setTab('form');
    formDirtyRef.current = false;
    setPendingClose(false);
    onClose();
  }, [form, onClose]);

  /** Intercept every close path */
  const requestClose = useCallback(() => {
    if (form.formState.isSubmitting) return;
    if (isDirty()) {
      setPendingClose(true);
    } else {
      resetAndClose();
    }
  }, [form.formState.isSubmitting, isDirty, resetAndClose]);

  // SidePanel onOpenChange fires false on ESC / click-outside
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) requestClose();
    },
    [requestClose]
  );

  // ── Tab switch ────────────────────────────────────────────────────────────
  // JSON mode is a read-only serialized view of the live form values (D15), so
  // switching tabs in either direction is non-destructive — no confirm needed.
  // The old mode-switch ConfirmDialog only ever guarded the now-removed JSON
  // paste path; it is unreachable with a read-only view and was removed
  // (ADMIN2-43-06). The dirty close/URL guards below still apply.

  const handleTabSwitch = (newTab: 'form' | 'json') => {
    if (newTab === tab) return;
    setTab(newTab);
  };

  // ── URL-transition dirty guard ────────────────────────────────────────────
  // If something navigates ?compose=1 → ?edit=<id> while composer is dirty,
  // intercept and optionally restore ?compose=1.
  const prevSearchParamsRef = useRef(searchParams.toString());
  useEffect(() => {
    const prev = prevSearchParamsRef.current;
    const curr = searchParams.toString();
    if (prev === curr) return;
    prevSearchParamsRef.current = curr;

    const hadCompose = new URLSearchParams(prev).get('compose') === '1';
    const nowHasEdit = searchParams.has('edit');
    const noLongerCompose = !searchParams.has('compose');

    if (hadCompose && noLongerCompose && nowHasEdit && isDirty()) {
      // Restore compose param before showing the guard
      setSearchParams(
        (p) => {
          p.set('compose', '1');
          return p;
        },
        { replace: true }
      );
      setPendingClose(true);
    }
  }, [searchParams, isDirty, setSearchParams]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await adminAPI.createAnnouncement({
        title: values.title,
        message: values.message,
        link_url: values.linkUrl || undefined,
      });
      toast({ title: t('announcements.create.success') });
      void useAdminTabCountsStore.getState().fetchCounts();
      await fetchAnnouncements(); // await before close — avoid stale list
      setSearchParams(
        (prev) => {
          prev.delete('compose');
          return prev;
        },
        { replace: true }
      );
      resetAndClose();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      toast({
        title: t('announcements.create.error'),
        description: errorMessage,
        variant: 'destructive',
      });
    }
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const isReady = Boolean(title?.trim() && message?.trim());
  const isSubmitting = form.formState.isSubmitting;
  const sendEnabled = form.formState.isValid && !isSubmitting;

  // ── Audience segment definitions ──────────────────────────────────────────
  const audienceSegments = [
    { key: 'premium', label: t('announcements.v2.compose.audience.premium') },
    { key: 'a1', label: 'A1' },
    { key: 'a2', label: 'A2' },
    { key: 'b1', label: 'B1' },
    { key: 'b2', label: 'B2' },
    { key: 'inactive', label: t('announcements.v2.compose.audience.inactive') },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <SidePanel
        open={open}
        onOpenChange={handleOpenChange}
        size="half"
        data-testid="announcement-compose-drawer"
        title="Compose announcement"
      >
        {/* ── Close button ─────────────────────────────────────────────── */}
        <SidePanel.CloseButton onClick={requestClose} />

        {/* ── Header ───────────────────────────────────────────────────── */}
        <SidePanel.Header>
          {/* Single stacked column (`.drawer-head-content`) is the lone child of the
              `space-between` `.drawer-head`, so it sits left and the close button sits
              right. Dropping breadcrumb/title/meta directly into `.drawer-head` (as
              before) made flexbox spread them across three columns. Matches the
              NewsEditDrawer convention and the prototype's single `<div>` wrapper. */}
          <div className="drawer-head-content">
            <div className="drawer-breadcrumb">{t('announcements.v2.compose.breadcrumb')}</div>
            <h2 className="drawer-title">{t('announcements.v2.compose.title')}</h2>
            <div className="drawer-meta flex flex-wrap items-center gap-2">
              <Badge tone="gray">{t('announcements.v2.compose.draftBadge')}</Badge>
              <span className="drawer-helper">{t('announcements.v2.compose.helper')}</span>
            </div>
          </div>
        </SidePanel.Header>

        {/* ── Tabs row ─────────────────────────────────────────────────── */}
        <SidePanel.Tabs>
          <div className="drawer-tabs-inner">
            {/* Form / JSON toggle */}
            <div className="drawer-tab-group" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'form'}
                className={tab === 'form' ? 'drawer-tab is-active' : 'drawer-tab'}
                onClick={() => handleTabSwitch('form')}
                data-testid="announcement-compose-tab-form"
              >
                {t('announcements.create.formTab')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'json'}
                className={tab === 'json' ? 'drawer-tab is-active' : 'drawer-tab'}
                onClick={() => handleTabSwitch('json')}
                data-testid="announcement-compose-tab-json"
              >
                {t('announcements.create.jsonTab')}
              </button>
            </div>

            {/* Preview toggle (right-aligned) */}
            <button
              type="button"
              className="drawer-preview-toggle"
              onClick={() => setShowPreview((v) => !v)}
              aria-pressed={showPreview}
              data-testid="announcement-compose-preview-toggle"
            >
              {showPreview ? (
                <>
                  <BellOff className="size-4" aria-hidden="true" />
                  <span>{t('announcements.v2.compose.hidePreview')}</span>
                </>
              ) : (
                <>
                  <Bell className="size-4" aria-hidden="true" />
                  <span>{t('announcements.v2.compose.showPreview')}</span>
                </>
              )}
            </button>
          </div>
        </SidePanel.Tabs>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <SidePanel.Body>
          <div
            className="an-compose-grid"
            {...(showPreview && tab === 'form' ? { 'data-preview': '1' } : {})}
          >
            {/* Left column: form / JSON */}
            <div className="an-compose-form an-compose-body">
              {tab === 'form' ? (
                <>
                  {/* Fields */}
                  <AnnouncementCreateForm form={form} />

                  {/* Audience picker */}
                  <div className="ann-section">
                    <h3 className="ann-section-h">
                      {t('announcements.v2.compose.audience.label')}
                    </h3>
                    <div className="ann-aud-grid">
                      {/* All learners — fully active */}
                      <button type="button" className="ann-aud-btn is-active" aria-pressed="true">
                        <span className="ann-aud-name">
                          {t('announcements.v2.compose.audience.allLearners')}
                        </span>
                      </button>

                      {/* Gated segments */}
                      {audienceSegments.map((seg) => (
                        <Tooltip key={seg.key}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="ann-aud-btn cursor-not-allowed opacity-60"
                              aria-disabled="true"
                              onClick={(e) => e.preventDefault()}
                            >
                              <span className="ann-aud-name">{seg.label}</span>
                              <span className="ann-counter">—</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t('comingSoon')}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>

                  {/* Schedule section */}
                  <div className="ann-section">
                    <h3 id="ann-schedule-label" className="ann-section-h">
                      {t('announcements.v2.compose.schedule.label')}
                    </h3>
                    <div
                      className="ann-sched"
                      role="radiogroup"
                      aria-labelledby="ann-schedule-label"
                    >
                      {/* Send now — active */}
                      <div
                        className="ann-sched-opt is-active"
                        aria-checked="true"
                        role="radio"
                        tabIndex={0}
                      >
                        {t('announcements.v2.compose.schedule.sendNow')}
                      </div>

                      {/* Schedule for later — gated */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="ann-sched-opt cursor-not-allowed opacity-60"
                            role="radio"
                            aria-checked="false"
                            aria-disabled="true"
                            tabIndex={0}
                            onClick={(e) => e.preventDefault()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
                            }}
                          >
                            {t('announcements.v2.compose.schedule.scheduleLater')}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{t('comingSoon')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </>
              ) : (
                <AnnouncementJsonView
                  title={title ?? ''}
                  message={message ?? ''}
                  linkUrl={linkUrl ?? ''}
                />
              )}
            </div>

            {/* Right column: live notification preview — form mode only. In JSON
                mode there is nothing to preview, so the pane (and its grid column)
                is omitted entirely, leaving the raw-payload field full-width. */}
            {showPreview && tab === 'form' && (
              <div className="an-compose-preview">
                <AnnouncementNotificationPreview
                  title={title ?? ''}
                  message={message ?? ''}
                  linkUrl={linkUrl ?? ''}
                />
              </div>
            )}
          </div>
        </SidePanel.Body>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <SidePanel.Footer>
          {/* Left: readiness status badge. The verbose "sending to … · immediately"
              helper was dropped — it never fit on one row beside the badge + 3
              buttons in the ≤720px half-drawer (worst case RU), and the same
              audience/schedule is already surfaced in the body's Audience +
              Schedule sections and the preview pane. */}
          <div className="drawer-foot-left">
            <Badge tone={isReady ? 'green' : 'gray'}>
              {isReady
                ? t('announcements.v2.compose.footer.ready')
                : t('announcements.v2.compose.footer.needsTitleAndMessage')}
            </Badge>
          </div>

          {/* Right: action buttons — design-system `.btn` classes (`btn-sm`) to
              match the CD prototype exactly: ghost Cancel, glass Save-draft,
              primary Send-now with a bell. Raw <button>s (not the shadcn
              <Button>) so the compact 32px `btn-sm` sizing + gradient/glow
              primary render pixel-for-pixel like the prototype. */}
          <div className="drawer-foot-right">
            {/* Cancel */}
            <button
              type="button"
              className="btn btn-ghost btn-sm disabled:cursor-not-allowed disabled:opacity-50"
              onClick={requestClose}
              disabled={isSubmitting}
              data-testid="announcement-compose-cancel-button"
            >
              {t('announcements.v2.compose.footer.cancel')}
            </button>

            {/* Save draft — gated Coming-soon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="btn btn-glass btn-sm cursor-not-allowed opacity-60"
                  aria-disabled="true"
                  onClick={(e) => e.preventDefault()}
                >
                  {t('announcements.v2.compose.footer.saveDraft')}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('comingSoon')}</TooltipContent>
            </Tooltip>

            {/* Send now */}
            <button
              type="button"
              className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
              aria-disabled={!sendEnabled}
              disabled={!sendEnabled}
              onClick={sendEnabled ? onSubmit : undefined}
              data-testid="announcement-compose-send-button"
            >
              <Bell className="size-4" aria-hidden="true" />
              {isSubmitting
                ? t('announcements.v2.compose.footer.sending')
                : t('announcements.v2.compose.footer.sendNow')}
            </button>
          </div>
        </SidePanel.Footer>
      </SidePanel>

      {/* Close guard confirm dialog */}
      <ConfirmDialog
        open={pendingClose}
        onOpenChange={(o) => {
          if (!o) setPendingClose(false);
        }}
        title={t('announcements.create.unsavedTitle')}
        description={t('announcements.create.unsavedDescription')}
        onConfirm={resetAndClose}
        onCancel={() => setPendingClose(false)}
      />
    </TooltipProvider>
  );
}
