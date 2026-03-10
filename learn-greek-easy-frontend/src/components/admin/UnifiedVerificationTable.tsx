import { useState } from 'react';

import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type {
  CrossAIVerificationResult,
  FieldComparisonResult,
  FieldStatus,
  FieldVerificationResult,
  LocalVerificationResult,
  MorphologySource,
} from '@/services/adminAPI';

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

interface UnifiedVerificationTableProps {
  local: LocalVerificationResult | null;
  crossAI: CrossAIVerificationResult | null;
  morphologySource?: MorphologySource;
}

function buildRows(
  local: LocalVerificationResult | null,
  crossAI: CrossAIVerificationResult | null
): UnifiedRow[] {
  const paths = new Set<string>();
  (local?.fields ?? []).forEach((f) => paths.add(f.field_path));
  (crossAI?.comparisons ?? []).forEach((c) => paths.add(c.field_path));

  const localMap = new Map<string, FieldVerificationResult>();
  (local?.fields ?? []).forEach((f) => localMap.set(f.field_path, f));

  const crossAIMap = new Map<string, FieldComparisonResult>();
  (crossAI?.comparisons ?? []).forEach((c) => crossAIMap.set(c.field_path, c));

  return Array.from(paths).map((path) => ({
    field_path: path,
    local: localMap.get(path) ?? null,
    crossAI: crossAIMap.get(path) ?? null,
  }));
}

function isAttention(row: UnifiedRow): boolean {
  return (
    row.local?.status === 'fail' || row.local?.status === 'warn' || row.crossAI?.agrees === false
  );
}

function LocalCell({
  field,
  hasLocalData,
}: {
  field: FieldVerificationResult | null;
  hasLocalData: boolean;
}) {
  if (!hasLocalData) return <span className="text-muted-foreground">—</span>;
  if (!field) return <span className="text-muted-foreground">—</span>;
  if (field.status === 'skipped') return <span className="text-muted-foreground">–</span>;

  const { icon: Icon, className } = FIELD_STATUS_ICON[field.status];
  const firstMsg = field.checks.find((c) => c.message)?.message;

  return (
    <span className={cn('flex items-start gap-1 text-xs', className)}>
      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        {field.status}
        {firstMsg && <span className="ml-1 text-muted-foreground">{firstMsg}</span>}
      </span>
    </span>
  );
}

function CrossAICell({
  comparison,
  hasData,
}: {
  comparison: FieldComparisonResult | null;
  hasData: boolean;
}) {
  if (!hasData) return <span className="text-muted-foreground">—</span>;
  if (!comparison) return <span className="text-muted-foreground">—</span>;

  if (comparison.agrees) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-500">
        <Check className="h-3 w-3" />
        <span>match</span>
      </span>
    );
  }

  return (
    <span className="flex items-start gap-1 text-xs text-red-500">
      <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        mismatch: <span className="font-mono">"{comparison.primary_value}"</span>
        {' vs '}
        <span className="font-mono">"{comparison.secondary_value}"</span>
      </span>
    </span>
  );
}

function RowsTable({
  rows,
  hasLocalData,
  hasCrossAIData,
}: {
  rows: UnifiedRow[];
  hasLocalData: boolean;
  hasCrossAIData: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.field_path}
            data-testid={`unified-row-${row.field_path}`}
            className="border-b last:border-0"
          >
            <td className="py-1 pr-2 font-mono text-xs">{row.field_path}</td>
            <td className="py-1 pr-2">
              <LocalCell field={row.local} hasLocalData={hasLocalData} />
            </td>
            <td className="py-1">
              <CrossAICell comparison={row.crossAI} hasData={hasCrossAIData} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function UnifiedVerificationTable({
  local,
  crossAI,
  morphologySource,
}: UnifiedVerificationTableProps) {
  const { t } = useTranslation('admin');
  const [passingOpen, setPassingOpen] = useState(false);

  const hasLocalData = local !== null;
  const hasCrossAIData = crossAI !== null && !crossAI.error;

  const allRows = buildRows(local, crossAI);
  const attentionRows = allRows
    .filter(isAttention)
    .sort((a, b) => a.field_path.localeCompare(b.field_path));
  const passingRows = allRows
    .filter((r) => !isAttention(r))
    .sort((a, b) => a.field_path.localeCompare(b.field_path));

  if (allRows.length === 0 && !crossAI?.error) return null;

  return (
    <div data-testid="unified-verification-table" className="space-y-2 text-sm">
      {/* Lexicon scope note */}
      {morphologySource === 'lexicon' && (
        <div
          data-testid="lexicon-scope-note"
          className="flex items-start gap-1.5 text-xs text-muted-foreground"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t('generateNoun.verification.morphologySourceNote')}</span>
        </div>
      )}

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

      {/* Table header */}
      {allRows.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs font-medium">
              <th className="pb-1 pr-2 text-left">
                {t('generateNoun.verification.comparisonHeaders.field')}
              </th>
              <th className="pb-1 pr-2 text-left">
                {t('generateNoun.verification.headers.local')}
              </th>
              <th className="pb-1 text-left">{t('generateNoun.verification.headers.crossAi')}</th>
            </tr>
          </thead>
        </table>
      )}

      {/* Attention rows */}
      {attentionRows.length > 0 && (
        <RowsTable
          rows={attentionRows}
          hasLocalData={hasLocalData}
          hasCrossAIData={hasCrossAIData}
        />
      )}

      {/* Passing rows (collapsed) */}
      {passingRows.length > 0 && (
        <Collapsible open={passingOpen} onOpenChange={setPassingOpen}>
          <CollapsibleTrigger
            data-testid="unified-passing-toggle"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {passingOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {t('generateNoun.verification.passingFieldsCount', { count: passingRows.length })}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <RowsTable
              rows={passingRows}
              hasLocalData={hasLocalData}
              hasCrossAIData={hasCrossAIData}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
