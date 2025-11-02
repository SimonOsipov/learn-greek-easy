// src/pages/DeckDetailPage.tsx

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDeckStore } from '@/stores/deckStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeckBadge } from '@/components/decks/DeckBadge';
import { DeckProgressBar } from '@/components/decks/DeckProgressBar';
import type { Deck, DeckStatus } from '@/types/deck';

export const DeckDetailPage: React.FC = () => {
  const { id: deckId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    selectedDeck,
    isLoading,
    error,
    selectDeck,
    clearSelection,
    startLearning,
  } = useDeckStore();

  const { user } = useAuthStore();

  // Fetch deck on mount and when deckId changes
  useEffect(() => {
    if (deckId) {
      selectDeck(deckId).catch((err) => {
        console.error('Failed to load deck:', err);
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
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
      {/* Breadcrumb Navigation */}
      <nav className="mb-4 flex items-center gap-2 text-sm text-gray-600" aria-label="Breadcrumb">
        <Link
          to="/decks"
          className="hover:text-gray-900 transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Decks
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate">
          {selectedDeck.titleGreek}
        </span>
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
    // TODO: Navigate to learning session when implemented
    navigate(`/learn/${deckId}`);
  } catch (error) {
    console.error('Failed to start learning:', error);
    // Error is handled by store
  }
};

const handleContinue = (deckId: string, navigate: any) => {
  // TODO: Navigate to learning session when implemented
  navigate(`/learn/${deckId}`);
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
  const { resetProgress } = useDeckStore();
  const [isResetting, setIsResetting] = useState(false);

  const handleResetProgress = async () => {
    if (!confirm('Are you sure you want to reset your progress for this deck? This action cannot be undone.')) {
      return;
    }

    setIsResetting(true);
    try {
      await resetProgress(deck.id);
      console.log('Progress reset successfully');
    } catch (error) {
      console.error('Failed to reset progress:', error);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        {/* Title and Badges Row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            {/* Greek Title - Primary */}
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-1">
              {deck.titleGreek}
            </h1>

            {/* English Subtitle - Secondary */}
            <p className="text-base md:text-lg text-gray-600">
              {deck.title}
            </p>
          </div>

          {/* Level Badge, Lock Icon, and Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isPremiumLocked && (
              <Lock
                className="w-5 h-5 text-amber-500"
                aria-label="Premium locked"
              />
            )}
            <DeckBadge type="level" level={deck.level} />

            {/* Progress actions dropdown (only show if deck has progress) */}
            {deck.progress && deck.progress.status !== 'not-started' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleResetProgress}
                    disabled={isResetting}
                    className="text-red-600"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {isResetting ? 'Resetting...' : 'Reset Progress'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Premium Badge */}
        {deck.isPremium && (
          <div className="mt-3">
            <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-amber-100 text-amber-800 rounded-full">
              Premium
            </span>
          </div>
        )}

        {/* Category and Author Info */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span className="capitalize">{deck.category}</span>
          <span>•</span>
          <span>Created by {deck.createdBy}</span>
          <span>•</span>
          <span>Updated {formatDate(deck.updatedAt)}</span>
        </div>
      </CardHeader>

      <CardContent>
        {/* Description */}
        <p className="text-gray-700 leading-relaxed">
          {deck.description}
        </p>

        {/* Progress Bar (if in progress or completed) */}
        {deck.progress && deck.progress.status !== 'not-started' && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Your Progress
              </span>
              <span className="text-sm text-gray-600">
                {Math.round((deck.progress.cardsMastered / deck.progress.cardsTotal) * 100)}% Complete
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
  const { progress } = deck;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Deck Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Cards */}
          <StatCard
            icon={<BookOpen className="w-5 h-5 text-blue-500" />}
            label="Total Cards"
            value={deck.cardCount}
            subtext="flashcards"
          />

          {/* Estimated Time */}
          <StatCard
            icon={<Clock className="w-5 h-5 text-purple-500" />}
            label="Estimated Time"
            value={`${deck.estimatedTime}m`}
            subtext="to complete"
          />

          {/* Mastery Rate (if started) */}
          {progress && progress.status !== 'not-started' && (
            <StatCard
              icon={<Target className="w-5 h-5 text-green-500" />}
              label="Mastery Rate"
              value={`${Math.round((progress.cardsMastered / progress.cardsTotal) * 100)}%`}
              subtext={`${progress.cardsMastered}/${progress.cardsTotal} mastered`}
            />
          )}

          {/* Accuracy (if started) */}
          {progress && progress.status !== 'not-started' && (
            <StatCard
              icon={<TrendingUp className="w-5 h-5 text-orange-500" />}
              label="Accuracy"
              value={`${progress.accuracy}%`}
              subtext="correct answers"
            />
          )}
        </div>

        {/* Card Distribution (if started) */}
        {progress && progress.status !== 'not-started' && (
          <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-400">{progress.cardsNew}</p>
              <p className="text-xs text-gray-600 mt-1">New</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">{progress.cardsLearning}</p>
              <p className="text-xs text-gray-600 mt-1">Learning</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{progress.cardsMastered}</p>
              <p className="text-xs text-gray-600 mt-1">Mastered</p>
            </div>
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
    <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg">
      <div className="mb-2">{icon}</div>
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{subtext}</p>
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
      console.log('Study session simulated successfully!');
    } catch (error) {
      console.error('Failed to simulate session:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Premium Locked State */}
        {isPremiumLocked && (
          <div className="text-center py-8">
            <Lock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Premium Deck
            </h3>
            <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
              This deck is only available to premium members. Upgrade your account to access
              all premium decks and advanced learning features.
            </p>
            <Button
              size="lg"
              onClick={onUpgrade}
              className="bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
            >
              Upgrade to Premium
            </Button>
          </div>
        )}

        {/* Not Started State */}
        {!isPremiumLocked && deckStatus === 'not-started' && (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Ready to Start Learning?
            </h3>
            <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
              This deck contains {deck.cardCount} flashcards. Estimated time to complete: {deck.estimatedTime} minutes.
            </p>
            <Button
              size="lg"
              onClick={onStartLearning}
              className="bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              Start Learning
            </Button>
          </div>
        )}

        {/* In Progress State */}
        {!isPremiumLocked && deckStatus === 'in-progress' && (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Continue Your Progress
            </h3>
            <p className="text-sm text-gray-600 mb-2 max-w-md mx-auto">
              You have {deck.progress?.dueToday || 0} cards due for review today.
            </p>
            <p className="text-xs text-gray-500 mb-6">
              Keep your streak going!
            </p>
            <Button
              size="lg"
              onClick={onContinue}
              className="bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
            >
              Continue Learning
            </Button>

            {/* Demo: Simulate Study Session Button */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-gray-500 mb-2">
                Demo: Test progress tracking
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSimulateSession}
                disabled={isSimulating}
              >
                {isSimulating ? 'Simulating...' : 'Simulate Study Session'}
              </Button>
            </div>
          </div>
        )}

        {/* Completed State */}
        {!isPremiumLocked && deckStatus === 'completed' && (
          <div className="text-center py-8">
            <Target className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Deck Completed!
            </h3>
            <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
              Great job! You've mastered this deck. Continue reviewing to maintain your knowledge.
            </p>
            <Button
              size="lg"
              onClick={onContinue}
              className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              Review Deck
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
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <Skeleton className="h-5 w-5 mx-auto mb-2" />
                <Skeleton className="h-4 w-16 mx-auto mb-1" />
                <Skeleton className="h-6 w-12 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Skeleton className="h-12 w-12 mx-auto mb-4 rounded-full" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto mb-6" />
            <Skeleton className="h-12 w-48 mx-auto rounded-lg" />
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
  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Deck</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6 text-center py-12">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to Load Deck
          </h2>
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            We couldn't load the deck details. Please check your connection and try again.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
            <Button onClick={onRetry}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Not Found State Component
const NotFoundState: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
      <Card>
        <CardContent className="pt-6 text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Deck Not Found
          </h2>
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            The deck you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/decks')}>
            Browse All Decks
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
