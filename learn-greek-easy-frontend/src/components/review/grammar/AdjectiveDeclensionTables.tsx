import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdjectiveData } from '@/types/grammar';

import { GenderTabs } from './GenderTabs';

export interface AdjectiveDeclensionTablesProps {
  adjectiveData: AdjectiveData;
  /** Optional card ID for analytics tracking */
  cardId?: string;
  /** Optional session ID for analytics tracking */
  sessionId?: string;
}

export function AdjectiveDeclensionTables({
  adjectiveData,
  cardId,
  sessionId,
}: AdjectiveDeclensionTablesProps) {
  const { t } = useTranslation('review');

  const na = t('grammar.nounDeclension.notAvailable');

  return (
    <div className="space-y-4">
      {/* Gender declension tabs */}
      <GenderTabs adjectiveData={adjectiveData} cardId={cardId} sessionId={sessionId} />

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
