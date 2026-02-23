// src/components/admin/vocabulary/grammar-display/grammar-edit/VerbGrammarEditForm.tsx

/**
 * VerbGrammarEditForm - Editable form for verb grammar data.
 *
 * Mirrors VerbGrammarDisplay layout: voice select + 5 tense tabs with
 * 6-person conjugation tables + imperative section, using Input fields.
 */

import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ============================================
// Constants
// ============================================

const TENSES = ['present', 'imperfect', 'past', 'future', 'perfect'] as const;

const PERSONS = [
  { key: '1s', labelKey: 'firstSingular' },
  { key: '2s', labelKey: 'secondSingular' },
  { key: '3s', labelKey: 'thirdSingular' },
  { key: '1p', labelKey: 'firstPlural' },
  { key: '2p', labelKey: 'secondPlural' },
  { key: '3p', labelKey: 'thirdPlural' },
] as const;

const VOICE_OPTIONS = ['active', 'passive'] as const;

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

export function VerbGrammarEditForm({ formState, onChange }: GrammarEditFormProps) {
  const { t } = useTranslation('admin');

  return (
    <div data-testid="verb-grammar-edit-form" className="space-y-3">
      {/* Voice Select */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {t('vocabularyCard.grammar.verb.voiceLabel')}:
        </span>
        <Select
          value={formState.voice || undefined}
          onValueChange={(value) => onChange('voice', value)}
        >
          <SelectTrigger
            className="h-7 w-auto min-w-[120px] text-sm"
            data-testid="grammar-field-voice"
          >
            <SelectValue placeholder={t('vocabularyCard.grammar.verb.voicePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {VOICE_OPTIONS.map((voice) => (
              <SelectItem key={voice} value={voice}>
                {t(`vocabularyCard.grammar.verb.voices.${voice}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conjugation Tabs + Imperative */}
      <ScrollArea className="max-h-[400px]">
        <Tabs defaultValue="present" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {TENSES.map((tense) => (
              <TabsTrigger key={tense} value={tense} className="text-xs">
                {t(`vocabularyCard.grammar.verb.tenses.${tense}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          {TENSES.map((tense) => (
            <TabsContent key={tense} value={tense}>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-auto bg-muted/50 px-3 py-2 text-xs">
                        {t(`vocabularyCard.grammar.verb.tenses.${tense}`)}
                      </TableHead>
                      <TableHead className="h-auto bg-muted/50 px-3 py-2" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERSONS.map(({ key: personKey, labelKey }) => {
                      const fieldKey = `${tense}_${personKey}`;
                      return (
                        <TableRow key={personKey} className="hover:bg-transparent">
                          <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            {t(`vocabularyCard.grammar.verb.persons.${labelKey}`)}
                          </TableCell>
                          <TableCell className="px-3 py-1.5">
                            <Input
                              className="h-7 text-sm"
                              maxLength={255}
                              data-testid={`grammar-field-${fieldKey}`}
                              value={formState[fieldKey] ?? ''}
                              onChange={(e) => onChange(fieldKey, e.target.value)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Imperative Section */}
        <div className="mt-3 space-y-2">
          <h4 className="text-sm font-medium">
            {t('vocabularyCard.grammar.verb.imperative.title')}
          </h4>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableBody>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('vocabularyCard.grammar.verb.imperative.singular')}
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <Input
                      className="h-7 text-sm"
                      maxLength={255}
                      data-testid="grammar-field-imperative_2s"
                      value={formState.imperative_2s ?? ''}
                      onChange={(e) => onChange('imperative_2s', e.target.value)}
                    />
                  </TableCell>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('vocabularyCard.grammar.verb.imperative.plural')}
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <Input
                      className="h-7 text-sm"
                      maxLength={255}
                      data-testid="grammar-field-imperative_2p"
                      value={formState.imperative_2p ?? ''}
                      onChange={(e) => onChange('imperative_2p', e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
