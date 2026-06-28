import { useCallback } from 'react';

import { AlertCircle } from 'lucide-react';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGenerateAudio } from '@/features/words/hooks';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

import { GrammarEditSection } from './vocabulary/grammar-display/GrammarEditSection';
import { IdentityEditSection } from './vocabulary/grammar-display/IdentityEditSection';
import { TranslationsEditSection } from './vocabulary/grammar-display/TranslationsEditSection';

interface WordEntryContentProps {
  wordEntryId: string;
  /** Whether the underlying query should run (default true). Lets callers gate
   * the fetch when this panel is mounted-but-hidden behind a tab. */
  enabled?: boolean;
}

export function WordEntryContent({ wordEntryId, enabled = true }: WordEntryContentProps) {
  const { wordEntry, isLoading, isError, refetch } = useWordEntry({
    wordId: wordEntryId,
    enabled,
  });

  const { triggerGeneration, isGenerating } = useGenerateAudio({
    wordEntryId,
  });

  const handleGenerateAllClick = useCallback(() => {
    if (!wordEntry) return;
    if (typeof posthog?.capture === 'function') {
      posthog.capture('admin_audio_generation_triggered', {
        word_entry_id: wordEntry.id,
        deck_id: wordEntry.deck_id,
        action: 'generate_all',
        lemma: wordEntry.lemma,
      });
    }
    triggerGeneration();
  }, [wordEntry, triggerGeneration]);

  // When the tab is disabled (panel mounted but hidden) and no data has loaded yet,
  // return null rather than ErrorState — the query isn't running so wordEntry is
  // legitimately null; it's not an error condition.
  if (!enabled && !wordEntry) return null;

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !wordEntry) return <ErrorState onRetry={refetch} />;

  return (
    <ContentFields
      wordEntry={wordEntry}
      onGenerateClick={handleGenerateAllClick}
      isGenerating={isGenerating}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" data-testid="word-entry-content-loading">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-48" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('admin');
  return (
    <div data-testid="word-entry-content-error">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t('wordEntryContent.errorTitle')}</AlertDescription>
      </Alert>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="mt-3"
        data-testid="word-entry-content-retry"
      >
        {t('wordEntryContent.errorRetry')}
      </Button>
    </div>
  );
}

// ============================================
// ContentFields
// ============================================

function ContentFields({
  wordEntry,
  onGenerateClick,
  isGenerating,
}: {
  wordEntry: WordEntryResponse;
  onGenerateClick: () => void;
  isGenerating: boolean;
}) {
  return (
    <div className="space-y-3" data-testid="word-entry-content-fields">
      <IdentityEditSection
        wordEntry={wordEntry}
        onGenerateClick={onGenerateClick}
        isGenerating={isGenerating}
      />

      <TranslationsEditSection wordEntry={wordEntry} />

      <GrammarEditSection wordEntry={wordEntry} />
    </div>
  );
}
