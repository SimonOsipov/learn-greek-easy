import { useEffect, useState } from 'react';

import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  MinusCircle,
  Pencil,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type {
  CrossAIVerificationResult,
  FieldComparisonResult,
  FieldStatus,
  FieldVerificationResult,
  LocalVerificationResult,
} from '@/services/adminAPI';
import { EDITABLE_FIELDS } from '@/utils/nounPayloadBuilder';

const FIELD_STATUS_ICON: Record<FieldStatus, { icon: React.ElementType; className: string }> = {
  pass: { icon: Check, className: 'text-green-500' },
  warn: { icon: AlertTriangle, className: 'text-yellow-500' },
  fail: { icon: XCircle, className: 'text-red-500' },
  skipped: { icon: MinusCircle, className: 'text-muted-foreground' },
};

interface UnifiedRow {
  field_path: string;
  local: FieldVerificationResult | null;
  crossAI: FieldComparisonResult | null;
}

export type SelectionSource = 'local' | 'primary' | 'secondary';

export interface PillState {
  value: string;
  source: 'auto' | 'local' | 'primary' | 'secondary' | 'manual';
  status: 'agreed' | 'resolved' | 'unresolved' | 'editable';
}

interface UnifiedVerificationTableProps {
  local: LocalVerificationResult | null;
  crossAI: CrossAIVerificationResult | null;
  selections?: Map<string, SelectionSource>;
  onSelect?: (fieldPath: string, source: SelectionSource) => void;
  interactive?: boolean;
  resolvedValues?: Map<string, PillState>;
  onResolvedValueChange?: (fieldPath: string, value: string) => void;
}

function buildRows(
  local: LocalVerificationResult | null,
  crossAI: CrossAIVerificationResult | null
): UnifiedRow[] {
  const paths = new Set<string>();
  (local?.fields ?? []).forEach((f) => {
    paths.add(f.field_path);
  });
  (crossAI?.comparisons ?? []).forEach((c) => {
    paths.add(c.field_path);
  });

  const localMap = new Map<string, FieldVerificationResult>();
  (local?.fields ?? []).forEach((f) => {
    localMap.set(f.field_path, f);
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

function formatUDMessage(message: string): string {
  return message
    .replace(/Case=Nom/g, 'nominative')
    .replace(/Case=Gen/g, 'genitive')
    .replace(/Case=Acc/g, 'accusative')
    .replace(/Case=Voc/g, 'vocative')
    .replace(/Number=Sing/g, 'singular')
    .replace(/Number=Plur/g, 'plural')
    .replace(/Gender=Masc/g, 'masculine')
    .replace(/Gender=Fem/g, 'feminine')
    .replace(/Gender=Neut/g, 'neuter')
    .replace(/\//g, ' ');
}

function getRowSeverity(row: UnifiedRow): 'red' | 'yellow' | 'green' | 'neutral' {
  if (row.local?.status === 'fail' || row.crossAI?.agrees === false) return 'red';
  if (row.local?.status === 'warn') return 'yellow';
  if (row.local?.status === 'skipped' && row.crossAI == null) return 'neutral';
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
  column: 'local' | 'primary' | 'secondary',
  interactive: boolean
): boolean {
  if (!interactive) return false;
  if (column === 'local') {
    const hasRef = row.local?.checks.some((c) => c.reference_value != null) ?? false;
    return hasRef;
  }
  return row.crossAI?.agrees === false;
}

function toFlatKey(path: string): string {
  if (path.startsWith('cases.')) {
    const parts = path.split('.');
    return `${parts[2]}_${parts[1]}`;
  }
  if (path === 'grammar_data.gender') return 'gender';
  if (path === 'grammar_data.declension_group') return 'declension_group';
  return path;
}

function LocalCell({
  row,
  hasLocalData,
  t,
  interactive,
  isSelected,
  isOtherSelected,
  onSelect,
  onResolvedValueChange,
}: {
  row: UnifiedRow;
  hasLocalData: boolean;
  t: (key: string) => string;
  interactive: boolean;
  isSelected: boolean;
  isOtherSelected: boolean;
  onSelect?: (fieldPath: string, source: SelectionSource) => void;
  onResolvedValueChange?: (fieldPath: string, value: string) => void;
}) {
  const field = row.local;
  const clickable = isCellClickable(row, 'local', interactive);

  const cellContent = (() => {
    if (!hasLocalData) return <span className="text-muted-foreground">—</span>;
    if (!field) return <span className="text-muted-foreground">—</span>;
    if (field.status === 'skipped')
      return (
        <span className="text-xs text-muted-foreground">
          {t('generateNoun.verification.fieldStatus.skipped')}
        </span>
      );

    const { icon: Icon, className } = FIELD_STATUS_ICON[field.status];
    const firstMsg = field.checks.find((c) => c.message)?.message;
    const tooltipText = firstMsg ? formatUDMessage(firstMsg) : field.status;

    // Extract reference info
    const refCheck = field.checks.find((c) => c.reference_value != null);
    const referenceValue = refCheck?.reference_value ?? null;

    if (referenceValue != null) {
      return (
        <span className="inline-flex min-w-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn('inline-flex items-center', className)}>
                <Icon className="h-3 w-3 shrink-0" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <span className="text-xs">{tooltipText}</span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block break-words text-xs">{referenceValue}</span>
            </TooltipTrigger>
            <TooltipContent>
              <span className="text-xs">{referenceValue}</span>
            </TooltipContent>
          </Tooltip>
        </span>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center', className)}>
            <Icon className="h-3 w-3 shrink-0" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="text-xs">{tooltipText}</span>
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
          onSelect?.(row.field_path, 'local');
          const refCheck = row.local?.checks.find((c) => c.reference_value != null);
          if (refCheck?.reference_value != null) {
            onResolvedValueChange?.(toFlatKey(row.field_path), refCheck.reference_value);
          }
        }}
      >
        {cellContent}
      </button>
    );
  }

  return <>{cellContent}</>;
}

function FieldCell({
  path,
  severity,
}: {
  path: string;
  severity: 'red' | 'yellow' | 'green' | 'neutral';
}) {
  const label = FIELD_LABELS[path] ?? path;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1.5 text-xs">
          <SeverityDot severity={severity} />
          <span className="truncate">{label}</span>
        </span>
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
  const content = <span className="truncate text-xs">{comparison.primary_value}</span>;

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
          onResolvedValueChange?.(toFlatKey(row.field_path), comparison.primary_value);
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
  const content = <span className="truncate text-xs">{comparison.secondary_value}</span>;

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
          onResolvedValueChange?.(toFlatKey(row.field_path), comparison.secondary_value);
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

  const showPopover =
    isEditable && (pillState.status === 'editable' || pillState.status === 'unresolved');

  let borderClass: string;
  let IconComponent: React.ElementType;
  let iconClass: string;

  if (pillState.status === 'agreed') {
    borderClass = 'border-green-500';
    IconComponent = Check;
    iconClass = 'h-3 w-3 text-green-500';
  } else if (pillState.status === 'resolved') {
    borderClass = 'border-blue-500';
    IconComponent = Check;
    iconClass = 'h-3 w-3 text-blue-500';
  } else if (pillState.status === 'unresolved') {
    borderClass = 'border-red-500';
    IconComponent = showPopover ? Pencil : AlertTriangle;
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
          <span className="max-w-[120px] truncate">{pillState.value}</span>
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
              <span className="max-w-[120px] truncate">{pillState.value}</span>
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

function DecisionCell({
  comparison,
  isAdminSelected,
  selectedSource,
  t,
}: {
  comparison: FieldComparisonResult | null;
  isAdminSelected: boolean;
  selectedSource?: SelectionSource;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (!comparison) return <span className="text-muted-foreground">—</span>;
  if (isAdminSelected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="text-xs">
            {t('generateNoun.verification.resolvedTooltip', {
              source: t(`generateNoun.verification.sourceLabels.${selectedSource}`),
            })}
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }
  if (comparison.agrees) return <Check className="h-4 w-4 text-green-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function RowsTable({
  rows,
  hasLocalData,
  t,
  selections,
  onSelect,
  interactive,
  resolvedValues,
  onResolvedValueChange,
}: {
  rows: UnifiedRow[];
  hasLocalData: boolean;
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
        <col style={{ width: '18%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '24%' }} />
        <col style={{ width: '24%' }} />
        <col style={{ width: '26%' }} />
      </colgroup>
      <thead>
        <tr className="border-b text-xs font-medium">
          <th className="py-1 text-left font-medium">
            {t('generateNoun.verification.comparisonHeaders.field')}
          </th>
          <th className="py-1 text-left font-medium">
            {t('generateNoun.verification.headers.local')}
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
              <td className="py-1 pr-1">
                <FieldCell path={row.field_path} severity={severity} />
              </td>
              <td className="py-1">
                <LocalCell
                  row={row}
                  hasLocalData={hasLocalData}
                  t={t}
                  interactive={isInteractive}
                  isSelected={selectedSource === 'local'}
                  isOtherSelected={isAdminSelected && selectedSource !== 'local'}
                  onSelect={onSelect}
                  onResolvedValueChange={onResolvedValueChange}
                />
              </td>
              <td className="max-w-[200px] py-1 pr-1">
                <PrimaryValueCell
                  row={row}
                  interactive={isInteractive}
                  isSelected={selectedSource === 'primary'}
                  isOtherSelected={isAdminSelected && selectedSource !== 'primary'}
                  onSelect={onSelect}
                  onResolvedValueChange={onResolvedValueChange}
                />
              </td>
              <td className="max-w-[200px] py-1 pr-1">
                <SecondaryValueCell
                  row={row}
                  interactive={isInteractive}
                  isSelected={selectedSource === 'secondary'}
                  isOtherSelected={isAdminSelected && selectedSource !== 'secondary'}
                  onSelect={onSelect}
                  onResolvedValueChange={onResolvedValueChange}
                />
              </td>
              <td className="py-1">
                {resolvedValues?.has(row.field_path) ? (
                  <DecisionPill
                    fieldPath={row.field_path}
                    pillState={resolvedValues.get(row.field_path)!}
                    isEditable={EDITABLE_FIELDS.has(row.field_path)}
                    onEdit={(fp, val) => onResolvedValueChange?.(fp, val)}
                  />
                ) : (
                  <DecisionCell
                    comparison={row.crossAI}
                    isAdminSelected={isAdminSelected}
                    selectedSource={selectedSource}
                    t={t}
                  />
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
  crossAI,
  selections,
  onSelect,
  interactive,
  resolvedValues,
  onResolvedValueChange,
}: UnifiedVerificationTableProps) {
  const { t } = useTranslation('admin');

  const hasLocalData = local !== null;
  const hasCrossAIData = crossAI !== null && !crossAI.error;
  const allRows = buildRows(local, crossAI).sort((a, b) => {
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

        {/* Agreement badge */}
        {hasCrossAIData && crossAI?.overall_agreement != null && (
          <div data-testid="cross-ai-agreement">
            <Badge variant="outline" className="text-xs">
              {t('generateNoun.verification.agreementScore', {
                percentage: Math.round(crossAI.overall_agreement * 100),
              })}
            </Badge>
          </div>
        )}

        {/* All rows in canonical order */}
        {allRows.length > 0 && (
          <RowsTable
            rows={allRows}
            hasLocalData={hasLocalData}
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
