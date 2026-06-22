import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  LexgenProposalContentField,
  LexgenProposalDetailResponse,
  LexgenProposalField,
} from '@/services/adminAPI';

/**
 * Detail view for a LEXGEN verification-inbox proposal (LEXGEN-12-03).
 *
 * Renders morphological `fields[]` and content `content[]` via `FieldRow`.
 * When `onSaveField` is provided, each row gains an inline edit affordance
 * (pencil → Input/Textarea → Save/Cancel). Save fires `onSaveField` with the
 * flat key and new value; the sheet re-renders in place on success.
 *
 * Anti-anchoring invariant (Decision Record §3): NO numeric score / confidence /
 * trust value is rendered anywhere. The row renderer maps ONLY over the typed
 * arrays and reads ONLY `value` / `source` / `flagged`.
 */

/** A row carrying value + provenance + flagged — shared shape across both lists. */
type DetailRow = LexgenProposalField | LexgenProposalContentField;

// Content field keys that benefit from a multi-line Textarea instead of Input.
const MULTILINE_FIELDS = new Set(['example_greek', 'example_translation', 'gloss_en', 'gloss_ru']);

interface FieldRowProps {
  row: DetailRow;
  /** Human label for the field (i18n for known keys, raw flat key otherwise). */
  label: string;
  /** i18n "Source" label. */
  sourceLabel: string;
  /** i18n "Flagged" label. */
  flaggedLabel: string;
  /**
   * When provided, adds an inline edit affordance to this row.
   * Receives the flat key and the new value; should return a promise that
   * resolves on success. On rejection the row stays in edit mode.
   */
  onSaveField?: (fieldKey: string, value: string | null) => Promise<void>;
  /** Passed-in reset counter — incremented externally to cancel any open edits. */
  resetKey?: number;
}

function FieldRow({ row, label, sourceLabel, flaggedLabel, onSaveField, resetKey }: FieldRowProps) {
  const { t } = useTranslation('admin');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.value ?? '');
  const [saving, setSaving] = useState(false);

  // When the proposal changes (resetKey incremented) or row value refreshes,
  // exit edit mode and reset the draft to the current value.
  useEffect(() => {
    setEditing(false);
    setDraft(row.value ?? '');
  }, [resetKey, row.value]);

  const handleEdit = () => {
    setDraft(row.value ?? '');
    setEditing(true);
  };

  const handleCancel = () => {
    setDraft(row.value ?? '');
    setEditing(false);
  };

  const handleSave = async () => {
    if (!onSaveField) return;
    setSaving(true);
    try {
      await onSaveField(row.field, draft || null);
      setEditing(false);
    } catch {
      // Stay in edit mode on error (toast is handled by the mutation hook).
    } finally {
      setSaving(false);
    }
  };

  const isMultiline = MULTILINE_FIELDS.has(row.field);

  return (
    <div
      data-testid={`lexgen-field-row-${row.field}`}
      className="flex flex-col gap-1 border-b border-border py-3 last:border-0"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {row.flagged && (
          <Badge tone="amber" data-testid="lexgen-field-flagged-badge">
            {flaggedLabel}
          </Badge>
        )}
      </div>

      {editing && onSaveField ? (
        <div className="flex flex-col gap-2">
          {isMultiline ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="text-sm"
              data-testid={`lexgen-field-edit-${row.field}`}
              autoFocus
            />
          ) : (
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 text-sm"
              data-testid={`lexgen-field-edit-${row.field}`}
              autoFocus
            />
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleSave}
              disabled={saving}
              data-testid={`lexgen-field-save-${row.field}`}
            >
              {t('lexgenInbox.action.save')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              data-testid={`lexgen-field-cancel-${row.field}`}
            >
              {t('lexgenInbox.action.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm text-foreground">{row.value}</span>
          {onSaveField && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleEdit}
              className="h-6 shrink-0 px-2 text-xs text-muted-foreground"
              data-testid={`lexgen-field-edit-btn-${row.field}`}
            >
              {t('lexgenInbox.action.edit')}
            </Button>
          )}
        </div>
      )}

      {row.source && (
        <span className="text-xs text-muted-foreground">
          {sourceLabel}: <span className="text-foreground">{row.source}</span>
        </span>
      )}
    </div>
  );
}

interface LexgenProposalDetailProps {
  proposal: LexgenProposalDetailResponse;
  /**
   * When provided, each field row gains an inline edit affordance.
   * Called with the flat field key and the new value on save.
   */
  onSaveField?: (fieldKey: string, value: string | null) => Promise<void>;
  /**
   * Incremented by the parent when the proposal changes, to reset any open
   * inline edits and prevent stale draft values from bleeding across proposals.
   */
  resetKey?: number;
}

export function LexgenProposalDetail({
  proposal,
  onSaveField,
  resetKey,
}: LexgenProposalDetailProps) {
  const { t, i18n } = useTranslation('admin');

  // Label resolution: i18n for the known scalar/content keys, otherwise fall
  // back to the raw flat key (e.g. `nominative_singular`). Unknown form keys
  // bypass `t()` entirely (they have no resource key) — flat keys at the UI edge.
  const labelFor = (field: string): string =>
    Object.prototype.hasOwnProperty.call(KNOWN_FIELD_LABEL_KEYS, field)
      ? t(KNOWN_FIELD_LABEL_KEYS[field as keyof typeof KNOWN_FIELD_LABEL_KEYS])
      : field;

  const sourceLabel = t('lexgenInbox.detail.provenance');
  const flaggedLabel = t('lexgenInbox.detail.flagged');

  const createdAt = formatCreatedAt(proposal.created_at, i18n.language);

  return (
    <div data-testid="lexgen-proposal-detail" className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          {/* Lemma and POS share one heading node so the heading's text content
              is e.g. "σπίτι · noun", never a bare lemma — this keeps a field
              VALUE that happens to equal the lemma the sole exact text match. */}
          <h2 className="text-xl font-semibold text-foreground">
            {proposal.lemma} · {proposal.pos}
          </h2>
          <Badge tone="blue">{proposal.status}</Badge>
        </div>
        {createdAt && <p className="text-xs text-muted-foreground">{createdAt}</p>}
        <p className="text-xs text-muted-foreground">{t('lexgenInbox.detail.readOnlyNote')}</p>
      </header>

      {proposal.fields.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            {t('lexgenInbox.detail.fieldsHeading')}
          </h3>
          <div>
            {proposal.fields.map((row) => (
              <FieldRow
                key={row.field}
                row={row}
                label={labelFor(row.field)}
                sourceLabel={sourceLabel}
                flaggedLabel={flaggedLabel}
                onSaveField={onSaveField}
                resetKey={resetKey}
              />
            ))}
          </div>
        </section>
      )}

      {proposal.content.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            {t('lexgenInbox.detail.contentHeading')}
          </h3>
          <div>
            {proposal.content.map((row) => (
              <FieldRow
                key={row.field}
                row={row}
                label={labelFor(row.field)}
                sourceLabel={sourceLabel}
                flaggedLabel={flaggedLabel}
                onSaveField={onSaveField}
                resetKey={resetKey}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Maps the known scalar / content flat keys to their full i18n label key. Keys
 * absent here (the flat morphological form keys like `nominative_singular`)
 * fall back to rendering the raw flat key — flat keys at the UI edge only.
 *
 * `as const` preserves the literal key types so the typed `t()` accepts them;
 * arbitrary form keys never reach `t()` (see `labelFor`).
 */
const KNOWN_FIELD_LABEL_KEYS = {
  gender: 'lexgenInbox.detail.field.gender',
  declension_group: 'lexgenInbox.detail.field.declensionGroup',
  ipa: 'lexgenInbox.detail.field.ipa',
  frequency_rank: 'lexgenInbox.detail.field.frequency',
  gloss_en: 'lexgenInbox.detail.field.glossEn',
  gloss_ru: 'lexgenInbox.detail.field.glossRu',
  example_greek: 'lexgenInbox.detail.field.exampleGreek',
  example_translation: 'lexgenInbox.detail.field.exampleTranslation',
} as const;

function formatCreatedAt(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date
    );
  } catch {
    return date.toISOString();
  }
}
