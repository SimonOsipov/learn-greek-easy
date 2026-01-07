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
import { DeckProgressBar } from '@/components/decks/DeckProgressBar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CultureDeckDetailResponse } from '@/services/cultureDeckAPI';
import type { DeckProgress } from '@/types/deck';

export function CultureDeckDetailPage() {
  const { t } = useTranslation(['deck', 'culture']);
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
        className="mb-4 flex items-center gap-2 text-sm text-gray-600"
        aria-label="Breadcrumb"
      >
        <Link to="/decks" className="flex items-center gap-1 transition-colors hover:text-gray-900">
          <ChevronLeft className="h-4 w-4" />
          {t('deck:detail.breadcrumb')}
        </Link>
        <span>/</span>
        <span className="truncate font-medium text-gray-900">{deck.name.el}</span>
      </nav>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Deck Header Section */}
        <Card>
          <CardHeader>
            {/* Title and Badges Row */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Greek Title */}
                <h1 className="mb-1 text-2xl font-semibold text-gray-900 md:text-3xl">
                  {deck.name.el}
                </h1>
                {/* English Subtitle */}
                <p className="text-base text-gray-600 md:text-lg">{deck.name.en}</p>
              </div>

              {/* Culture Badge */}
              <div className="flex flex-shrink-0 items-center gap-2">
                <CultureBadge category={cultureCategory} showLabel={true} />
              </div>
            </div>

            {/* Category Info */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="capitalize">{deck.category}</span>
              <span>-</span>
              <span>{t('culture:deck.culture')}</span>
            </div>
          </CardHeader>

          <CardContent>
            {/* Description */}
            <p className="leading-relaxed text-gray-700">{deck.description.en}</p>

            {/* Progress Bar (if has progress) */}
            {progress && progress.status !== 'not-started' && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {t('deck:detail.yourProgress')}
                  </span>
                  <span className="text-sm text-gray-600">
                    {Math.round(
                      ((progress.cardsLearning + progress.cardsMastered) / progress.cardsTotal) * 100
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
                  size="lg"
                  onClick={handleStartPractice}
                  className="w-full bg-gradient-to-br from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700"
                >
                  <TrendingUp className="mr-2 h-5 w-5" />
                  {t('culture:practice.continuePractice')}
                </Button>
              ) : (
                <Button
                  data-testid="start-practice-button"
                  size="lg"
                  onClick={handleStartPractice}
                  className="w-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700"
                >
                  <Play className="mr-2 h-5 w-5" />
                  {t('culture:practice.startPractice')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistics Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{t('deck:detail.statistics')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              {/* Total Questions */}
              <StatCard
                icon={<BookOpen className="h-5 w-5 text-blue-500" />}
                label={t('culture:deck.questions')}
                value={deck.question_count}
                subtext={t('culture:deck.multipleChoice')}
              />
            </div>

            {/* Question Distribution (if started) */}
            {progress && progress.status !== 'not-started' && (
              <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-400">{progress.cardsNew}</p>
                  <p className="mt-1 text-xs text-gray-600">{t('deck:detail.new')}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-500">{progress.cardsLearning}</p>
                  <p className="mt-1 text-xs text-gray-600">{t('deck:detail.learning')}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{progress.cardsMastered}</p>
                  <p className="mt-1 text-xs text-gray-600">{t('deck:detail.masteredLabel')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Reusable Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtext }) => {
  return (
    <div className="flex flex-col items-center rounded-lg bg-gray-50 p-3 text-center">
      <div className="mb-2">{icon}</div>
      <p className="mb-1 text-xs text-gray-600">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{subtext}</p>
    </div>
  );
};

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

      {/* Stats Skeleton */}
      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg bg-gray-50 p-3">
                <Skeleton className="mx-auto mb-2 h-5 w-5" />
                <Skeleton className="mx-auto mb-1 h-4 w-16" />
                <Skeleton className="mx-auto h-6 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="py-8 text-center">
            <Skeleton className="mx-auto mb-4 h-12 w-12 rounded-full" />
            <Skeleton className="mx-auto mb-2 h-6 w-48" />
            <Skeleton className="mx-auto mb-6 h-4 w-64" />
            <Skeleton className="mx-auto h-12 w-48 rounded-lg" />
          </div>
        </CardContent>
      </Card>
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
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            {t('detail.error.failedToLoad')}
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-600">
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
          <BookOpen className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          <h2 className="mb-2 text-xl font-semibold text-gray-900">{t('detail.notFound')}</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-600">
            {t('detail.notFoundDescription')}
          </p>
          <Button onClick={() => navigate('/decks')}>{t('detail.browseAll')}</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CultureDeckDetailPage;
