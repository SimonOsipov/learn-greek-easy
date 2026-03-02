// src/pages/culture/CultureDeckDetailPage.tsx

/**
 * Culture Deck Detail Page
 *
 * Displays details of a culture deck and allows starting practice sessions.
 * Similar to DeckDetailPage but tailored for culture content.
 */

import React, { useEffect, useState } from 'react';

import { ChevronLeft, BookOpen, AlertCircle, Play, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';

import { CultureBadge, type CultureCategory } from '@/components/culture';
import { QuestionBrowser } from '@/components/culture/QuestionBrowser';
import { DeckProgressBar } from '@/components/decks/DeckProgressBar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CultureDeckDetailResponse } from '@/services/cultureDeckAPI';
import type { DeckProgress } from '@/types/deck';

export function CultureDeckDetailPage() {
  const { t, i18n } = useTranslation(['deck', 'culture']);
  const { id: deckId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<CultureDeckDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch deck on mount
  useEffect(() => {
    if (!deckId) return;

    const fetchDeck = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await cultureDeckAPI.getById(deckId);
        setDeck(response);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load deck. Please try again.';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeck();
  }, [deckId]);

  // Handle invalid deckId
  if (!deckId) {
    return <NotFoundState />;
  }

  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          setIsLoading(true);
          setError(null);
          cultureDeckAPI
            .getById(deckId)
            .then(setDeck)
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load deck.'))
            .finally(() => setIsLoading(false));
        }}
      />
    );
  }

  // Not found state
  if (!deck) {
    return <NotFoundState />;
  }

  // Transform progress for DeckProgressBar compatibility
  const progress: DeckProgress | undefined = deck.progress
    ? {
        deckId: deck.id,
        status:
          deck.progress.questions_mastered >= deck.progress.questions_total
            ? 'completed'
            : deck.progress.questions_mastered > 0 || deck.progress.questions_learning > 0
              ? 'in-progress'
              : 'not-started',
        cardsTotal: deck.progress.questions_total,
        cardsNew: deck.progress.questions_new,
        cardsLearning: deck.progress.questions_learning,
        cardsReview: 0,
        cardsMastered: deck.progress.questions_mastered,
        dueToday: 0,
        streak: 0,
        lastStudied: undefined,
        totalTimeSpent: 0,
        accuracy:
          deck.progress.questions_total > 0
            ? Math.round((deck.progress.questions_mastered / deck.progress.questions_total) * 100)
            : 0,
      }
    : undefined;

  const handleStartPractice = () => {
    navigate(`/culture/${deckId}/practice`);
  };

  // Get culture category from deck
  const cultureCategory = deck.category as CultureCategory | undefined;

  return (
    <div data-testid="deck-detail" className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
      {/* Breadcrumb Navigation */}
      <nav
        data-testid="breadcrumb"
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
        aria-label="Breadcrumb"
      >
        <Link
          to="/decks"
          className="flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('deck:detail.breadcrumb')}
        </Link>
        <span>/</span>
        <span className="truncate font-medium text-foreground">
          {getLocalizedDeckName(deck, i18n.language)}
        </span>
      </nav>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Deck Header Section */}
        <Card>
          <CardHeader>
            {/* Title and Badges Row */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Title */}
                <h1 className="mb-1 text-2xl font-semibold text-foreground md:text-3xl">
                  {getLocalizedDeckName(deck, i18n.language)}
                </h1>
              </div>

              {/* Culture Badge */}
              <div className="flex flex-shrink-0 items-center gap-2">
                <CultureBadge category={cultureCategory} showLabel={true} />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Description */}
            {deck.description && (
              <p className="leading-relaxed text-foreground">{deck.description}</p>
            )}

            {/* Progress Bar (if has progress) */}
            {progress && progress.status !== 'not-started' && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t('deck:detail.yourProgress')}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(
                      ((progress.cardsLearning + progress.cardsMastered) / progress.cardsTotal) *
                        100
                    )}
                    % {t('deck:detail.complete')}
                  </span>
                </div>
                <DeckProgressBar progress={progress} showLegend={true} size="large" />
              </div>
            )}

            {/* Action Button */}
            <div className="mt-6">
              {progress && progress.status !== 'not-started' ? (
                <Button
                  data-testid="start-practice-button"
                  variant="hero"
                  size="lg"
                  onClick={handleStartPractice}
                  className="w-full"
                >
                  <TrendingUp className="mr-2 h-5 w-5" />
                  {t('culture:practice.continuePractice')}
                </Button>
              ) : (
                <Button
                  data-testid="start-practice-button"
                  variant="hero"
                  size="lg"
                  onClick={handleStartPractice}
                  className="w-full"
                >
                  <Play className="mr-2 h-5 w-5" />
                  {t('culture:practice.startPractice')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Question Browser */}
        <QuestionBrowser deckId={deckId} totalQuestions={deck.question_count} />
      </div>
    </div>
  );
}

// Loading Skeleton Component
const LoadingSkeleton: React.FC = () => {
  return (
    <div data-testid="deck-detail" className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
      {/* Breadcrumb Skeleton */}
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Header Skeleton */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>

      {/* Question Grid Skeleton */}
      <div className="space-y-4">
        {/* Search + Filter bar skeleton */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 w-full sm:w-64" />
          <Skeleton className="h-8 w-48" />
        </div>
        {/* Count skeleton */}
        <Skeleton className="h-4 w-40" />
        {/* Grid skeleton: 6 question cards */}
        <div
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          className="grid gap-3"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
};

// Error State Component
interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  const { t } = useTranslation('deck');

  return (
    <div data-testid="deck-detail" className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('detail.error.title')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>

      <Card>
        <CardContent className="py-12 pt-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500 dark:text-red-400" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            {t('detail.error.failedToLoad')}
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            {t('detail.error.description')}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => window.history.back()}>
              {t('detail.goBack')}
            </Button>
            <Button onClick={onRetry}>{t('detail.tryAgain')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Not Found State Component
const NotFoundState: React.FC = () => {
  const { t } = useTranslation('deck');
  const navigate = useNavigate();

  return (
    <div data-testid="deck-detail" className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
      <Card>
        <CardContent className="py-12 pt-6 text-center">
          <BookOpen className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">{t('detail.notFound')}</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            {t('detail.notFoundDescription')}
          </p>
          <Button onClick={() => navigate('/decks')}>{t('detail.browseAll')}</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CultureDeckDetailPage;
