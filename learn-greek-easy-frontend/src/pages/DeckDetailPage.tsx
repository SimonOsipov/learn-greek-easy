// src/pages/DeckDetailPage.tsx

import React, { useEffect, useState } from 'react';

import {
  ChevronLeft,
  Crown,
  Lock,
  BookOpen,
  Clock,
  TrendingUp,
  AlertCircle,
  MoreVertical,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';
// Note: Clock is still used for "Due Today" stat
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';

import { DeckBadge } from '@/components/decks/DeckBadge';
import { DeckProgressBar } from '@/components/decks/DeckProgressBar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { V2DeckPage } from '@/features/decks/components/V2DeckPage';
import { reportAPIError } from '@/lib/errorReporting';
import { formatRelativeDate } from '@/lib/helpers';
import log from '@/lib/logger';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';
import type { Deck, DeckStatus } from '@/types/deck';

export const DeckDetailPage: React.FC = () => {
  const { t } = useTranslation('deck');
  const { id: deckId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { selectedDeck, isLoading, error, selectDeck, clearSelection, startLearning } =
    useDeckStore();

  const { user } = useAuthStore();

  // Fetch deck on mount and when deckId changes
  useEffect(() => {
    if (deckId) {
      selectDeck(deckId).catch((err) => {
        reportAPIError(err, { operation: 'loadDeck', endpoint: `/decks/${deckId}` });
      });
    }

    // Cleanup: clear selection when component unmounts
    return () => {
      clearSelection();
    };
  }, [deckId, selectDeck, clearSelection]);

  // Handle invalid deckId (not provided)
  if (!deckId) {
    return <NotFoundState />;
  }

  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRetry={() => selectDeck(deckId)} />;
  }

  // Not found state (deck doesn't exist)
  if (!selectedDeck) {
    return <NotFoundState />;
  }

  // Route to V2DeckPage for V2 decks (word browser system)
  if (selectedDeck.cardSystem === 'V2') {
    return <V2DeckPage deckId={deckId} />;
  }

  // V1 deck rendering (traditional flashcard system) continues below
  // Check if deck is locked (premium deck + free user)
  const isPremiumLocked = selectedDeck.isPremium && user?.role === 'free';

  // Determine deck status for action buttons
  const deckStatus = selectedDeck.progress?.status || 'not-started';

  return (
    <div
      data-testid="deck-detail"
      data-card-system={selectedDeck.cardSystem}
      className="container mx-auto max-w-4xl px-4 py-6 md:py-8"
    >
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
          {t('detail.breadcrumb')}
        </Link>
        <span>/</span>
        <span className="truncate font-medium text-foreground">{selectedDeck.titleGreek}</span>
      </nav>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Deck Header Section */}
        <DeckHeaderSection
          deck={selectedDeck}
          isPremiumLocked={isPremiumLocked}
          deckStatus={deckStatus}
          onStartLearning={() => handleStartLearning(deckId, startLearning, navigate)}
          onContinue={() => handleContinue(deckId, navigate)}
          onUpgrade={() => handleUpgrade(navigate)}
        />

        {/* Statistics Section */}
        <StatisticsSection deck={selectedDeck} />
      </div>
    </div>
  );
};

// Helper functions for action handlers
const handleStartLearning = async (
  deckId: string,
  startLearning: (id: string) => Promise<void>,
  navigate: any
) => {
  try {
    await startLearning(deckId);
    // Navigate to review session
    navigate(`/decks/${deckId}/review`);
  } catch (error) {
    reportAPIError(error, { operation: 'startLearning', endpoint: `/decks/${deckId}/initialize` });
    // Error is handled by store
  }
};

const handleContinue = (deckId: string, navigate: any) => {
  // Navigate to review session
  navigate(`/decks/${deckId}/review`);
};

const handleUpgrade = (navigate: any) => {
  // TODO: Navigate to upgrade page when implemented
  navigate('/upgrade');
};

// Deck Header Section Component
interface DeckHeaderSectionProps {
  deck: Deck;
  isPremiumLocked: boolean;
  deckStatus: DeckStatus;
  onStartLearning: () => void;
  onContinue: () => void;
  onUpgrade: () => void;
}

const DeckHeaderSection: React.FC<DeckHeaderSectionProps> = ({
  deck,
  isPremiumLocked,
  deckStatus,
  onStartLearning,
  onContinue,
  onUpgrade,
}) => {
  const { t } = useTranslation('deck');
  const { resetProgress } = useDeckStore();
  const [isResetting, setIsResetting] = useState(false);

  const handleResetProgress = async () => {
    if (!confirm(t('detail.resetConfirm'))) {
      return;
    }

    setIsResetting(true);
    try {
      await resetProgress(deck.id);
      log.info('Progress reset successfully');
    } catch (error) {
      reportAPIError(error, { operation: 'resetProgress', endpoint: `/decks/${deck.id}/progress` });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        {/* Title and Badges Row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Greek Title - Primary */}
            <h1 className="mb-1 text-2xl font-semibold text-foreground md:text-3xl">
              {deck.titleGreek}
            </h1>

            {/* English Subtitle - Secondary */}
            <p className="text-base text-muted-foreground md:text-lg">{deck.title}</p>
          </div>

          {/* Level Badge, Premium Icon, and Actions */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {isPremiumLocked && (
              <Crown className="h-5 w-5 text-amber-500" aria-label="Premium content" />
            )}
            <DeckBadge type="level" level={deck.level} />

            {/* Progress actions dropdown (only show if deck has progress) */}
            {deck.progress && deck.progress.status !== 'not-started' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleResetProgress}
                    disabled={isResetting}
                    className="text-red-600"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {isResetting ? t('detail.resetting') : t('detail.resetProgress')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Premium Badge */}
        {deck.isPremium && (
          <div className="mt-3">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {t('detail.premium')}
            </span>
          </div>
        )}

        {/* Category and Author Info */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="capitalize">{deck.category}</span>
          <span>•</span>
          <span>{t('detail.createdBy', { author: deck.createdBy })}</span>
          <span>•</span>
          <span>{t('detail.updated', { date: formatDate(deck.updatedAt) })}</span>
        </div>
      </CardHeader>

      <CardContent>
        {/* Description */}
        <p className="leading-relaxed text-foreground">{deck.description}</p>

        {/* Progress Bar (if in progress or completed) */}
        {deck.progress && deck.progress.status !== 'not-started' && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {t('detail.yourProgress')}
              </span>
              <span className="text-sm text-muted-foreground">
                {Math.round(
                  ((deck.progress.cardsLearning + deck.progress.cardsMastered) /
                    deck.progress.cardsTotal) *
                    100
                )}
                % {t('detail.complete')}
              </span>
            </div>
            <DeckProgressBar progress={deck.progress} showLegend={true} size="large" />
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6">
          {isPremiumLocked ? (
            <Button
              data-testid="start-review-button"
              size="lg"
              onClick={onUpgrade}
              className="w-full bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
            >
              <Lock className="mr-2 h-5 w-5" />
              {t('detail.upgradeToPremium')}
            </Button>
          ) : deckStatus === 'not-started' ? (
            <Button
              data-testid="start-review-button"
              variant="hero"
              size="lg"
              onClick={onStartLearning}
              className="w-full"
            >
              <BookOpen className="mr-2 h-5 w-5" />
              {t('detail.startReview')}
            </Button>
          ) : deckStatus === 'completed' ? (
            <Button
              data-testid="start-review-button"
              variant="hero"
              size="lg"
              onClick={onContinue}
              className="w-full"
            >
              <CheckCircle className="mr-2 h-5 w-5" />
              {t('detail.reviewDeck')}
            </Button>
          ) : (
            <Button
              data-testid="start-review-button"
              variant="hero"
              size="lg"
              onClick={onContinue}
              className="w-full"
            >
              <TrendingUp className="mr-2 h-5 w-5" />
              {t('detail.continueReview')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Helper: Format date (e.g., "Jan 15, 2025")
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
};

// Statistics Section Component
interface StatisticsSectionProps {
  deck: Deck;
}

const StatisticsSection: React.FC<StatisticsSectionProps> = ({ deck }) => {
  const { t } = useTranslation('deck');
  const { progress } = deck;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{t('detail.statistics')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {/* Total Cards */}
          <StatCard
            icon={<BookOpen className="h-5 w-5 text-blue-500" />}
            label={t('detail.totalCards')}
            value={deck.cardCount}
            subtext={t('detail.flashcards')}
          />

          {/* Due Today (ONLY if deck has actual progress) */}
          {progress && (progress.cardsMastered > 0 || progress.cardsLearning > 0) && (
            <StatCard
              icon={<Clock className="h-5 w-5 text-red-500" />}
              label={t('detail.dueToday')}
              value={progress.dueToday}
              subtext={t('detail.cardsToReview')}
            />
          )}
        </div>

        {/* Card Distribution (if started) */}
        {progress && progress.status !== 'not-started' && (
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-muted-foreground">{progress.cardsNew}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('detail.new')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">{progress.cardsLearning}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('detail.learning')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{progress.cardsMastered}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('detail.masteredLabel')}</p>
            </div>
          </div>
        )}

        {/* Last Review Date (if reviewed) */}
        {progress?.lastStudied && (
          <div className="mt-4 border-t border-border pt-4 text-center text-sm text-muted-foreground">
            {t('detail.lastReviewed', { date: formatRelativeDate(progress.lastStudied) })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Reusable Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtext }) => {
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3 text-center">
      <div className="mb-2">{icon}</div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
};

// Loading Skeleton Component
const LoadingSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
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
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
          <div className="mt-3">
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="mt-3 flex gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg bg-muted/50 p-3">
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
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('detail.error.title')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>

      <Card>
        <CardContent className="py-12 pt-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
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
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
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
