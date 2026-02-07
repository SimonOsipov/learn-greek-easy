import { useState } from 'react';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trackGrammarGenderChanged } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { AdjectiveData } from '@/types/grammar';

const GENDERS = ['masculine', 'feminine', 'neuter'] as const;
type Gender = (typeof GENDERS)[number];

export interface GenderTabsProps {
  adjectiveData: AdjectiveData;
  /** Optional card ID for analytics tracking */
  cardId?: string;
  /** Optional session ID for analytics tracking */
  sessionId?: string;
  /** Whether the card is flipped (controls blur state) */
  isFlipped?: boolean;
}

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
  isFlipped?: boolean;
}

function GenderTable({ gender, data, na, t, isFlipped = true }: GenderTableProps) {
  const cases = ['nominative', 'genitive', 'accusative', 'vocative'] as const;

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
            {cases.map((caseKey) => (
              <TableRow key={caseKey} className="hover:bg-transparent">
                <TableCell className="bg-muted/50 px-4 py-2 font-medium text-muted-foreground">
                  {t(`grammar.nounDeclension.cases.${caseKey}`)}
                </TableCell>
                <TableCell
                  className={cn(
                    'px-4 py-2 text-center text-foreground transition-[filter] duration-200',
                    !isFlipped && 'select-none blur-md'
                  )}
                >
                  {data[caseKey].singular || na}
                </TableCell>
                <TableCell
                  className={cn(
                    'px-4 py-2 text-center text-foreground transition-[filter] duration-200',
                    !isFlipped && 'select-none blur-md'
                  )}
                >
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

export function GenderTabs({
  adjectiveData,
  cardId,
  sessionId,
  isFlipped = true,
}: GenderTabsProps) {
  const { t } = useTranslation('review');
  const [selectedGender, setSelectedGender] = useState<Gender>('masculine');

  const na = t('grammar.nounDeclension.notAvailable');

  const handleGenderChange = (newGender: string) => {
    const gender = newGender as Gender;

    // Track analytics if context is provided
    if (cardId && sessionId) {
      trackGrammarGenderChanged({
        card_id: cardId,
        part_of_speech: 'adjective',
        from_gender: selectedGender,
        to_gender: gender,
        session_id: sessionId,
      });
    }

    setSelectedGender(gender);
  };

  return (
    <Tabs value={selectedGender} onValueChange={handleGenderChange}>
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
            data={getGenderData(adjectiveData, gender)}
            na={na}
            t={t}
            isFlipped={isFlipped}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
