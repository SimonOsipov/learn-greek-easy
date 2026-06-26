// src/components/admin/changelog/ChangelogTab.tsx

/**
 * ChangelogTab — CLTE-08 rewrite
 *
 * Integration choke point for ADMIN2-06.
 * Renders PageHead + toolbar + panel/timeline +
 * ChangelogEditorDrawer + ChangelogDeleteDialog.
 *
 */

import { useEffect, useRef, useState } from 'react';

import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Input } from '@/components/ui/input';
import { SegControl, type SegOption } from '@/components/ui/seg-control';
import { tDynamic } from '@/i18n/tDynamic';
import { useAdminChangelogStore } from '@/stores/adminChangelogStore';
import { CHANGELOG_TAG_CONFIG, CHANGELOG_TAG_OPTIONS } from '@/types/changelog';
import type { ChangelogEntryAdmin, ChangelogTag } from '@/types/changelog';

import { ChangelogDeleteDialog } from './ChangelogDeleteDialog';
import { ChangelogEditorDrawer } from './ChangelogEditorDrawer';
import { ChangelogTimeline } from './ChangelogTimeline';

/**
 * ChangelogTab
 */
export function ChangelogTab() {
  const { t } = useTranslation(['admin', 'changelog']);

  // ── Store ─────────────────────────────────────────────────────────────────
  const {
    items,
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
    { value: 'all', label: t('admin:changelog.filter.all') },
    ...CHANGELOG_TAG_OPTIONS.filter((tag) => filteredBySearch.some((e) => e.tag === tag)).map(
      (tag) => ({
        value: tag as 'all' | ChangelogTag,
        label: tDynamic(t, CHANGELOG_TAG_CONFIG[tag].labelKey),
      })
    ),
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="changelog-tab">
      {/* ── Toolbar (sits on page canvas, no panel background) ──────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[240px] flex-1 sm:max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearch('');
            }}
            placeholder={t('admin:changelog.search.entriesPlaceholder')}
            className="pl-8 pr-8"
            data-testid="changelog-search-input"
          />
          {search && (
            <button
              type="button"
              aria-label={t('admin:changelog.search.clearAriaLabel')}
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <SegControl options={tagOptions} value={selectedTag} onChange={setSelectedTag} />
      </div>

      {/* ── Panel: timeline ──────────────────────────────────────────────── */}
      <div className="va-panel">
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
