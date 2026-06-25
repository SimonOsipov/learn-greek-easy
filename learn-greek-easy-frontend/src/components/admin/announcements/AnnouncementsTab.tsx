// src/components/admin/announcements/AnnouncementsTab.tsx

/**
 * AnnouncementsTab — ANND-07 rewrite
 *
 * Integration choke point for ADMIN2-04.
 * Renders AnnouncementsToolbar + AnnouncementHistoryRows +
 * AnnouncementComposeDrawer + AnnouncementDetailsDrawer.
 * (The stat cards were removed in ADMIN2-43 — Claude Design alignment.)
 *
 * V1 modal imports (SummaryCard, AnnouncementCreateModal,
 * AnnouncementPreviewModal, AnnouncementDetailModal, AnnouncementHistoryTable)
 * are dropped. V1 source files stay on disk — deferred to ADMIN2-12.
 *
 * Mobile responsiveness of PageHead actions is deferred to ADMIN2-12.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { useAdminAnnouncementStore } from '@/stores/adminAnnouncementStore';

import { AnnouncementComposeDrawer } from './AnnouncementComposeDrawer';
import { AnnouncementDetailsDrawer } from './AnnouncementDetailsDrawer';
import { AnnouncementHistoryRows } from './AnnouncementHistoryRows';
import { ANNOUNCEMENTS_CLIENT_FETCH_PAGE_SIZE } from './announcementsConstants';
import { AnnouncementsToolbar, type SortKey } from './AnnouncementsToolbar';

/**
 * AnnouncementsTab
 */
export const AnnouncementsTab: React.FC = () => {
  const { t } = useTranslation('admin');

  // ── Store ─────────────────────────────────────────────────────────────────
  const {
    announcements,
    page,
    totalPages,
    total,
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="announcements-tab">
      {/* ── Contained panel: toolbar → column-header → rows → footer ────────
           Matches prototype `<section class="va-panel"><div class="news-toolbar">…`
           The toolbar is always visible inside the panel — even on search-no-match,
           the Rows component's early-return only replaces the table + footer area. */}
      <div className="va-panel an-panel">
        {/* Toolbar row — first child of the panel, separated by a hairline */}
        <div className="an-panel-toolbar">
          <AnnouncementsToolbar
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
          />
        </div>

        <AnnouncementHistoryRows
          announcements={displayedAnnouncements}
          isLoading={isLoading}
          page={page}
          totalPages={totalPages}
          total={total}
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
