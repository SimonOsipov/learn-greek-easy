// src/components/admin/vocabulary/grammar-display/AdverbGrammarDisplay.tsx

/**
 * AdverbGrammarDisplay - Read-only display of adverb grammar data.
 *
 * Shows comparative and superlative fields.
 * Both fields always render; missing values show "Not set".
 */

import { useTranslation } from 'react-i18next';

import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

// ============================================
// Props
// ============================================

interface AdverbGrammarDisplayProps {
  fields: Record<string, string | null>;
}

// ============================================
// Component
// ============================================

function NotSet() {
  return <span className="italic text-muted-foreground">Not set</span>;
}

export function AdverbGrammarDisplay({ fields }: AdverbGrammarDisplayProps) {
  const { t } = useTranslation('admin');

  return (
    <div data-testid="adverb-grammar-display">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableBody>
            <TableRow className="hover:bg-transparent">
              <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {t('vocabularyCard.grammar.adverb.comparative')}
              </TableCell>
              <TableCell className="px-3 py-1.5 text-sm">
                {fields.comparative ?? <NotSet />}
              </TableCell>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {t('vocabularyCard.grammar.adverb.superlative')}
              </TableCell>
              <TableCell className="px-3 py-1.5 text-sm">
                {fields.superlative ?? <NotSet />}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
