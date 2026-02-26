// src/features/words/pages/WordPracticePage.tsx

/**
 * Word Practice Page - full-screen flashcard practice experience.
 *
 * Fetches card records for a word entry and presents them one at a time
 * via the PracticeCard component. Supports flip-to-reveal and random
 * card navigation. Rendered outside AppLayout for an immersive experience.
 */

import { useState, useCallback, useEffect } from 'react';

import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import type { CardRecordResponse, WordEntryResponse } from '@/services/wordEntryAPI';

import { PracticeCard } from '../components';
import { useWordEntry, useWordEntryCards } from '../hooks';

// ============================================
// Helpers
// ============================================

function resolveCardAudioUrl(
  card: CardRecordResponse,
  wordEntry: WordEntryResponse | null | undefined
): string | null {
  if (!wordEntry) return null;
  if (card.card_type === 'meaning_el_to_en' || card.card_type === 'meaning_en_to_el') {
    const url = wordEntry.audio_url;
    return url || null; // treat empty string as null
  }
  if (card.card_type === 'sentence_translation') {
    const front = card.front_content as Record<string, unknown>;
    const exampleId = typeof front.example_id === 'string' ? front.example_id : undefined;
    if (!exampleId || !wordEntry.examples) return null;
    const example = wordEntry.examples.find((ex) => ex.id === exampleId);
    return example?.audio_url || null; // treat empty string as null
  }
  return null; // plural_form, article, conjugation, declension, cloze
}

// ============================================
// Loading Skeleton
// ============================================

function WordPracticePageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background p-4 md:p-8">
      <div className="mx-auto w-full max-w-lg">
        <Skeleton className="mb-6 h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="mx-auto mt-4 h-10 w-32" />
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function WordPracticePage() {
  const { t } = useTranslation('deck');
  const { deckId, wordId } = useParams<{ deckId: string; wordId: string }>();

  const { cards, isLoading, isError, refetch } = useWordEntryCards({
    wordEntryId: wordId || '',
    enabled: !!wordId,
  });

  const { wordEntry } = useWordEntry({
    wordId: wordId || '',
    enabled: !!wordId,
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Lift audio state to page level so the "A" shortcut can control it
  const _hookCurrentCard =
    cards && cards.length > 0 ? cards[Math.min(currentIndex, cards.length - 1)] : null;
  const hookAudioUrl = _hookCurrentCard ? resolveCardAudioUrl(_hookCurrentCard, wordEntry) : null;
  const {
    isPlaying: audioIsPlaying,
    isLoading: audioIsLoading,
    error: audioError,
    toggle: audioToggle,
  } = useAudioPlayer(hookAudioUrl);

  const backUrl = `/decks/${deckId}/words/${wordId}`;

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNextCard = useCallback(() => {
    if (!cards || cards.length <= 1) return;

    let nextIndex: number;
    do {
      nextIndex = Math.floor(Math.random() * cards.length);
    } while (nextIndex === currentIndex);

    setCurrentIndex(nextIndex);
    setIsFlipped(false);
  }, [cards, currentIndex]);

  const handleRate = useCallback(
    (rating: number) => {
      // For now, just advance to next card (SRS integration later)
      void rating;
      handleNextCard();
    },
    [handleNextCard]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!isFlipped) {
          handleFlip();
        } else {
          handleNextCard();
        }
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        if (hookAudioUrl && _hookCurrentCard) {
          const prompt =
            typeof (_hookCurrentCard.front_content as Record<string, unknown>)?.prompt === 'string'
              ? ((_hookCurrentCard.front_content as Record<string, unknown>).prompt as string)
              : '';
          const showAudioOnFront =
            _hookCurrentCard.card_type === 'meaning_el_to_en' ||
            (_hookCurrentCard.card_type === 'sentence_translation' &&
              prompt === 'Translate this sentence');
          const showAudioOnBack =
            _hookCurrentCard.card_type === 'meaning_en_to_el' ||
            (_hookCurrentCard.card_type === 'sentence_translation' &&
              prompt === 'Translate to Greek');
          if (isFlipped ? showAudioOnBack : showAudioOnFront) {
            audioToggle();
          }
        }
        return;
      }

      // 1-4 keys for SRS ratings (only when card is flipped/revealed)
      if (isFlipped && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleRate(parseInt(e.key, 10));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isFlipped,
    handleFlip,
    handleNextCard,
    handleRate,
    audioToggle,
    hookAudioUrl,
    _hookCurrentCard,
  ]);

  // Loading state
  if (isLoading) {
    return <WordPracticePageSkeleton />;
  }

  // Error state
  if (isError) {
    return (
      <div className="flex min-h-screen flex-col bg-background p-4 md:p-8">
        <div className="mx-auto w-full max-w-lg">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-6"
            data-testid="practice-close-button"
          >
            <Link to={backUrl}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t('detail.goBack')}
            </Link>
          </Button>
          <Alert variant="destructive">
            <AlertTitle>{t('practice.title')}</AlertTitle>
            <AlertDescription>{t('practice.error')}</AlertDescription>
          </Alert>
          <Button onClick={() => refetch()} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('practice.retry')}
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!cards || cards.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-background p-4 md:p-8">
        <div className="mx-auto w-full max-w-lg">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-6"
            data-testid="practice-close-button"
          >
            <Link to={backUrl}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t('detail.goBack')}
            </Link>
          </Button>
          <div className="py-12 text-center">
            <p className="text-muted-foreground">{t('practice.noCards')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Ready state — guard currentIndex against stale data
  const safeIndex = Math.min(currentIndex, cards.length - 1);
  const currentCard = cards[safeIndex];
  const audioState = {
    audioUrl: resolveCardAudioUrl(currentCard, wordEntry),
    isPlaying: audioIsPlaying,
    isLoading: audioIsLoading,
    error: audioError,
    onToggle: audioToggle,
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-background p-4 md:p-8"
      data-testid="practice-page"
    >
      <div className="mx-auto w-full max-w-lg">
        {/* Header with back link */}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-6"
          data-testid="practice-close-button"
        >
          <Link to={backUrl}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('detail.goBack')}
          </Link>
        </Button>

        {/* Practice card */}
        <PracticeCard
          key={currentCard.id}
          card={currentCard}
          isFlipped={isFlipped}
          onFlip={handleFlip}
          translationRu={wordEntry?.translation_ru ?? null}
          translationRuPlural={wordEntry?.translation_ru_plural ?? null}
          onRate={handleRate}
          audioState={audioState}
          wordEntryId={wordId}
          deckId={deckId}
        />

        {/* Next card button — only show if more than 1 card */}
        {cards.length > 1 && (
          <div className="mt-6 flex justify-center">
            <Button onClick={handleNextCard} variant="outline" data-testid="practice-next-button">
              {t('practice.nextCard')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
