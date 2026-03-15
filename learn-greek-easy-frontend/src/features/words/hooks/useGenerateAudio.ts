import { useCallback, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { toast } from '@/hooks/use-toast';
import { useSSE } from '@/hooks/useSSE';
import { wordEntryAPI, type WordEntryResponse } from '@/services/wordEntryAPI';
import type { SSEEvent } from '@/types/sse';
import type {
  WordAudioErrorData,
  WordAudioPartCompleteData,
  WordAudioPartData,
  WordAudioPartKey,
  WordAudioProgress,
  WordAudioStartData,
} from '@/types/wordAudioSSE';

export interface UseGenerateAudioOptions {
  wordEntryId: string;
}

export interface UseGenerateAudioResult {
  triggerGeneration: () => void;
  cancel: () => void;
  progress: WordAudioProgress;
  isGenerating: boolean;
}

const INITIAL_PROGRESS: WordAudioProgress = {
  parts: new Map(),
  totalParts: 0,
  partsCompleted: 0,
  status: 'idle',
  errorMessage: null,
};

function makePartKey(part: 'lemma' | 'example', exampleId: string | null): WordAudioPartKey {
  return part === 'lemma' ? 'lemma' : `example:${exampleId ?? ''}`;
}

export function useGenerateAudio({ wordEntryId }: UseGenerateAudioOptions): UseGenerateAudioResult {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const [streamEnabled, setStreamEnabled] = useState(false);
  const [progress, setProgress] = useState<WordAudioProgress>(INITIAL_PROGRESS);

  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      const { type, data } = event;

      switch (type) {
        case 'word_audio:start': {
          const d = data as WordAudioStartData;
          setProgress((prev) => ({
            ...prev,
            status: 'generating',
            totalParts: d.part_count,
          }));
          break;
        }

        case 'word_audio:tts':
        case 'word_audio:upload':
        case 'word_audio:persist': {
          const d = data as WordAudioPartData;
          const stage = type.split(':')[1] as 'tts' | 'upload' | 'persist';
          const key = makePartKey(d.part, d.example_id);
          setProgress((prev) => {
            const parts = new Map(prev.parts);
            parts.set(key, stage);
            return { ...prev, parts };
          });
          break;
        }

        case 'word_audio:part_complete': {
          const d = data as WordAudioPartCompleteData;
          const key = makePartKey(d.part, d.example_id);
          setProgress((prev) => {
            const parts = new Map(prev.parts);
            parts.set(key, 'complete');
            return { ...prev, parts, partsCompleted: prev.partsCompleted + 1 };
          });
          // Optimistically update cache
          queryClient.setQueryData<WordEntryResponse>(['wordEntry', wordEntryId], (old) => {
            if (!old) return old;
            if (d.part === 'lemma') {
              return { ...old, audio_status: 'ready' as const };
            }
            if (d.example_id && old.examples) {
              return {
                ...old,
                examples: old.examples.map((ex) =>
                  ex.id === d.example_id ? { ...ex, audio_status: 'ready' as const } : ex
                ),
              };
            }
            return old;
          });
          break;
        }

        case 'word_audio:complete': {
          setProgress((prev) => ({ ...prev, status: 'complete' }));
          setStreamEnabled(false);
          queryClient.invalidateQueries({ queryKey: ['wordEntry', wordEntryId] });
          toast({ title: t('audioGenerate.success') });
          break;
        }

        case 'word_audio:error': {
          const d = data as WordAudioErrorData;
          setProgress((prev) => {
            const parts = new Map(prev.parts);
            if (d.part) {
              parts.set(makePartKey(d.part, d.example_id), 'error');
            }
            return { ...prev, parts, status: 'error', errorMessage: d.error };
          });
          setStreamEnabled(false);
          toast({ title: t('audioGenerate.error'), variant: 'destructive' });
          break;
        }
      }
    },
    [queryClient, wordEntryId, t]
  );

  useSSE(wordEntryAPI.generateAudioStreamUrl(wordEntryId), {
    method: 'POST',
    enabled: streamEnabled,
    onEvent: handleSSEEvent,
    onError: (err) => {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { message?: string }).message ?? 'Stream error');
      setProgress((prev) => ({ ...prev, status: 'error', errorMessage: msg }));
      setStreamEnabled(false);
      toast({ title: t('audioGenerate.error'), variant: 'destructive' });
    },
    maxRetries: 0,
    reconnect: false,
  });

  const triggerGeneration = useCallback(() => {
    setProgress(INITIAL_PROGRESS);
    setStreamEnabled(true);
  }, []);

  const cancelGeneration = useCallback(() => {
    setStreamEnabled(false);
    setProgress(INITIAL_PROGRESS);
  }, []);

  return {
    triggerGeneration,
    cancel: cancelGeneration,
    progress,
    isGenerating: progress.status === 'generating',
  };
}
