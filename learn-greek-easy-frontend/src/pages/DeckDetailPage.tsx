// src/pages/DeckDetailPage.tsx

import React, { useEffect, useState } from 'react';

import {
  ChevronLeft,
  Lock,
  BookOpen,
  Clock,
  Target,
  TrendingUp,
  AlertCircle,
  MoreVertical,
  RotateCcw,
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
        log.error('Failed to load deck:', err);
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

  // Check if deck is locked (premium deck + free user)
  const isPremiumLocked = selectedDeck.isPremium && user?.role === 'free';

  // Determine deck status for action buttons
  const deckStatus = selectedDeck.progress?.status || 'not-started';

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
          {t('detail.breadcrumb')}
        </Link>
        <span>/</span>
        <span className="truncate font-medium text-gray-900">{selectedDeck.titleGreek}</span>
      </nav>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Deck Header Section */}
        <DeckHeaderSection deck={selectedDeck} isPremiumLocked={isPremiumLocked} />

        {/* Statistics Section */}
        <StatisticsSection deck={selectedDeck} />

        {/* Action Buttons Section */}
        <ActionButtonsSection
          deck={selectedDeck}
          isPremiumLocked={isPremiumLocked}
          deckStatus={deckStatus}
          onStartLearning={() => handleStartLearning(deckId, startLearning, navigate)}
          onContinue={() => handleContinue(deckId, navigate)}
          onUpgrade={() => handleUpgrade(navigate)}
        />
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
    log.error('Failed to start learning:', error);
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
}

const DeckHeaderSection: React.FC<DeckHeaderSectionProps> = ({ deck, isPremiumLocked }) => {
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
      log.error('Failed to reset progress:', error);
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
            <h1 className="mb-1 text-2xl font-semibold text-gray-900 md:text-3xl">
              {deck.titleGreek}
            </h1>

            {/* English Subtitle - Secondary */}
            <p className="text-base text-gray-600 md:text-lg">{deck.title}</p>
          </div>

          {/* Level Badge, Lock Icon, and Actions */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {isPremiumLocked && (
              <Lock className="h-5 w-5 text-amber-500" aria-label="Premium locked" />
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
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
              {t('detail.premium')}
            </span>
          </div>
        )}

        {/* Category and Author Info */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span className="capitalize">{deck.category}</span>
          <span>•</span>
          <span>{t('detail.createdBy', { author: deck.createdBy })}</span>
          <span>•</span>
          <span>{t('detail.updated', { date: formatDate(deck.updatedAt) })}</span>
        </div>
      </CardHeader>

      <CardContent>
        {/* Description */}
        <p className="leading-relaxed text-gray-700">{deck.description}</p>

        {/* Progress Bar (if in progress or completed) */}
        {deck.progress && deck.progress.status !== 'not-started' && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{t('detail.yourProgress')}</span>
              <span className="text-sm text-gray-600">
                {Math.round((deck.progress.cardsMastered / deck.progress.cardsTotal) * 100)}%{' '}
                {t('detail.complete')}
              </span>
            </div>
            <DeckProgressBar progress={deck.progress} showLegend={true} size="large" />
          </div>
        )}
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

          {/* Mastery Rate (if started) */}
          {progress && progress.status !== 'not-started' && (
            <StatCard
              icon={<Target className="h-5 w-5 text-green-500" />}
              label={t('detail.masteryRate')}
              value={`${Math.round((progress.cardsMastered / progress.cardsTotal) * 100)}%`}
              subtext={t('detail.mastered', {
                count: progress.cardsMastered,
                total: progress.cardsTotal,
              })}
            />
          )}
        </div>

        {/* Card Distribution (if started) */}
        {progress && progress.status !== 'not-started' && (
          <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-400">{progress.cardsNew}</p>
              <p className="mt-1 text-xs text-gray-600">{t('detail.new')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">{progress.cardsLearning}</p>
              <p className="mt-1 text-xs text-gray-600">{t('detail.learning')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{progress.cardsMastered}</p>
              <p className="mt-1 text-xs text-gray-600">{t('detail.masteredLabel')}</p>
            </div>
          </div>
        )}

        {/* Last Review Date (if reviewed) */}
        {progress?.lastStudied && (
          <div className="mt-4 border-t pt-4 text-center text-sm text-gray-600">
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
    <div className="flex flex-col items-center rounded-lg bg-gray-50 p-3 text-center">
      <div className="mb-2">{icon}</div>
      <p className="mb-1 text-xs text-gray-600">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{subtext}</p>
    </div>
  );
};

// Action Buttons Section Component
interface ActionButtonsSectionProps {
  deck: Deck;
  isPremiumLocked: boolean;
  deckStatus: DeckStatus;
  onStartLearning: () => void;
  onContinue: () => void;
  onUpgrade: () => void;
}

const ActionButtonsSection: React.FC<ActionButtonsSectionProps> = ({
  deck,
  isPremiumLocked,
  deckStatus,
  onStartLearning,
  onContinue,
  onUpgrade,
}) => {
  const { t } = useTranslation('deck');
  const { reviewSession } = useDeckStore();
  const [isSimulating, setIsSimulating] = useState(false);

  // Handler for simulating a study session (demo/testing only)
  const handleSimulateSession = async () => {
    if (!deck.id) return;

    setIsSimulating(true);
    try {
      // Simulate reviewing 10 cards with 80% accuracy in 15 minutes
      await reviewSession(deck.id, 10, 8, 15);

      // Show success toast/notification (optional)
      log.info('Study session simulated successfully!');
    } catch (error) {
      log.error('Failed to simulate session:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Premium Locked State */}
        {isPremiumLocked && (
          <div className="py-8 text-center">
            <Lock className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              {t('detail.premiumLocked.title')}
            </h3>
            <p className="mx-auto mb-6 max-w-md text-sm text-gray-600">
              {t('detail.premiumLocked.description')}
            </p>
            <Button
              size="lg"
              onClick={onUpgrade}
              className="bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
            >
              {t('detail.upgradeToPremium')}
            </Button>
          </div>
        )}

        {/* Not Started State */}
        {!isPremiumLocked && deckStatus === 'not-started' && (
          <div className="py-8 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-blue-500" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">{t('detail.readyToStart')}</h3>
            <p className="mx-auto mb-6 max-w-md text-sm text-gray-600">
              {t('detail.notStarted.description', {
                count: deck.cardCount,
              })}
            </p>
            <Button
              data-testid="start-review-button"
              size="lg"
              onClick={onStartLearning}
              className="bg-gradient-to-br from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
            >
              {t('detail.startReview')}
            </Button>
          </div>
        )}

        {/* In Progress State */}
        {!isPremiumLocked && deckStatus === 'in-progress' && (
          <div className="py-8 text-center">
            <TrendingUp className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              {t('detail.continueProgress')}
            </h3>
            <p className="mx-auto mb-2 max-w-md text-sm text-gray-600">
              {t('detail.inProgress.cardsDue', { count: deck.progress?.dueToday || 0 })}
            </p>
            <p className="mb-6 text-xs text-gray-500">{t('detail.inProgress.keepStreak')}</p>
            <Button
              data-testid="start-review-button"
              size="lg"
              onClick={onContinue}
              className="bg-gradient-to-br from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700"
            >
              {t('detail.continueReview')}
            </Button>

            {/* Demo: Simulate Study Session Button */}
            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs text-gray-500">{t('detail.demo.title')}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSimulateSession}
                disabled={isSimulating}
              >
                {isSimulating ? t('detail.demo.simulating') : t('detail.demo.simulateSession')}
              </Button>
            </div>
          </div>
        )}

        {/* Completed State */}
        {!isPremiumLocked && deckStatus === 'completed' && (
          <div className="py-8 text-center">
            <Target className="mx-auto mb-4 h-12 w-12 text-purple-500" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              {t('detail.deckCompleted')}
            </h3>
            <p className="mx-auto mb-6 max-w-md text-sm text-gray-600">
              {t('detail.completed.description')}
            </p>
            <Button
              data-testid="start-review-button"
              size="lg"
              onClick={onContinue}
              className="bg-gradient-to-br from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
            >
              {t('detail.reviewDeck')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
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
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
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
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
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
