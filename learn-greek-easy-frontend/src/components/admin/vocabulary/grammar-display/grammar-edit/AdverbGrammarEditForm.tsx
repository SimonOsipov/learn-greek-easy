// src/components/admin/vocabulary/grammar-display/grammar-edit/AdverbGrammarEditForm.tsx

/**
 * AdverbGrammarEditForm - Editable form for adverb grammar data.
 *
 * Mirrors AdverbGrammarDisplay layout: simple 2-row table with
 * comparative and superlative Input fields.
 */

import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

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

export function AdverbGrammarEditForm({ formState, onChange }: GrammarEditFormProps) {
  const { t } = useTranslation('admin');

  return (
    <div data-testid="adverb-grammar-edit-form">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableBody>
            <TableRow className="hover:bg-transparent">
              <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {t('vocabularyCard.grammar.adverb.comparative')}
              </TableCell>
              <TableCell className="px-3 py-1.5">
                <Input
                  className="h-7 text-sm"
                  maxLength={255}
                  data-testid="grammar-field-comparative"
                  value={formState.comparative ?? ''}
                  onChange={(e) => onChange('comparative', e.target.value)}
                />
              </TableCell>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {t('vocabularyCard.grammar.adverb.superlative')}
              </TableCell>
              <TableCell className="px-3 py-1.5">
                <Input
                  className="h-7 text-sm"
                  maxLength={255}
                  data-testid="grammar-field-superlative"
                  value={formState.superlative ?? ''}
                  onChange={(e) => onChange('superlative', e.target.value)}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
