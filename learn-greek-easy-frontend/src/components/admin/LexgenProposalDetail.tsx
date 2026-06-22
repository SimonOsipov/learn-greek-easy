import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import type {
  LexgenProposalContentField,
  LexgenProposalDetailResponse,
  LexgenProposalField,
} from '@/services/adminAPI';

/**
 * Read-only proposal DETAIL view (LEXGEN-12-03).
 *
 * Presentational only: receives a fully-resolved `LexgenProposalDetailResponse`
 * and renders, per field, the value + provenance source + a `Flagged` badge
 * when flagged — for BOTH the morphological `fields` list AND the parallel
 * `content` list (structurally identical schemas, so ONE row renderer + ONE
 * flagged-badge rule covers both).
 *
 * Anti-anchoring invariant (Decision Record §3): NO numeric score / confidence /
 * trust value is rendered anywhere. This is enforced structurally — the row
 * renderer maps ONLY over the typed `fields[]` / `content[]` arrays and reads
 * ONLY `value` / `source` / `flagged`; it never iterates the raw proposal
 * object, so any unexpected score-bearing key on the payload is invisible.
 *
 * Read-only slice: no approve / edit / regenerate / reject controls (LEXGEN-13
 * owns the action surface).
 */

/** A row carrying value + provenance + flagged — shared shape across both lists. */
type DetailRow = LexgenProposalField | LexgenProposalContentField;

interface FieldRowProps {
  row: DetailRow;
  /** Human label for the field (i18n for known keys, raw flat key otherwise). */
  label: string;
  /** i18n "Source" label. */
  sourceLabel: string;
  /** i18n "Flagged" label. */
  flaggedLabel: string;
}

function FieldRow({ row, label, sourceLabel, flaggedLabel }: FieldRowProps) {
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
      <span className="text-sm text-foreground">{row.value}</span>
      {row.source && (
        <span className="text-xs text-muted-foreground">
          {sourceLabel}: <span className="text-foreground">{row.source}</span>
        </span>
      )}
    </div>
  );
}

export function LexgenProposalDetail({ proposal }: { proposal: LexgenProposalDetailResponse }) {
  const { t, i18n } = useTranslation('admin');

  // Label resolution: i18n for the known scalar/content keys, otherwise fall
  // back to the raw flat key (e.g. `nominative_singular`). Unknown form keys
  // bypass `t()` entirely (they have no resource key) — flat keys at the UI edge.
  const labelFor = (field: string): string =>
    field in KNOWN_FIELD_LABEL_KEYS
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
