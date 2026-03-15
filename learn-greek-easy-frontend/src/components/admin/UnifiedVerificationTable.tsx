import { useEffect, useState } from 'react';

import { AlertCircle, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type {
  CrossAIVerificationResult,
  FieldComparisonResult,
  FieldVerificationResult,
  LocalVerificationResult,
} from '@/services/adminAPI';

interface UnifiedRow {
  field_path: string;
  local: FieldVerificationResult | null;
  local2: FieldVerificationResult | null;
  crossAI: FieldComparisonResult | null;
}

export type SelectionSource = 'local' | 'wiktionary' | 'primary' | 'secondary';

export interface PillState {
  value: string;
  source: 'auto' | 'local' | 'wiktionary' | 'primary' | 'secondary' | 'manual';
  status: 'agreed' | 'resolved' | 'unresolved' | 'editable';
}

interface UnifiedVerificationTableProps {
  local: LocalVerificationResult | null;
  wiktionaryLocal: LocalVerificationResult | null;
  crossAI: CrossAIVerificationResult | null;
  selections?: Map<string, SelectionSource>;
  onSelect?: (fieldPath: string, source: SelectionSource) => void;
  interactive?: boolean;
  resolvedValues?: Map<string, PillState>;
  onResolvedValueChange?: (fieldPath: string, value: string) => void;
}

function buildRows(
  local: LocalVerificationResult | null,
  wiktionaryLocal: LocalVerificationResult | null,
  crossAI: CrossAIVerificationResult | null
): UnifiedRow[] {
  const paths = new Set<string>();
  (local?.fields ?? []).forEach((f) => {
    paths.add(f.field_path);
  });
  (wiktionaryLocal?.fields ?? []).forEach((f) => {
    paths.add(f.field_path);
  });
  (crossAI?.comparisons ?? []).forEach((c) => {
    paths.add(c.field_path);
  });

  const localMap = new Map<string, FieldVerificationResult>();
  (local?.fields ?? []).forEach((f) => {
    localMap.set(f.field_path, f);
  });

  const local2Map = new Map<string, FieldVerificationResult>();
  (wiktionaryLocal?.fields ?? []).forEach((f) => {
    local2Map.set(f.field_path, f);
  });

  const crossAIMap = new Map<string, FieldComparisonResult>();
  (crossAI?.comparisons ?? []).forEach((c) => {
    crossAIMap.set(c.field_path, c);
  });

  return Array.from(paths)
    .filter((path) => !FILTERED_PATHS.has(path))
    .map((path) => ({
      field_path: path,
      local: localMap.get(path) ?? null,
      local2: local2Map.get(path) ?? null,
      crossAI: crossAIMap.get(path) ?? null,
    }));
}

const CANONICAL_ORDER = [
  'lemma',
  'grammar_data.gender',
  'grammar_data.declension_group',
  'cases.singular.nominative',
  'cases.singular.genitive',
  'cases.singular.accusative',
  'cases.singular.vocative',
  'cases.plural.nominative',
  'cases.plural.genitive',
  'cases.plural.accusative',
  'cases.plural.vocative',
  'pronunciation',
  'translation_en',
  'translation_ru',
  'translation_en_plural',
  'translation_ru_plural',
];

const FILTERED_PATHS = new Set(['examples']);

const FIELD_LABELS: Record<string, string> = {
  'cases.singular.nominative': 'Singular Nominative',
  'cases.singular.genitive': 'Singular Genitive',
  'cases.singular.accusative': 'Singular Accusative',
  'cases.singular.vocative': 'Singular Vocative',
  'cases.plural.nominative': 'Plural Nominative',
  'cases.plural.genitive': 'Plural Genitive',
  'cases.plural.accusative': 'Plural Accusative',
  'cases.plural.vocative': 'Plural Vocative',
  pronunciation: 'Pronunciation',
  translation_en: 'Translation (EN)',
  translation_ru: 'Translation (RU)',
  translation_en_plural: 'Translation Plural (EN)',
  translation_ru_plural: 'Translation Plural (RU)',
  'grammar_data.gender': 'Gender',
  lemma: 'Lemma',
  'grammar_data.declension_group': 'Declension Group',
};

function getRowSeverity(row: UnifiedRow): 'red' | 'yellow' | 'green' | 'neutral' {
  if (
    row.local?.status === 'fail' ||
    row.local2?.status === 'fail' ||
    row.crossAI?.agrees === false
  )
    return 'red';
  if (row.local?.status === 'warn' || row.local2?.status === 'warn') return 'yellow';
  if (row.local?.status === 'skipped' && row.local2 == null && row.crossAI == null)
    return 'neutral';
  return 'green';
}

const SEVERITY_COLORS = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  neutral: 'bg-muted-foreground',
};

function SeverityDot({ severity }: { severity: 'red' | 'yellow' | 'green' | 'neutral' }) {
  return <span className={cn('inline-block h-2 w-2 rounded-full', SEVERITY_COLORS[severity])} />;
}

function isCellClickable(
  row: UnifiedRow,
  column: 'local' | 'wiktionary' | 'primary' | 'secondary',
  interactive: boolean
): boolean {
  if (!interactive) return false;
  if (column === 'local') {
    return row.local?.checks.some((c) => c.reference_value != null) ?? false;
  }
  if (column === 'wiktionary') {
    return row.local2?.checks.some((c) => c.reference_value != null) ?? false;
  }
  return row.crossAI != null;
}

function LocalCell({
  row,
  hasLocalData,
  interactive,
  isSelected,
  isOtherSelected,
  onSelect,
  onResolvedValueChange,
  localField = 'local',
  selectionSource = 'local',
}: {
  row: UnifiedRow;
  hasLocalData: boolean;
  interactive: boolean;
  isSelected: boolean;
  isOtherSelected: boolean;
  onSelect?: (fieldPath: string, source: SelectionSource) => void;
  onResolvedValueChange?: (fieldPath: string, value: string) => void;
  localField?: 'local' | 'local2';
  selectionSource?: SelectionSource;
}) {
  const field = row[localField];
  const clickable = isCellClickable(
    row,
    selectionSource === 'wiktionary' ? 'wiktionary' : 'local',
    interactive
  );

  const refCheck = field?.checks.find((c) => c.reference_value != null);
  const referenceValue = refCheck?.reference_value ?? null;

  const cellContent = (() => {
    if (!hasLocalData || !field || referenceValue == null) {
      return <span className="text-muted-foreground">—</span>;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block max-w-[120px] truncate text-xs">{referenceValue}</span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="text-xs">{referenceValue}</span>
        </TooltipContent>
      </Tooltip>
    );
  })();

  if (clickable) {
    return (
      <button
        type="button"
        className={cn(
          'cursor-pointer hover:bg-accent/50',
          isSelected ? 'ring-2 ring-primary' : '',
          isOtherSelected ? 'opacity-50' : ''
        )}
        aria-pressed={isSelected}
        onClick={() => {
          onSelect?.(row.field_path, selectionSource);
          if (referenceValue != null) {
            onResolvedValueChange?.(row.field_path, referenceValue);
          }
        }}
      >
        {cellContent}
      </button>
    );
  }

  return <>{cellContent}</>;
}

function FieldCell({ path }: { path: string }) {
  const label = FIELD_LABELS[path] ?? path;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="truncate text-xs">{label}</span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono text-xs">{path}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function PrimaryValueCell({
  row,
  interactive,
  isSelected,
  isOtherSelected,
  onSelect,
  onResolvedValueChange,
}: {
  row: UnifiedRow;
  interactive: boolean;
  isSelected: boolean;
  isOtherSelected: boolean;
  onSelect?: (fieldPath: string, source: SelectionSource) => void;
  onResolvedValueChange?: (fieldPath: string, value: string) => void;
}) {
  const comparison = row.crossAI;
  if (!comparison) return <span className="text-muted-foreground">—</span>;

  const clickable = isCellClickable(row, 'primary', interactive);
  const content = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block max-w-[120px] truncate text-xs">{comparison.primary_value}</span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="text-xs">{comparison.primary_value}</span>
      </TooltipContent>
    </Tooltip>
  );

  if (clickable) {
    return (
      <button
        type="button"
        className={cn(
          'cursor-pointer hover:bg-accent/50',
          isSelected ? 'ring-2 ring-primary' : '',
          isOtherSelected ? 'opacity-50' : ''
        )}
        aria-pressed={isSelected}
        onClick={() => {
          onSelect?.(row.field_path, 'primary');
          onResolvedValueChange?.(row.field_path, comparison.primary_value);
        }}
      >
        {content}
      </button>
    );
  }

  return content;
}

function SecondaryValueCell({
  row,
  interactive,
  isSelected,
  isOtherSelected,
  onSelect,
  onResolvedValueChange,
}: {
  row: UnifiedRow;
  interactive: boolean;
  isSelected: boolean;
  isOtherSelected: boolean;
  onSelect?: (fieldPath: string, source: SelectionSource) => void;
  onResolvedValueChange?: (fieldPath: string, value: string) => void;
}) {
  const comparison = row.crossAI;
  if (!comparison) return <span className="text-muted-foreground">—</span>;

  const clickable = isCellClickable(row, 'secondary', interactive);
  const content = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block max-w-[120px] truncate text-xs">{comparison.secondary_value}</span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="text-xs">{comparison.secondary_value}</span>
      </TooltipContent>
    </Tooltip>
  );

  if (clickable) {
    return (
      <button
        type="button"
        className={cn(
          'cursor-pointer hover:bg-accent/50',
          isSelected ? 'ring-2 ring-primary' : '',
          isOtherSelected ? 'opacity-50' : ''
        )}
        aria-pressed={isSelected}
        onClick={() => {
          onSelect?.(row.field_path, 'secondary');
          onResolvedValueChange?.(row.field_path, comparison.secondary_value);
        }}
      >
        {content}
      </button>
    );
  }

  return content;
}

interface DecisionPillProps {
  fieldPath: string;
  pillState: PillState;
  isEditable: boolean;
  onEdit: (fieldPath: string, value: string) => void;
}

function DecisionPill({ fieldPath, pillState, isEditable, onEdit }: DecisionPillProps) {
  const [open, setOpen] = useState(false);
  const [editValue, setEditValue] = useState(pillState.value);

  useEffect(() => {
    if (!open) {
      setEditValue(pillState.value);
    }
  }, [pillState.value, open]);

  const showPopover = isEditable;

  let borderClass: string;
  let IconComponent: React.ElementType;
  let iconClass: string;

  if (pillState.status === 'agreed') {
    borderClass = 'border-green-500';
    IconComponent = Pencil;
    iconClass = 'h-3 w-3 text-green-500';
  } else if (pillState.status === 'resolved') {
    borderClass = 'border-blue-500';
    IconComponent = Pencil;
    iconClass = 'h-3 w-3 text-blue-500';
  } else if (pillState.status === 'unresolved') {
    borderClass = 'border-red-500';
    IconComponent = Pencil;
    iconClass = 'h-3 w-3 text-red-500';
  } else {
    // editable
    borderClass = 'border-muted-foreground';
    IconComponent = Pencil;
    iconClass = 'h-3 w-3 text-muted-foreground';
  }

  const pillContent = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
            borderClass
          )}
        >
          <IconComponent className={iconClass} />
          <span className="max-w-[200px] truncate">{pillState.value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="text-xs">{pillState.value}</span>
      </TooltipContent>
    </Tooltip>
  );

  if (showPopover) {
    return (
      <span data-testid={`decision-pill-${fieldPath}`}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <span
              className={cn(
                'inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                borderClass
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconComponent className={iconClass} />
                </TooltipTrigger>
                <TooltipContent>
                  <span className="text-xs">{pillState.value}</span>
                </TooltipContent>
              </Tooltip>
              <span className="max-w-[200px] truncate">{pillState.value}</span>
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onEdit(fieldPath, editValue);
                  setOpen(false);
                } else if (e.key === 'Escape') {
                  setEditValue(pillState.value);
                  setOpen(false);
                }
              }}
              className="h-7 text-xs"
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </span>
    );
  }

  return <span data-testid={`decision-pill-${fieldPath}`}>{pillContent}</span>;
}

function RowsTable({
  rows,
  hasLocalData,
  hasLocal2Data,
  wiktionarySkipped,
  t,
  selections,
  onSelect,
  interactive,
  resolvedValues,
  onResolvedValueChange,
}: {
  rows: UnifiedRow[];
  hasLocalData: boolean;
  hasLocal2Data: boolean;
  wiktionarySkipped: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  selections?: Map<string, SelectionSource>;
  onSelect?: (fieldPath: string, source: SelectionSource) => void;
  interactive?: boolean;
  resolvedValues?: Map<string, PillState>;
  onResolvedValueChange?: (fieldPath: string, value: string) => void;
}) {
  const isInteractive = interactive ?? false;

  return (
    <table className="w-full table-auto text-sm">
      <colgroup>
        <col style={{ width: '3%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '17%' }} />
        <col style={{ width: '17%' }} />
        <col style={{ width: '29%' }} />
      </colgroup>
      <thead>
        <tr className="border-b text-xs font-medium">
          <th className="py-1" />
          <th className="py-1 text-left font-medium">
            {t('generateNoun.verification.comparisonHeaders.field')}
          </th>
          <th className="py-1 text-left font-medium">
            {t('generateNoun.verification.headers.local')}
          </th>
          <th className="py-1 text-left font-medium">
            {wiktionarySkipped ? (
              <span className="text-xs text-muted-foreground">
                {t('generateNoun.verification.wiktionary.noData')}
              </span>
            ) : (
              t('generateNoun.verification.headers.wiktionary')
            )}
          </th>
          <th className="py-1 text-left font-medium">
            {t('generateNoun.verification.comparisonHeaders.primary')}
          </th>
          <th className="py-1 text-left font-medium">
            {t('generateNoun.verification.comparisonHeaders.secondary')}
          </th>
          <th className="py-1 text-left font-medium">
            {t('generateNoun.verification.comparisonHeaders.decision')}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const severity = getRowSeverity(row);
          const selectedSource = selections?.get(row.field_path);
          const isAdminSelected = selectedSource != null;

          return (
            <tr
              key={row.field_path}
              data-testid={`unified-row-${row.field_path}`}
              className="border-b last:border-0"
            >
              <td className="py-1 pr-1 align-middle">
                <SeverityDot severity={severity} />
              </td>
              <td className="py-1 pr-1 align-middle">
                <FieldCell path={row.field_path} />
              </td>
              <td className="py-1 align-middle">
                <LocalCell
                  row={row}
                  hasLocalData={hasLocalData}
                  interactive={isInteractive}
                  isSelected={selectedSource === 'local'}
                  isOtherSelected={isAdminSelected && selectedSource !== 'local'}
                  onSelect={onSelect}
                  onResolvedValueChange={onResolvedValueChange}
                />
              </td>
              <td className="py-1 align-middle">
                <LocalCell
                  row={row}
                  hasLocalData={hasLocal2Data}
                  interactive={isInteractive}
                  isSelected={selectedSource === 'wiktionary'}
                  isOtherSelected={isAdminSelected && selectedSource !== 'wiktionary'}
                  onSelect={onSelect}
                  onResolvedValueChange={onResolvedValueChange}
                  localField="local2"
                  selectionSource="wiktionary"
                />
              </td>
              <td className="py-1 pr-1 align-middle">
                <PrimaryValueCell
                  row={row}
                  interactive={isInteractive}
                  isSelected={selectedSource === 'primary'}
                  isOtherSelected={isAdminSelected && selectedSource !== 'primary'}
                  onSelect={onSelect}
                  onResolvedValueChange={onResolvedValueChange}
                />
              </td>
              <td className="py-1 pl-2 pr-1 align-middle">
                <SecondaryValueCell
                  row={row}
                  interactive={isInteractive}
                  isSelected={selectedSource === 'secondary'}
                  isOtherSelected={isAdminSelected && selectedSource !== 'secondary'}
                  onSelect={onSelect}
                  onResolvedValueChange={onResolvedValueChange}
                />
              </td>
              <td className="py-1 align-middle">
                {resolvedValues?.has(row.field_path) ? (
                  <DecisionPill
                    fieldPath={row.field_path}
                    pillState={resolvedValues.get(row.field_path)!}
                    isEditable={true}
                    onEdit={(fp, val) => onResolvedValueChange?.(fp, val)}
                  />
                ) : (
                  <span>—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function UnifiedVerificationTable({
  local,
  wiktionaryLocal,
  crossAI,
  selections,
  onSelect,
  interactive,
  resolvedValues,
  onResolvedValueChange,
}: UnifiedVerificationTableProps) {
  const { t } = useTranslation('admin');

  const hasLocalData = local !== null;
  const hasLocal2Data = (wiktionaryLocal?.fields.length ?? 0) > 0;
  const wiktionarySkipped = wiktionaryLocal === null;
  const allRows = buildRows(local, wiktionaryLocal, crossAI).sort((a, b) => {
    const ai = CANONICAL_ORDER.indexOf(a.field_path);
    const bi = CANONICAL_ORDER.indexOf(b.field_path);
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });

  if (allRows.length === 0 && !crossAI?.error) return null;

  return (
    <TooltipProvider>
      <div data-testid="unified-verification-table" className="space-y-2 text-sm">
        {/* Cross-AI error */}
        {crossAI?.error && (
          <Alert data-testid="cross-ai-error" variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {t('generateNoun.verification.crossAiUnavailable')}: {crossAI.error}
            </AlertDescription>
          </Alert>
        )}

        {/* All rows in canonical order */}
        {allRows.length > 0 && (
          <RowsTable
            rows={allRows}
            hasLocalData={hasLocalData}
            hasLocal2Data={hasLocal2Data}
            wiktionarySkipped={wiktionarySkipped}
            t={t}
            selections={selections}
            onSelect={onSelect}
            interactive={interactive}
            resolvedValues={resolvedValues}
            onResolvedValueChange={onResolvedValueChange}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
