// src/components/admin/vocabulary/grammar-display/NounGrammarDisplay.tsx

/**
 * NounGrammarDisplay - Read-only display of noun grammar data.
 *
 * Shows gender + declension table (4 cases × singular/plural).
 * All fields always render; missing values show "Not set".
 */

import { useTranslation } from 'react-i18next';

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

// ============================================
// Props
// ============================================

interface NounGrammarDisplayProps {
  fields: Record<string, string | null>;
}

// ============================================
// Component
// ============================================

function NotSet() {
  const { t } = useTranslation('admin');
  return <span className="italic text-muted-foreground">{t('wordEntryContent.notSet')}</span>;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function NounGrammarDisplay({ fields }: NounGrammarDisplayProps) {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-3" data-testid="noun-grammar-display">
      {/* Gender */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {t('vocabularyCard.grammar.noun.genderLabel')}:
        </span>
        <span className="font-medium">
          {fields.gender ? (
            t(`vocabularyCard.grammar.noun.genders.${fields.gender}`, {
              defaultValue: capitalize(fields.gender),
            })
          ) : (
            <NotSet />
          )}
        </span>
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
              const singularVal = fields[`${caseName}_singular`];
              const pluralVal = fields[`${caseName}_plural`];
              return (
                <TableRow key={caseName} className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t(`vocabularyCard.grammar.noun.cases.${caseName}`)}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-sm">{singularVal ?? <NotSet />}</TableCell>
                  <TableCell className="px-3 py-1.5 text-sm">{pluralVal ?? <NotSet />}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
