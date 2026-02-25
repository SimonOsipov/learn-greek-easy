import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { toast } from '@/hooks/use-toast';
import { wordEntryAPI, type GenerateCardType } from '@/services/wordEntryAPI';

export interface GenerateCardsParams {
  wordEntryId: string;
  cardType: GenerateCardType;
}

export function useGenerateCards() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('admin');

  return useMutation({
    mutationFn: ({ wordEntryId, cardType }: GenerateCardsParams) =>
      wordEntryAPI.generateCards(wordEntryId, cardType),
    onSuccess: (data, { wordEntryId }) => {
      toast({
        title: t('cardGenerate.success', {
          created: data.created,
          updated: data.updated,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['wordEntryCards', wordEntryId] });
    },
    onError: () => {
      toast({ title: t('cardGenerate.error'), variant: 'destructive' });
    },
  });
}
