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

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Megaphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { StatCard } from '@/components/ui/stat-card';
import { useAdminAnnouncementStore } from '@/stores/adminAnnouncementStore';

import { AnnouncementComposeDrawer } from './AnnouncementComposeDrawer';
import { AnnouncementDetailsDrawer } from './AnnouncementDetailsDrawer';
import { AnnouncementHistoryRows } from './AnnouncementHistoryRows';
import {
  ANNOUNCEMENTS_CLIENT_FETCH_PAGE_SIZE,
  AVG_READ_RATE_HEALTHY_THRESHOLD,
} from './announcementsConstants';
import { AnnouncementsToolbar, type SortKey } from './AnnouncementsToolbar';

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
    fetchAnnouncements(1, ANNOUNCEMENTS_CLIENT_FETCH_PAGE_SIZE);
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

  // ── Toolbar state ─────────────────────────────────────────────────────────
  const [query, setQuery] = useState<string>('');
  const [sort, setSort] = useState<SortKey>('newest');

  // ── Filtered + sorted announcements ──────────────────────────────────────
  const displayedAnnouncements = useMemo(() => {
    const trimmed = query.trim();
    const q = trimmed.toLowerCase();
    const filtered = trimmed
      ? announcements.filter((a) => a.title.toLowerCase().includes(q))
      : announcements;

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'rateDesc': {
          const rA = a.total_recipients > 0 ? a.read_count / a.total_recipients : 0;
          const rB = b.total_recipients > 0 ? b.read_count / b.total_recipients : 0;
          return rB - rA;
        }
        case 'rateAsc': {
          const rA = a.total_recipients > 0 ? a.read_count / a.total_recipients : 0;
          const rB = b.total_recipients > 0 ? b.read_count / b.total_recipients : 0;
          return rA - rB;
        }
        default:
          return 0;
      }
    });
  }, [announcements, query, sort]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalCount = total;

  const totalReadCount = announcements.reduce((sum, a) => sum + (a.read_count ?? 0), 0);
  const totalRecipients = announcements.reduce((sum, a) => sum + (a.total_recipients ?? 0), 0);
  const avgReadRate =
    totalRecipients > 0 ? Math.round((totalReadCount / totalRecipients) * 100) : 0;

  const readRateTone = avgReadRate >= AVG_READ_RATE_HEALTHY_THRESHOLD ? 'green' : 'amber';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="announcements-tab">
      {/* ── 2-up StatCard grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title={t('announcements.stats.total')}
          n={totalCount}
          icon={<Megaphone />}
          tone="blue"
          footerLabel={t('announcements.stats.allTime')}
        />
        <StatCard
          title={t('announcements.stats.avgReadRate')}
          n={`${avgReadRate}%`}
          icon={<Megaphone />}
          tone={readRateTone}
          footerLabel={t('announcements.stats.acrossAll')}
        />
      </div>

      {/* ── History rows ─────────────────────────────────────────────────── */}
      <div className="va-panel">
        <AnnouncementsToolbar
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
        />
        <AnnouncementHistoryRows
          announcements={displayedAnnouncements}
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
          searchQuery={query}
          onClearSearch={() => setQuery('')}
        />
      </div>

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
