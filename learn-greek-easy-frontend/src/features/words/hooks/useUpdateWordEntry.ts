// src/features/words/hooks/useUpdateWordEntry.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { toast } from '@/hooks/use-toast';
import {
  wordEntryAPI,
  type WordEntryInlineUpdatePayload,
  type WordEntryResponse,
} from '@/services/wordEntryAPI';

interface UpdateWordEntryParams {
  wordEntryId: string;
  payload: WordEntryInlineUpdatePayload;
}

export interface UseUpdateWordEntryOptions {
  onSuccess?: (data: WordEntryResponse) => void;
}

export function useUpdateWordEntry(options?: UseUpdateWordEntryOptions) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('admin');

  const mutation = useMutation({
    mutationFn: ({ wordEntryId, payload }: UpdateWordEntryParams) =>
      wordEntryAPI.updateInline(wordEntryId, payload),
    onSuccess: (data, { wordEntryId }) => {
      toast({ title: t('wordEntryEdit.success') });
      queryClient.setQueryData(['wordEntry', wordEntryId], data);
      options?.onSuccess?.(data);
    },
    onError: (error: unknown) => {
      const status = (error as { status?: number })?.status;
      if (status === 404) {
        toast({
          title: t('wordEntryEdit.error'),
          description: 'Word entry no longer exists.',
          variant: 'destructive',
        });
      } else {
        toast({ title: t('wordEntryEdit.error'), variant: 'destructive' });
      }
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    variables: mutation.variables,
  };
}
