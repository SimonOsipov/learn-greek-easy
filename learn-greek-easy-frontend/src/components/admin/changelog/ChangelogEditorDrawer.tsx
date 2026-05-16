// src/components/admin/changelog/ChangelogEditorDrawer.tsx

/**
 * ChangelogEditorDrawer
 *
 * Drawer for creating/editing changelog entries. Built on the SidePanel atom.
 *
 * Form state: plain useState (NOT react-hook-form).
 * Rationale: only 6 strings + 1 enum; validation lands in CLTE-06; Form↔JSON
 * two-way sync (also CLTE-06) is far simpler with plain state than RHF's
 * controlled-field registry. Do not "fix" this to RHF.
 *
 * Tab state (lang, panelMode) is owned by adminChangelogStore (wired by CLTE-03)
 * and read here via selectors. This component calls setLang / setPanelMode on
 * the store so that the JSON panel (CLTE-06) can observe the same state.
 */

import { useCallback, useState } from 'react';

import { format } from 'date-fns';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SidePanel } from '@/components/ui/side-panel';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { renderInlineMarkdown } from '@/lib/markdown-inline';
import { cn } from '@/lib/utils';
import {
  useAdminChangelogStore,
  selectAdminChangelogLang,
  selectAdminChangelogPanelMode,
} from '@/stores/adminChangelogStore';
import { CHANGELOG_TAG_OPTIONS, CHANGELOG_TAG_CONFIG } from '@/types/changelog';
import type { ChangelogEntryAdmin, ChangelogTag } from '@/types/changelog';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChangelogEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  entry?: ChangelogEntryAdmin;
}

// Tone mapping for tag buttons (matches CLTE-02 CSS data-tone attribute values)
const TAG_TONE: Record<ChangelogTag, 'green' | 'amber' | 'blue'> = {
  new_feature: 'green',
  bug_fix: 'amber',
  announcement: 'blue',
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ChangelogEditorDrawer({ open, onClose, entry }: ChangelogEditorDrawerProps) {
  const { t } = useTranslation('changelog');

  // ── Store: tab state (lifted by CLTE-03) ──────────────────────────────────
  const lang = useAdminChangelogStore(selectAdminChangelogLang);
  const panelMode = useAdminChangelogStore(selectAdminChangelogPanelMode);
  const { setLang, setPanelMode } = useAdminChangelogStore();

  // ── Local form state (plain useState — see file-level comment) ────────────
  const [form, setForm] = useState({
    tag: (entry?.tag ?? 'new_feature') as ChangelogTag,
    version: entry?.version ?? '',
    title_en: entry?.title_en ?? '',
    title_ru: entry?.title_ru ?? '',
    content_en: entry?.content_en ?? '',
    content_ru: entry?.content_ru ?? '',
  });

  // ── Language-bound field helpers ──────────────────────────────────────────
  const titleKey = lang === 'en' ? 'title_en' : 'title_ru';
  const contentKey = lang === 'en' ? 'content_en' : 'content_ru';

  const titleValue = form[titleKey];
  const contentValue = form[contentKey];

  const setTitle = (v: string) => setForm((f) => ({ ...f, [titleKey]: v }));
  const setContent = (v: string) => setForm((f) => ({ ...f, [contentKey]: v }));

  // ── Translation status pills ──────────────────────────────────────────────
  const enDone = !!form.title_en.trim() && !!form.content_en.trim();
  const ruDone = !!form.title_ru.trim() && !!form.content_ru.trim();

  // ── SidePanel open/close bridge ───────────────────────────────────────────
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onClose();
    },
    [onClose]
  );

  const title = entry ? 'Edit entry' : 'New entry';

  return (
    <TooltipProvider>
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
                aria-selected={panelMode === 'form'}
                className={cn('drawer-tab', panelMode === 'form' && 'is-active')}
                onClick={() => setPanelMode('form')}
                data-testid="changelog-editor-tab-form"
              >
                Form
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panelMode === 'json'}
                className={cn('drawer-tab', panelMode === 'json' && 'is-active')}
                onClick={() => setPanelMode('json')}
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
                aria-selected={lang === 'en'}
                className={cn('drawer-tab', lang === 'en' && 'is-active')}
                onClick={() => setLang('en')}
                data-testid="changelog-editor-tab-en"
              >
                EN
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={lang === 'ru'}
                className={cn('drawer-tab', lang === 'ru' && 'is-active')}
                onClick={() => setLang('ru')}
                data-testid="changelog-editor-tab-ru"
              >
                RU
              </button>
            </div>
          </div>
        </SidePanel.Tabs>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <SidePanel.Body>
          <div data-testid="changelog-drawer-body" className="cl-edit-body">
            <div className="cl-edit-grid">
              {/* ── Left column: Form ─────────────────────────────────── */}
              <div className="cl-edit-form">
                {/* Tag picker */}
                <div>
                  <div className="cl-tag-grid">
                    {CHANGELOG_TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={cn('cl-tag-btn', form.tag === tag && 'is-active')}
                        data-tone={TAG_TONE[tag]}
                        onClick={() => setForm((f) => ({ ...f, tag }))}
                        data-testid={`changelog-editor-tag-${tag}`}
                      >
                        <span className="cl-tag-dot" aria-hidden="true" />
                        {t(
                          CHANGELOG_TAG_CONFIG[tag].labelKey.replace(
                            'changelog:',
                            ''
                          ) as Parameters<typeof t>[0]
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Version input */}
                <div>
                  <Input
                    value={form.version}
                    onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                    placeholder="v. 0.12.0"
                    data-testid="changelog-editor-version"
                  />
                </div>

                {/* Title input (language-bound) */}
                <div>
                  <Input
                    value={titleValue}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid={`changelog-editor-title-${lang}`}
                  />
                </div>

                {/* Content textarea (language-bound) */}
                <div>
                  <Textarea
                    rows={8}
                    value={contentValue}
                    onChange={(e) => setContent(e.target.value)}
                    data-testid={`changelog-editor-content-${lang}`}
                  />
                </div>

                {/* Translation status pills */}
                <div className="cl-translation-status">
                  <span
                    className={cn('cl-trans-pill', enDone && 'is-done')}
                    data-testid="changelog-trans-pill-en"
                  >
                    {enDone ? <Check aria-hidden="true" /> : <span aria-hidden="true">—</span>}
                    <span className="cl-trans-l">EN</span>
                  </span>
                  <span
                    className={cn('cl-trans-pill', ruDone && 'is-done')}
                    data-testid="changelog-trans-pill-ru"
                  >
                    {ruDone ? <Check aria-hidden="true" /> : <span aria-hidden="true">—</span>}
                    <span className="cl-trans-l">RU</span>
                  </span>
                </div>

                {/* Auto-translate button
                    Uses aria-disabled instead of disabled so Radix Tooltip can fire.
                    Mirrors AnnouncementComposeDrawer's "Save draft" gated-button pattern. */}
                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="btn-glass cursor-not-allowed opacity-60"
                        aria-disabled="true"
                        onClick={(e) => e.preventDefault()}
                        data-testid="changelog-editor-autotranslate"
                      >
                        {lang === 'en' ? 'Auto-translate EN → RU' : 'Auto-translate RU → EN'}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Coming soon — auto-translate will be wired to OpenRouter in a follow-up.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* ── Right column: Preview (CLTE-05) ──────────────────── */}
              {panelMode === 'form' && (
                <aside className="cl-preview" data-testid="changelog-drawer-preview">
                  <div className="cl-preview-l">Preview ({lang.toUpperCase()})</div>
                  <div className="cl-preview-card">
                    <div className="cl-preview-head">
                      <Badge tone={TAG_TONE[form.tag]}>
                        {t(
                          CHANGELOG_TAG_CONFIG[form.tag].labelKey.replace(
                            'changelog:',
                            ''
                          ) as Parameters<typeof t>[0]
                        )}
                      </Badge>
                      {form.version && (
                        <span className="cl-preview-v" data-testid="changelog-preview-version">
                          {form.version}
                        </span>
                      )}
                    </div>
                    <h3 className="cl-preview-title" data-testid="changelog-preview-title">
                      {titleValue || (lang === 'en' ? 'Your headline' : 'Ваш заголовок')}
                    </h3>
                    <p className="cl-preview-body" data-testid="changelog-preview-body">
                      {contentValue ? (
                        renderInlineMarkdown(contentValue)
                      ) : (
                        <span className="va-dim">
                          {lang === 'en'
                            ? 'Body text will appear here as you type.'
                            : 'Текст появится здесь по мере набора.'}
                        </span>
                      )}
                    </p>
                    <div className="cl-preview-foot va-dim" data-testid="changelog-preview-foot">
                      {entry
                        ? `Posted ${format(new Date(entry.created_at), 'MMM d, yyyy')}`
                        : 'Today'}
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </div>
        </SidePanel.Body>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <SidePanel.Footer>
          <div data-testid="changelog-drawer-footer" />
        </SidePanel.Footer>
      </SidePanel>
    </TooltipProvider>
  );
}
