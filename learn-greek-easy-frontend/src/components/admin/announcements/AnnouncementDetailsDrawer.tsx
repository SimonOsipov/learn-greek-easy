// src/components/admin/announcements/AnnouncementDetailsDrawer.tsx

/**
 * AnnouncementDetailsDrawer
 *
 * Read-only SidePanel for viewing a single announcement's details.
 * Opens via row click in AnnouncementHistoryRows or via ?edit=<uuid> deep-link.
 *
 * Invariant: NO ConfirmDialog is rendered here. Delete confirm lives at tab level (ANND-07).
 */

import { useEffect } from 'react';

import { ExternalLink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidePanel } from '@/components/ui/side-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAdminAnnouncementStore } from '@/stores/adminAnnouncementStore';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AnnouncementDetailsDrawerProps {
  announcementId: string | null; // null → drawer closed
  onClose: () => void; // clears ?edit= in parent
  onRequestDelete: (id: string) => void; // calls tab-level confirm (ANND-07)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSentDate(dateString: string, locale: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Message card skeleton */}
      <div>
        <Skeleton className="mb-2 h-3 w-16" />
        <Skeleton className="h-32 w-full" />
      </div>
      {/* Stat tiles skeleton */}
      <div className="an-detail-stats">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      {/* Progress bar skeleton */}
      <div>
        <Skeleton className="mb-2 h-3 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AnnouncementDetailsDrawer({
  announcementId,
  onClose,
  onRequestDelete,
}: AnnouncementDetailsDrawerProps) {
  const { t, i18n } = useTranslation('admin');

  // Store subscriptions
  const selectedAnnouncement = useAdminAnnouncementStore((s) => s.selectedAnnouncement);
  const isLoadingDetail = useAdminAnnouncementStore((s) => s.isLoadingDetail);
  const error = useAdminAnnouncementStore((s) => s.error);
  const fetchAnnouncementDetail = useAdminAnnouncementStore((s) => s.fetchAnnouncementDetail);

  // Fetch when announcementId flips from null to a value
  useEffect(() => {
    if (announcementId) {
      fetchAnnouncementDetail(announcementId);
    }
  }, [announcementId, fetchAnnouncementDetail]);

  const isOpen = announcementId !== null;

  // Derived display values
  const announcement = selectedAnnouncement;
  const readPct = announcement
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round((announcement.read_count / Math.max(announcement.total_recipients, 1)) * 100)
        )
      )
    : 0;
  const sentDate = announcement ? formatSentDate(announcement.created_at, i18n.language) : '';
  const footerDate = announcement ? formatSentDate(announcement.created_at, i18n.language) : '';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <SidePanel
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        size="half"
        data-testid="announcement-details-drawer"
        title={announcement?.title ?? 'Announcement details'}
      >
        {/* ── Close button ─────────────────────────────────────────────── */}
        <SidePanel.CloseButton position="right" onClick={onClose} />

        {/* ── Header ───────────────────────────────────────────────────── */}
        <SidePanel.Header>
          <div className="drawer-head-content">
            <div className="drawer-breadcrumb">
              {t('announcements.history.title')}
              {announcement ? ` · ${t('announcements.v2.details.sent')} ${sentDate}` : ''}
            </div>
            <div className="drawer-head-row">
              <h2 className="drawer-title">{announcement ? announcement.title : ''}</h2>
            </div>
            {announcement && (
              <div className="drawer-meta">
                <Badge tone="green">{t('announcements.v2.details.delivered')}</Badge>
                <Badge tone={readPct >= 20 ? 'blue' : 'gray'}>
                  {readPct}% {t('announcements.v2.details.read')}
                </Badge>
              </div>
            )}
          </div>
        </SidePanel.Header>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <SidePanel.Body>
          <div className="an-detail-body">
            {isLoadingDetail ? (
              <DetailSkeleton />
            ) : error && !announcement ? (
              /* 404 / error state — no Retry, no toast, no redirect */
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t('announcements.detail.close')}
                </Button>
              </div>
            ) : announcement ? (
              <>
                {/* 1. Message block */}
                <div className="an-detail-msg">
                  <div className="an-detail-l">{t('announcements.v2.details.message')}</div>
                  <div className="an-detail-msg-box" style={{ whiteSpace: 'pre-wrap' }}>
                    {announcement.message}
                  </div>
                </div>

                {/* 2. Link block — only if link_url present */}
                {announcement.link_url && (
                  <div className="an-detail-msg" style={{ marginBottom: '18px' }}>
                    <div className="an-detail-l">{t('announcements.v2.details.linkUrl')}</div>
                    <a
                      href={announcement.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="an-detail-link"
                    >
                      {announcement.link_url}
                      <ExternalLink
                        className="ml-1 inline-block align-middle"
                        style={{ width: '12px', height: '12px' }}
                        aria-hidden="true"
                      />
                    </a>
                  </div>
                )}

                {/* 3. Reach section — 3 stat tiles */}
                <div style={{ marginBottom: '18px' }}>
                  <div className="an-detail-l">{t('announcements.v2.details.reach')}</div>
                  <div className="an-detail-stats">
                    {/* Sent to */}
                    <div className="an-stat">
                      <div className="an-stat-l">{t('announcements.v2.details.sentTo')}</div>
                      <div className="an-stat-n">{announcement.total_recipients}</div>
                      <div className="an-stat-sub">{t('announcements.v2.details.recipients')}</div>
                    </div>

                    {/* Read by */}
                    <div className="an-stat">
                      <div className="an-stat-l">{t('announcements.v2.details.readBy')}</div>
                      <div className="an-stat-n">{announcement.read_count}</div>
                      <div className="an-stat-sub">
                        ({readPct}%) &middot;{' '}
                        {announcement.total_recipients - announcement.read_count}{' '}
                        {t('announcements.v2.details.unread')}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </SidePanel.Body>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <SidePanel.Footer>
          {/* Left: dim helper */}
          <div className="drawer-foot-left">
            <span className="drawer-foot-helper">
              {announcement
                ? `${t('announcements.v2.details.announcementLabel')} #${announcement.id.slice(0, 8)} · ${t('announcements.v2.details.sent')} ${footerDate}`
                : ''}
            </span>
          </div>

          {/* Right: action buttons */}
          <div className="drawer-foot-right">
            {/* Delete — glass, danger text; parent owns ConfirmDialog */}
            <button
              type="button"
              className="btn btn-glass"
              style={{ color: 'hsl(var(--destructive))' }}
              onClick={() => {
                if (announcementId) onRequestDelete(announcementId);
              }}
              disabled={!announcement || isLoadingDetail}
              data-testid="announcement-details-delete-button"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t('announcements.delete.button')}
            </button>

            {/* Close — primary */}
            <Button
              type="button"
              variant="default"
              onClick={onClose}
              data-testid="announcement-details-close-button"
            >
              {t('announcements.detail.close')}
            </Button>
          </div>
        </SidePanel.Footer>
      </SidePanel>
    </TooltipProvider>
  );
}
