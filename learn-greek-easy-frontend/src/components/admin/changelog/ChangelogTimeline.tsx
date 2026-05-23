/**
 * ChangelogTimeline — month-grouped admin list view.
 *
 * Presentational only: accepts an already-filtered list of entries plus
 * edit/delete callbacks and renders them sorted desc by `created_at`,
 * grouped by month.
 *
 * Filtering (search + tag SegControl) is handled upstream in CLTE-08.
 */

import * as React from 'react';

import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TimelineEntry } from '@/components/ui/timeline-entry';
import type { TimelineTone } from '@/components/ui/timeline-entry';
import type { ChangelogEntryAdmin, ChangelogTag } from '@/types/changelog';
import { CHANGELOG_TAG_CONFIG } from '@/types/changelog';

// ── Tone map ──────────────────────────────────────────────────────────────────

const TONE_BY_TAG: Record<ChangelogTag, TimelineTone> = {
  new_feature: 'green',
  bug_fix: 'amber',
  announcement: 'blue',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface HeaderSlotProps {
  entry: ChangelogEntryAdmin;
}

function HeaderSlot({ entry }: HeaderSlotProps) {
  const { t } = useTranslation(['admin', 'changelog']);
  const tagConfig = CHANGELOG_TAG_CONFIG[entry.tag];
  const isMissingRu = !entry.title_ru.trim() || !entry.content_ru.trim();
  const postedDate = format(new Date(entry.created_at), 'MMM d, yyyy');

  return (
    <>
      <Badge tone={TONE_BY_TAG[entry.tag]}>{t(tagConfig.labelKey)}</Badge>
      {entry.version ? (
        <span className="cl-preview-v" data-testid="version-pill">
          {entry.version}
        </span>
      ) : null}
      <span className="cl-posted-date">{postedDate}</span>
      {isMissingRu ? (
        <Badge tone="amber" data-testid="missing-ru-badge">
          {t('admin:changelog.timeline.missingRuBadge')}
        </Badge>
      ) : null}
    </>
  );
}

interface ActionsSlotProps {
  entry: ChangelogEntryAdmin;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function ActionsSlot({ entry, onEdit, onDelete }: ActionsSlotProps) {
  // Note: The TimelineEntry atom wraps its `actions` slot in a div with
  // onClick={(e) => e.stopPropagation(), so we do NOT need to call
  // e.stopPropagation() manually here — the atom handles it.
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onEdit(entry.id)}
        aria-label={`Edit ${entry.title_en}`}
        data-testid={`timeline-edit-${entry.id}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(entry.id)}
        aria-label={`Delete ${entry.title_en}`}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        data-testid={`timeline-delete-${entry.id}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );
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
  const { i18n } = useTranslation(['admin']);
  const isRu = i18n.language.startsWith('ru');

  // Sort desc by created_at (ISO strings are lexicographically sortable)
  const sorted = [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Group into Map — insertion order = render order (newest month first)
  // Month label is hardcoded English via date-fns format; not affected by i18n.language.
  const groups = new Map<string, ChangelogEntryAdmin[]>();
  for (const entry of sorted) {
    const key = format(new Date(entry.created_at), 'MMMM yyyy');
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  return (
    <div className="cl-timeline">
      {Array.from(groups.entries()).map(([monthLabel, monthEntries]) => (
        <section key={monthLabel} className="cl-month">
          <div className="cl-month-head">
            <span className="cl-month-line" />
            <span className="cl-month-label">{monthLabel}</span>
            <span className="cl-month-line" />
          </div>
          {monthEntries.map((entry) => {
            const title = isRu
              ? entry.title_ru || `[EN] ${entry.title_en}`
              : entry.title_en || `[RU] ${entry.title_ru}`;
            const body = isRu
              ? entry.content_ru || entry.content_en
              : entry.content_en || entry.content_ru;
            return (
              <TimelineEntry
                key={entry.id}
                tone={TONE_BY_TAG[entry.tag]}
                title={title}
                subtitle={undefined}
                body={truncate(body, 240)}
                header={<HeaderSlot entry={entry} />}
                actions={<ActionsSlot entry={entry} onEdit={onEdit} onDelete={onDelete} />}
                onClick={() => onEdit(entry.id)}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}
