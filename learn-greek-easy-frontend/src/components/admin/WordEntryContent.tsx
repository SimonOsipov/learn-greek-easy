import { useCallback, useEffect, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGenerateAudio } from '@/features/words/hooks';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import { toast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

import { ExamplesEditSection } from './vocabulary/grammar-display/ExamplesEditSection';
import { GrammarEditSection } from './vocabulary/grammar-display/GrammarEditSection';
import { IdentityEditSection } from './vocabulary/grammar-display/IdentityEditSection';
import { TranslationsEditSection } from './vocabulary/grammar-display/TranslationsEditSection';

interface WordEntryContentProps {
  wordEntryId: string;
  deckId?: string;
  onUnlinked?: () => void;
}

export function WordEntryContent({ wordEntryId, deckId, onUnlinked }: WordEntryContentProps) {
  const { wordEntry, isLoading, isError, refetch } = useWordEntry({
    wordId: wordEntryId,
  });
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [autoGenerateAfterEdit, setAutoGenerateAfterEdit] = useState(false);
  const { t } = useTranslation('admin');

  const { triggerGeneration, isGenerating } = useGenerateAudio({
    wordEntryId,
  });

  useEffect(() => {
    if (autoGenerateAfterEdit) {
      triggerGeneration();
      setAutoGenerateAfterEdit(false);
    }
  }, [autoGenerateAfterEdit, triggerGeneration]);

  const unlinkMutation = useMutation({
    mutationFn: () => {
      if (!deckId || !wordEntry) throw new Error('Missing deckId or wordEntry');
      return adminAPI.unlinkWordEntry(deckId, wordEntry.id);
    },
    onSuccess: () => {
      setShowUnlinkConfirm(false);
      toast({ description: t('wordEntry.unlinkSuccess') });
      onUnlinked?.();
    },
    onError: (error: unknown) => {
      const apiErr = error as { detail?: string };
      toast({
        description: apiErr.detail ?? 'Failed to unlink word entry',
        variant: 'destructive',
      });
    },
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

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !wordEntry) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <ContentFields
        wordEntry={wordEntry}
        onGenerateClick={handleGenerateAllClick}
        isGenerating={isGenerating}
        showUnlinkButton={Boolean(deckId)}
        onUnlinkClick={() => setShowUnlinkConfirm(true)}
        onAudioRegenNeeded={() => setAutoGenerateAfterEdit(true)}
      />
      {deckId && (
        <AlertDialog open={showUnlinkConfirm} onOpenChange={setShowUnlinkConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('wordEntry.unlinkTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('wordEntry.unlinkConfirm')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => unlinkMutation.mutate()}
                disabled={unlinkMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
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
  showUnlinkButton,
  onUnlinkClick,
  onAudioRegenNeeded,
}: {
  wordEntry: WordEntryResponse;
  onGenerateClick: () => void;
  isGenerating: boolean;
  showUnlinkButton: boolean;
  onUnlinkClick: () => void;
  onAudioRegenNeeded: () => void;
}) {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-3" data-testid="word-entry-content-fields">
      <IdentityEditSection
        wordEntry={wordEntry}
        onGenerateClick={onGenerateClick}
        isGenerating={isGenerating}
      />

      <TranslationsEditSection wordEntry={wordEntry} />

      <GrammarEditSection wordEntry={wordEntry} />

      <ExamplesEditSection wordEntry={wordEntry} onAudioRegenNeeded={onAudioRegenNeeded} />

      {showUnlinkButton && (
        <div data-testid="word-entry-actions-footer" className="flex justify-end pt-1">
          <Button
            variant="outline"
            size="sm"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={onUnlinkClick}
            data-testid="word-entry-unlink-btn"
          >
            {t('wordEntry.unlinkButton')}
          </Button>
        </div>
      )}
    </div>
  );
}
