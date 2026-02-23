// src/components/admin/vocabulary/grammar-display/grammar-edit/NounGrammarEditForm.tsx

/**
 * NounGrammarEditForm - Editable form for noun grammar data.
 *
 * Mirrors NounGrammarDisplay layout: gender select + declension table
 * (4 cases x singular/plural) with Input fields instead of read-only text.
 */

import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ============================================
// Constants
// ============================================

const CASE_FIELDS = [
  { case: 'nominative', caseName: 'nominative' },
  { case: 'genitive', caseName: 'genitive' },
  { case: 'accusative', caseName: 'accusative' },
  { case: 'vocative', caseName: 'vocative' },
] as const;

const GENDER_OPTIONS = ['masculine', 'feminine', 'neuter'] as const;

// ============================================
// Props
// ============================================

export interface GrammarEditFormProps {
  formState: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

// ============================================
// Component
// ============================================

export function NounGrammarEditForm({ formState, onChange }: GrammarEditFormProps) {
  const { t } = useTranslation('admin');

  return (
    <div data-testid="noun-grammar-edit-form" className="space-y-3">
      {/* Gender Select */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {t('vocabularyCard.grammar.noun.genderLabel')}:
        </span>
        <Select
          value={formState.gender || undefined}
          onValueChange={(value) => onChange('gender', value)}
        >
          <SelectTrigger
            className="h-7 w-auto min-w-[120px] text-sm"
            data-testid="grammar-field-gender"
          >
            <SelectValue placeholder={t('vocabularyCard.grammar.noun.genderPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {GENDER_OPTIONS.map((gender) => (
              <SelectItem key={gender} value={gender}>
                {t(`vocabularyCard.grammar.noun.genders.${gender}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Declension Table */}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto bg-muted/50 px-3 py-2" />
              <TableHead className="h-auto bg-muted/50 px-3 py-2 text-xs">
                {t('vocabularyCard.grammar.noun.singular')}
              </TableHead>
              <TableHead className="h-auto bg-muted/50 px-3 py-2 text-xs">
                {t('vocabularyCard.grammar.noun.plural')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CASE_FIELDS.map(({ case: caseName }) => {
              const singularKey = `${caseName}_singular`;
              const pluralKey = `${caseName}_plural`;
              return (
                <TableRow key={caseName} className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t(`vocabularyCard.grammar.noun.cases.${caseName}`)}
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <Input
                      className="h-7 text-sm"
                      maxLength={255}
                      data-testid={`grammar-field-${singularKey}`}
                      value={formState[singularKey] ?? ''}
                      onChange={(e) => onChange(singularKey, e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <Input
                      className="h-7 text-sm"
                      maxLength={255}
                      data-testid={`grammar-field-${pluralKey}`}
                      value={formState[pluralKey] ?? ''}
                      onChange={(e) => onChange(pluralKey, e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
