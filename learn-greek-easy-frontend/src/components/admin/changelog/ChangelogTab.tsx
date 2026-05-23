// src/components/admin/changelog/ChangelogTab.tsx

/**
 * ChangelogTab — CLTE-08 rewrite
 *
 * Integration choke point for ADMIN2-06.
 * Renders PageHead + 4-up StatCard grid + ChangelogTimeline +
 * ChangelogEditorDrawer + ChangelogDeleteDialog.
 *
 */

import { useEffect, useRef, useState } from 'react';

import { format } from 'date-fns';
import { Calendar, Clock, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Input } from '@/components/ui/input';
import { SegControl, type SegOption } from '@/components/ui/seg-control';
import { StatCard } from '@/components/ui/stat-card';
import { useAdminChangelogStore } from '@/stores/adminChangelogStore';
import { CHANGELOG_TAG_CONFIG, CHANGELOG_TAG_OPTIONS } from '@/types/changelog';
import type { ChangelogEntryAdmin, ChangelogTag } from '@/types/changelog';

import { ChangelogDeleteDialog } from './ChangelogDeleteDialog';
import { ChangelogEditorDrawer } from './ChangelogEditorDrawer';
import { ChangelogTimeline } from './ChangelogTimeline';

/**
 * Compute average days between consecutive entries in the last 10 (sorted desc).
 * Returns null when there are fewer than 2 entries.
 */
function computeAvgCadenceDays(items: ChangelogEntryAdmin[]): number | null {
  if (items.length < 2) return null;
  const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
  if (sorted.length < 2) return null;
  let totalMs = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    totalMs +=
      new Date(sorted[i].created_at).getTime() - new Date(sorted[i + 1].created_at).getTime();
  }
  const avgMs = totalMs / (sorted.length - 1);
  return Math.round(avgMs / (1000 * 60 * 60 * 24));
}

/**
 * ChangelogTab
 */
export function ChangelogTab() {
  const { t } = useTranslation(['admin', 'changelog']);

  // ── Store ─────────────────────────────────────────────────────────────────
  const {
    items,
    total,
    isLoading,
    fetchList,
    openCompose,
    openEdit,
    closeDrawer,
    setLang,
    mode,
    openEntryId,
    lang,
  } = useAdminChangelogStore();

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ── Local state ───────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<'all' | ChangelogTag>('all');
  const [deleteCandidate, setDeleteCandidate] = useState<ChangelogEntryAdmin | null>(null);

  // ── URL deep-link ─────────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();

  // Effect 1 — URL → store (deep-link in)
  // Fires once per mount (idempotency guard). Waits until isLoading is false —
  // i.e. the initial fetch has settled — before applying the deep-link. This
  // fixes the race where isLoading=false AND items=[] simultaneously on mount
  // caused the old guard (`if (isLoading && items.length === 0) return`) to
  // pass and mark the deep-link applied against empty data (Fix #3).
  const appliedDeepLinkRef = useRef(false);
  useEffect(() => {
    if (appliedDeepLinkRef.current) return;
    // Gate: wait for initial fetch to settle
    if (isLoading) return;

    const editId = searchParams.get('edit');
    const langParam = searchParams.get('lang');
    const composeFlag = searchParams.get('compose');

    if (editId) {
      if (items.some((e) => e.id === editId)) {
        appliedDeepLinkRef.current = true;
        openEdit(editId);
        if (langParam === 'en' || langParam === 'ru') {
          setLang(langParam);
        }
      } else {
        // id not found — silent no-op, mark applied so we don't retry
        appliedDeepLinkRef.current = true;
      }
    } else if (composeFlag === '1') {
      appliedDeepLinkRef.current = true;
      openCompose();
    } else {
      // No relevant params — mark applied
      appliedDeepLinkRef.current = true;
    }
    // Malformed values: no URL rewrite, no toast, no console.error
  }, [searchParams, items, isLoading, openEdit, openCompose, setLang]);

  // Effect 2 — store → URL (sync out)
  // Watches mode, openEntryId, lang; keeps URL in sync with drawer state.
  useEffect(() => {
    if (mode === 'compose') {
      setSearchParams(
        (prev) => {
          prev.set('compose', '1');
          prev.delete('edit');
          prev.delete('lang');
          return prev;
        },
        { replace: true }
      );
    } else if (mode === 'edit' && openEntryId) {
      setSearchParams(
        (prev) => {
          prev.set('edit', openEntryId);
          prev.set('lang', lang);
          prev.delete('compose');
          return prev;
        },
        { replace: true }
      );
    } else if (mode === null) {
      if (!appliedDeepLinkRef.current) return; // wait for Effect 1 to apply/skip
      setSearchParams(
        (prev) => {
          prev.delete('edit');
          prev.delete('compose');
          prev.delete('lang');
          return prev;
        },
        { replace: true }
      );
    }
  }, [mode, openEntryId, lang, setSearchParams]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const sortedDesc = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const mostRecent = sortedDesc[0] ?? null;

  const cadenceDays = computeAvgCadenceDays(items);

  // ── Filter pipeline ───────────────────────────────────────────────────────
  const filteredBySearch = items.filter(
    (e) =>
      !search ||
      e.title_en.toLowerCase().includes(search.toLowerCase()) ||
      (e.title_ru ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const filtered =
    selectedTag === 'all'
      ? filteredBySearch
      : filteredBySearch.filter((e) => e.tag === selectedTag);

  // ── Tag SegControl options ────────────────────────────────────────────────
  const tagOptions: SegOption<'all' | ChangelogTag>[] = [
    { value: 'all', label: t('admin:changelog.filter.all'), count: filteredBySearch.length },
    ...CHANGELOG_TAG_OPTIONS.filter((tag) => filteredBySearch.some((e) => e.tag === tag)).map(
      (tag) => ({
        value: tag as 'all' | ChangelogTag,
        label: t(CHANGELOG_TAG_CONFIG[tag].labelKey),
        count: filteredBySearch.filter((e) => e.tag === tag).length,
      })
    ),
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="changelog-tab">
      {/* ── 4-up StatCard grid ───────────────────────────────────────────── */}
      <div className="stat-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t('admin:changelog.stats.total')}
          n={total || items.length}
          icon={<FileText />}
          tone="blue"
          footerLabel={t('admin:changelog.stats.footer.allTime')}
        />
        <StatCard
          title={t('admin:changelog.stats.mostRecent')}
          n={mostRecent ? format(new Date(mostRecent.created_at), 'MMM d') : '—'}
          sub={
            mostRecent
              ? mostRecent.title_en.length > 32
                ? mostRecent.title_en.slice(0, 32) + '…'
                : mostRecent.title_en
              : ''
          }
          icon={<Calendar />}
          tone="violet"
          barsTestId="sparkline-recent"
          footerLabel={t('admin:changelog.stats.footer.lastPublished')}
        />
        <StatCard
          title={t('admin:changelog.stats.cadence')}
          n={cadenceDays !== null ? `${cadenceDays}d` : '—'}
          sub={
            cadenceDays !== null
              ? t('admin:changelog.stats.cadenceSub')
              : t('admin:changelog.stats.cadenceSubMinimal')
          }
          icon={<Clock />}
          tone="cyan"
          barsTestId="sparkline-cadence"
          footerLabel={t('admin:changelog.stats.footer.lastTenEntries')}
        />
      </div>

      {/* ── Panel: toolbar + timeline ────────────────────────────────────── */}
      <div className="va-panel">
        <div className="cl-panel-toolbar">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin:changelog.search.entriesPlaceholder')}
            className="w-64"
            data-testid="changelog-search-input"
          />
          <SegControl options={tagOptions} value={selectedTag} onChange={setSelectedTag} />
        </div>

        <ChangelogTimeline
          entries={filtered}
          onEdit={(id) => openEdit(id)}
          onDelete={(id) => setDeleteCandidate(items.find((e) => e.id === id) ?? null)}
        />
      </div>

      {/* ── Editor Drawer ────────────────────────────────────────────────── */}
      <ChangelogEditorDrawer
        open={mode !== null}
        onClose={closeDrawer}
        entry={items.find((e) => e.id === openEntryId) ?? undefined}
      />

      {/* ── Delete Dialog ────────────────────────────────────────────────── */}
      <ChangelogDeleteDialog
        open={deleteCandidate !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null);
        }}
        entry={deleteCandidate}
      />
    </div>
  );
}
