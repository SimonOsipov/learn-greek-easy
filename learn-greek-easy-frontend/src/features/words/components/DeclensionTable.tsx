// src/features/words/components/DeclensionTable.tsx

/**
 * Declension table for noun and adjective word entries.
 * For nouns: shows singular/plural cases with gender badge.
 * For adjectives: shows tabbed interface by gender with comparison forms.
 */

import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { GenderBadge } from '@/components/review/grammar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AdjectiveData, NounData, NounDataAny, NounDataV2 } from '@/types/grammar';

// ============================================
// Types
// ============================================

export interface NounDeclensionTableProps {
  /** Noun grammar data */
  grammarData: NounDataAny;
}

export interface AdjectiveDeclensionTableProps {
  /** Adjective grammar data */
  grammarData: AdjectiveData;
}

// ============================================
// Constants
// ============================================

const CASES = ['nominative', 'genitive', 'accusative', 'vocative'] as const;
const GENDERS = ['masculine', 'feminine', 'neuter'] as const;
type Gender = (typeof GENDERS)[number];

interface CaseRow {
  case: (typeof CASES)[number];
  singular: string;
  plural: string;
}

/**
 * Detect grammar data format and extract case rows.
 * V2: grammarData.cases.singular.nominative
 * V1: grammarData.nominative_singular
 */
function extractNounCaseData(grammarData: NounDataAny): CaseRow[] {
  // V2 detection: check for nested `cases` object
  if ('cases' in grammarData && grammarData.cases) {
    const { cases } = grammarData as NounDataV2;
    return CASES.map((c) => ({
      case: c,
      singular: cases.singular?.[c] ?? '',
      plural: cases.plural?.[c] ?? '',
    }));
  }

  // V1 fallback: flat key format
  const v1 = grammarData as NounData;
  return CASES.map((c) => ({
    case: c,
    singular: (v1[`${c}_singular` as keyof NounData] as string) ?? '',
    plural: (v1[`${c}_plural` as keyof NounData] as string) ?? '',
  }));
}

// ============================================
// Noun Declension Table
// ============================================

export function NounDeclensionTable({ grammarData }: NounDeclensionTableProps) {
  const { t } = useTranslation('review');
  const na = t('grammar.nounDeclension.notAvailable');

  const caseData = extractNounCaseData(grammarData);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t('grammar.sections.declension')}</CardTitle>
          {grammarData.gender && (GENDERS as readonly string[]).includes(grammarData.gender) && (
            <GenderBadge gender={grammarData.gender} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollableTable>
          <div className="min-w-[300px] overflow-hidden rounded-md border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-auto w-[35%] bg-muted/50 px-4 py-2 font-bold" />
                  <TableHead className="h-auto bg-muted/50 px-4 py-2 text-center font-bold">
                    {t('grammar.nounDeclension.singular')}
                  </TableHead>
                  <TableHead className="h-auto bg-muted/50 px-4 py-2 text-center font-bold">
                    {t('grammar.nounDeclension.plural')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {caseData.map(({ case: caseKey, singular, plural }) => (
                  <TableRow key={caseKey} className="hover:bg-transparent">
                    <TableCell className="bg-muted/50 px-4 py-2 font-medium text-muted-foreground">
                      {t(`grammar.nounDeclension.cases.${caseKey}`)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center text-foreground">
                      {singular || na}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center text-foreground">
                      {plural || na}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollableTable>
      </CardContent>
    </Card>
  );
}

// ============================================
// Adjective Declension Table
// ============================================

interface GenderTableData {
  nominative: { singular: string; plural: string };
  genitive: { singular: string; plural: string };
  accusative: { singular: string; plural: string };
  vocative: { singular: string; plural: string };
}

function getGenderData(adjectiveData: AdjectiveData, gender: Gender): GenderTableData {
  if (gender === 'masculine') {
    return {
      nominative: {
        singular: adjectiveData.masculine_nom_sg,
        plural: adjectiveData.masculine_nom_pl,
      },
      genitive: {
        singular: adjectiveData.masculine_gen_sg,
        plural: adjectiveData.masculine_gen_pl,
      },
      accusative: {
        singular: adjectiveData.masculine_acc_sg,
        plural: adjectiveData.masculine_acc_pl,
      },
      vocative: {
        singular: adjectiveData.masculine_voc_sg,
        plural: adjectiveData.masculine_voc_pl,
      },
    };
  } else if (gender === 'feminine') {
    return {
      nominative: {
        singular: adjectiveData.feminine_nom_sg,
        plural: adjectiveData.feminine_nom_pl,
      },
      genitive: {
        singular: adjectiveData.feminine_gen_sg,
        plural: adjectiveData.feminine_gen_pl,
      },
      accusative: {
        singular: adjectiveData.feminine_acc_sg,
        plural: adjectiveData.feminine_acc_pl,
      },
      vocative: {
        singular: adjectiveData.feminine_voc_sg,
        plural: adjectiveData.feminine_voc_pl,
      },
    };
  } else {
    return {
      nominative: {
        singular: adjectiveData.neuter_nom_sg,
        plural: adjectiveData.neuter_nom_pl,
      },
      genitive: {
        singular: adjectiveData.neuter_gen_sg,
        plural: adjectiveData.neuter_gen_pl,
      },
      accusative: {
        singular: adjectiveData.neuter_acc_sg,
        plural: adjectiveData.neuter_acc_pl,
      },
      vocative: {
        singular: adjectiveData.neuter_voc_sg,
        plural: adjectiveData.neuter_voc_pl,
      },
    };
  }
}

interface GenderTableProps {
  gender: Gender;
  data: GenderTableData;
  na: string;
  t: (key: string) => string;
}

function GenderTable({ gender, data, na, t }: GenderTableProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-primary/10 px-4 py-2">
        <CardTitle className="text-sm font-semibold text-primary">
          {t(`grammar.adjectiveDeclension.genders.${gender}`)}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto w-[35%] bg-muted/50 px-4 py-2" />
              <TableHead className="h-auto bg-muted/50 px-4 py-2 text-center">
                {t('grammar.nounDeclension.singular')}
              </TableHead>
              <TableHead className="h-auto bg-muted/50 px-4 py-2 text-center">
                {t('grammar.nounDeclension.plural')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CASES.map((caseKey) => (
              <TableRow key={caseKey} className="hover:bg-transparent">
                <TableCell className="bg-muted/50 px-4 py-2 font-medium text-muted-foreground">
                  {t(`grammar.nounDeclension.cases.${caseKey}`)}
                </TableCell>
                <TableCell className="px-4 py-2 text-center text-foreground">
                  {data[caseKey].singular || na}
                </TableCell>
                <TableCell className="px-4 py-2 text-center text-foreground">
                  {data[caseKey].plural || na}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function AdjectiveDeclensionTable({ grammarData }: AdjectiveDeclensionTableProps) {
  const { t } = useTranslation('review');
  const [selectedGender, setSelectedGender] = useState<Gender>('masculine');
  const na = t('grammar.nounDeclension.notAvailable');

  // Check if comparison forms exist
  const hasComparison = grammarData.comparative || grammarData.superlative;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t('grammar.sections.declension')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gender tabs */}
        <Tabs value={selectedGender} onValueChange={(v) => setSelectedGender(v as Gender)}>
          <div className="overflow-x-auto">
            <TabsList className="inline-flex w-full min-w-max">
              {GENDERS.map((gender) => (
                <TabsTrigger key={gender} value={gender} variant="gradient" className="flex-1">
                  {t(`grammar.adjectiveDeclension.genders.${gender}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {GENDERS.map((gender) => (
            <TabsContent key={gender} value={gender} className="mt-4">
              <GenderTable
                gender={gender}
                data={getGenderData(grammarData, gender)}
                na={na}
                t={t}
              />
            </TabsContent>
          ))}
        </Tabs>

        {/* Comparison forms */}
        {hasComparison && (
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/50 px-4 py-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('grammar.adjectiveDeclension.comparison.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-auto bg-muted/50 px-4 py-2 text-center">
                      {t('grammar.adjectiveDeclension.comparison.comparative')}
                    </TableHead>
                    <TableHead className="h-auto bg-muted/50 px-4 py-2 text-center">
                      {t('grammar.adjectiveDeclension.comparison.superlative')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="px-4 py-3 text-center text-foreground">
                      {grammarData.comparative || na}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center text-foreground">
                      {grammarData.superlative || na}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
