import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { toast } from '@/hooks/use-toast';
import { wordEntryAPI } from '@/services/wordEntryAPI';

export interface GenerateAudioParams {
  wordEntryId: string;
  part: 'lemma' | 'example';
  exampleId?: string;
}

export function useGenerateAudio() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('admin');

  return useMutation({
    mutationFn: ({ wordEntryId, part, exampleId }: GenerateAudioParams) =>
      wordEntryAPI.generatePartAudio(wordEntryId, part, exampleId),
    onSuccess: (_data, { wordEntryId }) => {
      toast({ title: t('audioGenerate.success') });
      queryClient.invalidateQueries({ queryKey: ['wordEntry', wordEntryId] });
    },
    onError: () => {
      toast({ title: t('audioGenerate.error'), variant: 'destructive' });
    },
  });
}
