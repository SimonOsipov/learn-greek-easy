// src/features/words/components/DeclensionTable.tsx

/**
 * Declension table for noun and adjective word entries.
 * For nouns: shows singular/plural cases with gender badge.
 * For adjectives: shows tabbed interface by gender with comparison forms.
 */

import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
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
import type { AdjectiveData, NounData } from '@/types/grammar';

// ============================================
// Types
// ============================================

export interface NounDeclensionTableProps {
  /** Noun grammar data */
  grammarData: NounData;
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

// ============================================
// Noun Declension Table
// ============================================

export function NounDeclensionTable({ grammarData }: NounDeclensionTableProps) {
  const { t } = useTranslation('review');
  const na = t('grammar.nounDeclension.notAvailable');

  const caseData = CASES.map((caseKey) => ({
    case: caseKey,
    singular: grammarData[`${caseKey}_singular` as keyof NounData] as string,
    plural: grammarData[`${caseKey}_plural` as keyof NounData] as string,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t('grammar.sections.declension')}</CardTitle>
          <Badge variant="secondary" className="capitalize">
            {t(`grammar.nounDeclension.genders.${grammarData.gender}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollableTable>
          <div className="min-w-[300px] overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-auto bg-muted/50 px-4 py-2 font-bold" />
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
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto bg-muted/50 px-4 py-2" />
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
