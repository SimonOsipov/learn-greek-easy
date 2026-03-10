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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  gender: 'Gender',
  lemma: 'Lemma',
  declension_group: 'Declension Group',
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

function getRowSeverity(row: UnifiedRow): 'red' | 'yellow' | 'green' {
  if (row.local?.status === 'fail' || row.crossAI?.agrees === false) return 'red';
  if (row.local?.status === 'warn') return 'yellow';
  return 'green';
}

const SEVERITY_COLORS = { red: 'bg-red-500', yellow: 'bg-yellow-500', green: 'bg-green-500' };

function SeverityDot({ severity }: { severity: 'red' | 'yellow' | 'green' }) {
  return <span className={cn('inline-block h-2 w-2 rounded-full', SEVERITY_COLORS[severity])} />;
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
  const tooltipText = firstMsg ? formatUDMessage(firstMsg) : field.status;

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
}

function FieldCell({ path, severity }: { path: string; severity: 'red' | 'yellow' | 'green' }) {
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

function PrimaryValueCell({ comparison }: { comparison: FieldComparisonResult | null }) {
  if (!comparison) return <span className="text-muted-foreground">—</span>;
  return <span className="truncate text-xs">{comparison.primary_value}</span>;
}

function SecondaryValueCell({ comparison }: { comparison: FieldComparisonResult | null }) {
  if (!comparison) return <span className="text-muted-foreground">—</span>;
  return <span className="truncate text-xs">{comparison.secondary_value}</span>;
}

function DecisionCell({ comparison }: { comparison: FieldComparisonResult | null }) {
  if (!comparison) return <span className="text-muted-foreground">—</span>;
  if (comparison.agrees) return <Check className="h-4 w-4 text-green-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function RowsTable({
  rows,
  hasLocalData,
  t,
}: {
  rows: UnifiedRow[];
  hasLocalData: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <table className="w-full table-fixed text-sm">
      <colgroup>
        <col className="w-[20%]" />
        <col className="w-[8%]" />
        <col className="w-[30%]" />
        <col className="w-[30%]" />
        <col className="w-[12%]" />
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
                <LocalCell field={row.local} hasLocalData={hasLocalData} />
              </td>
              <td className="py-1 pr-1">
                <PrimaryValueCell comparison={row.crossAI} />
              </td>
              <td className="py-1 pr-1">
                <SecondaryValueCell comparison={row.crossAI} />
              </td>
              <td className="py-1">
                <DecisionCell comparison={row.crossAI} />
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
    <TooltipProvider>
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

        {/* Attention rows */}
        {attentionRows.length > 0 && (
          <RowsTable rows={attentionRows} hasLocalData={hasLocalData} t={t} />
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
              <RowsTable rows={passingRows} hasLocalData={hasLocalData} t={t} />
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </TooltipProvider>
  );
}
