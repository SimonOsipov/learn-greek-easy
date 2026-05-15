// src/components/admin/announcements/AnnouncementsTab.tsx

/**
 * AnnouncementsTab — ANND-07 rewrite
 *
 * Integration choke point for ADMIN2-04.
 * Renders PageHead + 4-up StatCard grid + AnnouncementHistoryRows +
 * AnnouncementComposeDrawer + AnnouncementDetailsDrawer.
 *
 * V1 modal imports (SummaryCard, AnnouncementCreateModal,
 * AnnouncementPreviewModal, AnnouncementDetailModal, AnnouncementHistoryTable)
 * are dropped. V1 source files stay on disk — deferred to ADMIN2-12.
 *
 * Mobile responsiveness of PageHead actions is deferred to ADMIN2-12.
 */

import React, { useEffect, useRef, useState } from 'react';

import { Download, Link, Megaphone, Plus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { PageHead } from '@/components/admin/shell/page-head';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { StatCard } from '@/components/ui/stat-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminAnnouncementStore } from '@/stores/adminAnnouncementStore';

import { AnnouncementComposeDrawer } from './AnnouncementComposeDrawer';
import { AnnouncementDetailsDrawer } from './AnnouncementDetailsDrawer';
import { AnnouncementHistoryRows } from './AnnouncementHistoryRows';

/**
 * AnnouncementsTab
 */
export const AnnouncementsTab: React.FC = () => {
  const { t } = useTranslation('admin');

  // ── Store ─────────────────────────────────────────────────────────────────
  const {
    announcements,
    total,
    page,
    totalPages,
    isLoading,
    fetchAnnouncements,
    deleteAnnouncement,
    setPage,
  } = useAdminAnnouncementStore();

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // ── URL state ─────────────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const composeOpen = searchParams.get('compose') === '1';
  const editId = searchParams.get('edit');

  // ── Idempotency guard (CRITICAL — from QA fix, tested in ANND-09) ────────
  // When both ?compose=1 and ?edit=<uuid> are present, edit wins — strip compose.
  // The ref prevents re-stripping after the setSearchParams-triggered re-render,
  // which would otherwise cause fetchAnnouncementDetail to fire twice.
  const hasStrippedRef = useRef(false);
  useEffect(() => {
    if (composeOpen && editId && !hasStrippedRef.current) {
      hasStrippedRef.current = true;
      setSearchParams(
        (prev) => {
          prev.delete('compose');
          return prev;
        },
        { replace: true }
      );
    }
  }, [composeOpen, editId, setSearchParams]);

  // ── Local delete state ────────────────────────────────────────────────────
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalCount = total;

  const peopleReached = announcements.reduce((sum, a) => sum + (a.total_recipients ?? 0), 0);

  const totalReadCount = announcements.reduce((sum, a) => sum + (a.read_count ?? 0), 0);
  const totalRecipients = announcements.reduce((sum, a) => sum + (a.total_recipients ?? 0), 0);
  const avgReadRate =
    totalRecipients > 0 ? Math.round((totalReadCount / totalRecipients) * 100) : 0;

  const withLinkCount = announcements.filter((a) => a.link_url != null && a.link_url !== '').length;

  const readRateTone = avgReadRate >= 20 ? 'green' : 'amber';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="announcements-tab">
      {/* ── Page Head ────────────────────────────────────────────────────── */}
      <PageHead
        breadcrumb={[
          { label: t('inbox.breadcrumb.dashboard') },
          { label: t('announcements.title') },
        ]}
        kicker={<Kicker dot="primary">{t('announcements.kicker')}</Kicker>}
        title={t('announcements.title')}
        sub={t('announcements.v2.tab.subtitle', {
          avgRate: avgReadRate,
          count: totalCount,
        })}
        actions={
          <TooltipProvider>
            <div className="flex items-center gap-2">
              {/* Export CSV — gated Coming-soon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-disabled="true"
                    className="btn-glass cursor-not-allowed opacity-60"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    {t('announcements.actions.exportCsv')}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('announcements.v2.comingSoon')}</TooltipContent>
              </Tooltip>

              {/* New announcement — primary, fully enabled */}
              <Button
                variant="default"
                onClick={() =>
                  setSearchParams((prev) => {
                    prev.set('compose', '1');
                    return prev;
                  })
                }
                data-testid="announcements-new-button"
              >
                <Plus className="size-4" aria-hidden="true" />
                {t('announcements.actions.new')}
              </Button>
            </div>
          </TooltipProvider>
        }
      />

      {/* ── 4-up StatCard grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('announcements.stats.total')}
          n={totalCount}
          icon={<Megaphone />}
          tone="blue"
          footerLabel={t('announcements.stats.allTime')}
        />
        <StatCard
          title={t('announcements.stats.peopleReached')}
          n={peopleReached}
          icon={<Users />}
          tone="cyan"
          footerLabel={t('announcements.stats.allTime')}
        />
        <StatCard
          title={t('announcements.stats.avgReadRate')}
          n={`${avgReadRate}%`}
          icon={<Megaphone />}
          tone={readRateTone}
          footerLabel={t('announcements.stats.acrossAll')}
        />
        <StatCard
          title={t('announcements.stats.withLink')}
          n={withLinkCount}
          icon={<Link />}
          tone="violet"
          footerLabel={t('announcements.stats.allTime')}
        />
      </div>

      {/* ── History rows ─────────────────────────────────────────────────── */}
      <AnnouncementHistoryRows
        announcements={announcements}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
        onOpenDetails={(id) =>
          setSearchParams((prev) => {
            prev.set('edit', id);
            return prev;
          })
        }
        onRequestDelete={(id) => setDeleteCandidateId(id)}
      />

      {/* ── Compose drawer ───────────────────────────────────────────────── */}
      <AnnouncementComposeDrawer
        open={composeOpen && !editId}
        onClose={() =>
          setSearchParams(
            (prev) => {
              prev.delete('compose');
              return prev;
            },
            { replace: true }
          )
        }
      />

      {/* ── Details drawer ───────────────────────────────────────────────── */}
      <AnnouncementDetailsDrawer
        announcementId={editId ?? null}
        onClose={() =>
          setSearchParams(
            (prev) => {
              prev.delete('edit');
              return prev;
            },
            { replace: true }
          )
        }
        onRequestDelete={(id) => setDeleteCandidateId(id)}
      />

      {/* ── Tab-level delete ConfirmDialog ───────────────────────────────── */}
      <ConfirmDialog
        open={deleteCandidateId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidateId(null);
        }}
        title={t('announcements.delete.title')}
        description={t('announcements.delete.warning')}
        confirmText={t('announcements.delete.confirm')}
        variant="destructive"
        onConfirm={async () => {
          if (!deleteCandidateId) return;
          await deleteAnnouncement(deleteCandidateId);
          // If the deleted announcement was open in the details drawer, close it
          if (deleteCandidateId === editId) {
            setSearchParams(
              (prev) => {
                prev.delete('edit');
                return prev;
              },
              { replace: true }
            );
          }
          setDeleteCandidateId(null);
        }}
      />
    </div>
  );
};
