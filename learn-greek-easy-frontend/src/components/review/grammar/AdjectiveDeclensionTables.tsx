import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdjectiveData } from '@/types/grammar';

export interface AdjectiveDeclensionTablesProps {
  adjectiveData: AdjectiveData;
}

type Gender = 'masculine' | 'feminine' | 'neuter';

interface GenderTableProps {
  gender: Gender;
  data: {
    nominative: { singular: string; plural: string };
    genitive: { singular: string; plural: string };
    accusative: { singular: string; plural: string };
    vocative: { singular: string; plural: string };
  };
  na: string;
  t: (key: string) => string;
}

function GenderTable({ gender, data, na, t }: GenderTableProps) {
  const cases = ['nominative', 'genitive', 'accusative', 'vocative'] as const;

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
            {cases.map((caseKey) => (
              <TableRow key={caseKey} className="hover:bg-transparent">
                <TableCell className="bg-muted/50 px-4 py-2 font-medium text-muted-foreground">
                  {t(`grammar.nounDeclension.cases.${caseKey}`)}
                </TableCell>
                <TableCell className="px-4 py-2 text-center">
                  {data[caseKey].singular || na}
                </TableCell>
                <TableCell className="px-4 py-2 text-center">
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

export function AdjectiveDeclensionTables({ adjectiveData }: AdjectiveDeclensionTablesProps) {
  const { t } = useTranslation('review');

  const na = t('grammar.nounDeclension.notAvailable');

  // Organize data by gender
  const genderData = {
    masculine: {
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
    },
    feminine: {
      nominative: {
        singular: adjectiveData.feminine_nom_sg,
        plural: adjectiveData.feminine_nom_pl,
      },
      genitive: { singular: adjectiveData.feminine_gen_sg, plural: adjectiveData.feminine_gen_pl },
      accusative: {
        singular: adjectiveData.feminine_acc_sg,
        plural: adjectiveData.feminine_acc_pl,
      },
      vocative: { singular: adjectiveData.feminine_voc_sg, plural: adjectiveData.feminine_voc_pl },
    },
    neuter: {
      nominative: { singular: adjectiveData.neuter_nom_sg, plural: adjectiveData.neuter_nom_pl },
      genitive: { singular: adjectiveData.neuter_gen_sg, plural: adjectiveData.neuter_gen_pl },
      accusative: { singular: adjectiveData.neuter_acc_sg, plural: adjectiveData.neuter_acc_pl },
      vocative: { singular: adjectiveData.neuter_voc_sg, plural: adjectiveData.neuter_voc_pl },
    },
  };

  const genders: Gender[] = ['masculine', 'feminine', 'neuter'];

  return (
    <div className="space-y-4">
      {/* Gender declension tables */}
      <div className="grid gap-4 md:grid-cols-3">
        {genders.map((gender) => (
          <GenderTable key={gender} gender={gender} data={genderData[gender]} na={na} t={t} />
        ))}
      </div>

      {/* Comparison section */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-primary/10 px-4 py-2">
          <CardTitle className="text-sm font-semibold text-primary">
            {t('grammar.adjectiveDeclension.comparison.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2">
            <div className="border-r border-border p-4">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {t('grammar.adjectiveDeclension.comparison.comparative')}
              </div>
              <div className="text-sm">{adjectiveData.comparative || na}</div>
            </div>
            <div className="p-4">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {t('grammar.adjectiveDeclension.comparison.superlative')}
              </div>
              <div className="text-sm">{adjectiveData.superlative || na}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
