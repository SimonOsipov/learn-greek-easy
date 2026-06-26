/**
 * ChangelogTimeline — month-grouped admin list view.
 *
 * Presentational only: accepts an already-filtered list of entries plus
 * edit/delete callbacks and renders them sorted desc by `created_at`,
 * grouped by month.
 *
 * Filtering (search + tag SegControl) is handled upstream in CLTE-08.
 *
 * ADMIN2-44: switched from <TimelineEntry> card atom to flat CD rail-rows
 * (.cl-entry-rail + .cl-entry-dot) inside .cl-panel. Month labels are now
 * locale-aware via getDateLocale; grouping key stays 'yyyy-MM' (stable).
 */

import * as React from 'react';

import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { tDynamic } from '@/i18n/tDynamic';
import { getDateLocale } from '@/lib/dateUtils';
import { renderInlineMarkdown } from '@/lib/markdown-inline';
import type { ChangelogEntryAdmin, ChangelogTag } from '@/types/changelog';
import { CHANGELOG_TAG_CONFIG } from '@/types/changelog';

// ── Tone map ──────────────────────────────────────────────────────────────────

type EntryTone = 'green' | 'amber' | 'blue' | 'cyan' | 'violet' | 'red';

const TONE_BY_TAG: Record<ChangelogTag, EntryTone> = {
  new_feature: 'green',
  bug_fix: 'amber',
  announcement: 'blue',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ── Main component ────────────────────────────────────────────────────────────

export interface ChangelogTimelineProps {
  entries: ChangelogEntryAdmin[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ChangelogTimeline({
  entries,
  onEdit,
  onDelete,
}: ChangelogTimelineProps): React.JSX.Element {
  const { t, i18n } = useTranslation(['admin', 'changelog']);
  const isRu = i18n.language.startsWith('ru');
  const dateLocale = getDateLocale(i18n.language);

  // Sort desc by created_at (ISO strings are lexicographically sortable)
  const sorted = [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Group into Map keyed by stable 'yyyy-MM' (locale-independent).
  // Insertion order = render order (newest month first).
  const groups = new Map<string, { label: string; entries: ChangelogEntryAdmin[] }>();
  for (const entry of sorted) {
    const date = new Date(entry.created_at);
    const key = format(date, 'yyyy-MM');
    if (!groups.has(key)) {
      const label = format(date, 'MMMM yyyy', { locale: dateLocale });
      groups.set(key, { label, entries: [] });
    }
    groups.get(key)!.entries.push(entry);
  }

  return (
    <div className="cl-timeline">
      {Array.from(groups.entries()).map(
        ([monthKey, { label: monthLabel, entries: monthEntries }]) => (
          <section key={monthKey} className="cl-month">
            <div className="cl-month-head">
              <span className="cl-month-line" />
              <span className="cl-month-label">{monthLabel}</span>
              <span className="cl-month-line" />
            </div>
            {monthEntries.map((entry) => {
              const tagConfig = CHANGELOG_TAG_CONFIG[entry.tag];
              const tone = TONE_BY_TAG[entry.tag];
              const isMissingRu = !entry.title_ru.trim() || !entry.content_ru.trim();
              const postedDate = format(new Date(entry.created_at), 'MMM d, yyyy', {
                locale: dateLocale,
              });

              const title = isRu
                ? entry.title_ru || `[EN] ${entry.title_en}`
                : entry.title_en || `[RU] ${entry.title_ru}`;
              const body = isRu
                ? entry.content_ru || entry.content_en
                : entry.content_en || entry.content_ru;

              return (
                <article
                  key={entry.id}
                  className="cl-entry"
                  role="button"
                  tabIndex={0}
                  onClick={() => onEdit(entry.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onEdit(entry.id);
                    }
                  }}
                >
                  {/* Rail column */}
                  <div className="cl-entry-rail">
                    <span className={`cl-entry-dot tone-${tone}`} />
                  </div>

                  {/* Content column */}
                  <div className="cl-entry-body">
                    <div className="cl-entry-head">
                      <div className="cl-entry-l">
                        <Badge tone={tone}>{tDynamic(t, tagConfig.labelKey)}</Badge>
                        {entry.version ? (
                          <span className="cl-entry-v" data-testid="version-pill">
                            {entry.version}
                          </span>
                        ) : null}
                        <span className="cl-entry-date">{postedDate}</span>
                        {isMissingRu ? (
                          <Badge tone="amber" data-testid="missing-ru-badge">
                            {t('admin:changelog.timeline.missingRuBadge')}
                          </Badge>
                        ) : null}
                      </div>
                      <div
                        className="cl-entry-actions"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="icon-btn icon-btn-sm"
                          onClick={() => onEdit(entry.id)}
                          aria-label={`Edit ${entry.title_en}`}
                          data-testid={`timeline-edit-${entry.id}`}
                        >
                          <Pencil />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-sm danger"
                          onClick={() => onDelete(entry.id)}
                          aria-label={`Delete ${entry.title_en}`}
                          data-testid={`timeline-delete-${entry.id}`}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                    <h3 className="cl-entry-title">{title}</h3>
                    {entry.title_ru && !isRu ? (
                      <p className="cl-entry-title-ru">{entry.title_ru}</p>
                    ) : null}
                    <div className="cl-entry-content">
                      {renderInlineMarkdown(truncate(body, 240))}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )
      )}
    </div>
  );
}
