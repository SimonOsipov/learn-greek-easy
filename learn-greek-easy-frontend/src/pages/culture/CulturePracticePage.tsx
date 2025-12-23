/**
 * Culture Practice Session Page
 *
 * Full-screen immersive culture exam practice experience.
 * Orchestrates the complete practice flow: questions -> feedback -> summary.
 *
 * Features:
 * - Session recovery from sessionStorage
 * - Exit confirmation dialog
 * - beforeunload handler for browser close protection
 * - Keyboard shortcuts
 * - Language switching
 * - Progress tracking
 * - PostHog analytics events
 */

import { useEffect, useRef, useState, useCallback } from 'react';

import { AlertCircle, ChevronLeft, Loader2 } from 'lucide-react';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';

import { MCQComponent, QuestionFeedback, LanguageSelector } from '@/components/culture';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { useCultureSessionStore } from '@/stores/cultureSessionStore';
import type {
  CultureQuestionResponse,
  CultureAnswerResponse,
  CultureLanguage,
} from '@/types/culture';
import type { CultureSessionConfig } from '@/types/cultureSession';
import { DEFAULT_SESSION_CONFIG } from '@/types/cultureSession';

/** Option letter mapping for feedback display */
const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Loading skeleton for practice page
 */
function PracticePageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <Skeleton className="mb-4 h-10 w-32 bg-white/20" />
        <Skeleton className="mb-8 h-4 w-48 bg-white/20" />
        <Card className="bg-white/95">
          <CardContent className="space-y-6 p-6">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
            <Skeleton className="mx-auto h-12 w-48" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function CulturePracticePage() {
  const { t } = useTranslation(['culture', 'common']);
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { track } = useTrackEvent();

  // Store state
  const {
    session,
    currentQuestion,
    progress,
    isLoading,
    error,
    summary,
    startSession,
    answerQuestion,
    nextQuestion,
    abandonSession,
    clearError,
    checkRecoverableSession,
    recoverSession,
    dismissRecovery,
    setLanguage,
  } = useCultureSessionStore();

  // Local state
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAnswerResponse, setLastAnswerResponse] = useState<CultureAnswerResponse | null>(null);

  // Refs for tracking
  const hasTrackedStart = useRef(false);
  const sessionStartTime = useRef<number | null>(null);

  // Check for recoverable session on mount
  useEffect(() => {
    const hasRecoverable = checkRecoverableSession();
    if (hasRecoverable) {
      setShowRecoveryDialog(true);
    } else if (deckId && !session) {
      // Start new session - fetch questions and initialize
      initializeSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // Navigate to summary when session completes
  useEffect(() => {
    if (summary && deckId) {
      const timer = setTimeout(() => {
        navigate(`/culture/${deckId}/summary`);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [summary, deckId, navigate]);

  // Track session start
  useEffect(() => {
    if (session && session.status === 'active' && !hasTrackedStart.current) {
      hasTrackedStart.current = true;
      sessionStartTime.current = Date.now();

      try {
        track('culture_session_started', {
          deck_id: session.deckId,
          deck_name: session.deckName,
          category: session.category,
          question_count: session.questions.length,
          language: session.config.language,
          session_id: session.sessionId,
        });
      } catch {
        // Silent failure
      }
    }
  }, [session, track]);

  // beforeunload handler for browser close protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (session && session.status === 'active') {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session]);

  // Track abandonment on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (
        session &&
        session.status === 'active' &&
        session.stats.questionsAnswered > 0 &&
        !summary
      ) {
        const durationSec = sessionStartTime.current
          ? Math.round((Date.now() - sessionStartTime.current) / 1000)
          : session.stats.totalTimeSeconds;

        if (typeof posthog?.capture === 'function') {
          try {
            posthog.capture('culture_session_abandoned', {
              deck_id: session.deckId,
              session_id: session.sessionId,
              questions_answered: session.stats.questionsAnswered,
              duration_sec: durationSec,
            });
          } catch {
            // Silent failure
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session, summary]);

  /**
   * Initialize a new practice session
   */
  const initializeSession = useCallback(async () => {
    if (!deckId) return;

    try {
      // Fetch deck info and questions from API
      // TODO: Replace with actual API calls when backend is ready
      // For now, we'll use mock data for demonstration
      const mockQuestions: CultureQuestionResponse[] = [
        {
          id: '1',
          question_text: {
            el: 'Ποια ειναι η πρωτευουσα της Ελλαδας;',
            en: 'What is the capital of Greece?',
            ru: 'Какая столица Греции?',
          },
          options: [
            { el: 'Θεσσαλονικη', en: 'Thessaloniki', ru: 'Салоники' },
            { el: 'Αθηνα', en: 'Athens', ru: 'Афины' },
            { el: 'Πατρα', en: 'Patras', ru: 'Патры' },
            { el: 'Ηρακλειο', en: 'Heraklion', ru: 'Ираклион' },
          ],
          image_url: null,
          order_index: 0,
        },
      ];

      const config: CultureSessionConfig = {
        ...DEFAULT_SESSION_CONFIG,
        questionCount: mockQuestions.length,
      };

      startSession(deckId, 'Greek History', 'history', mockQuestions, config);
    } catch (err) {
      console.error('Failed to initialize session:', err);
    }
  }, [deckId, startSession]);

  /**
   * Handle answer submission
   */
  const handleAnswer = useCallback(
    async (selectedOption: number) => {
      if (!session || !currentQuestion || isSubmitting) return;

      setIsSubmitting(true);

      try {
        // Calculate time taken
        const startedAt = currentQuestion.startedAt
          ? new Date(currentQuestion.startedAt).getTime()
          : Date.now();
        const timeTaken = Date.now() - startedAt;

        // Submit answer to backend
        // TODO: Replace with actual API call when backend is ready
        const mockResponse: CultureAnswerResponse = {
          is_correct: selectedOption === 2, // Mock: option 2 is correct
          correct_option: 2,
          xp_earned: selectedOption === 2 ? 10 : 2,
          new_stats: {
            easiness_factor: 2.5,
            interval: 1,
            repetitions: 1,
            next_review_date: new Date().toISOString(),
            status: 'learning',
          },
        };

        setLastAnswerResponse(mockResponse);
        answerQuestion(selectedOption, mockResponse);

        // Track answer event
        try {
          track('culture_question_answered', {
            deck_id: session.deckId,
            session_id: session.sessionId,
            question_id: currentQuestion.question.id,
            selected_option: selectedOption,
            is_correct: mockResponse.is_correct,
            time_ms: timeTaken,
            xp_earned: mockResponse.xp_earned,
          });
        } catch {
          // Silent failure
        }
      } catch (err) {
        console.error('Failed to submit answer:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [session, currentQuestion, isSubmitting, answerQuestion, track]
  );

  /**
   * Handle next question button
   */
  const handleNextQuestion = useCallback(() => {
    setLastAnswerResponse(null);
    nextQuestion();
  }, [nextQuestion]);

  /**
   * Handle exit confirmation
   */
  const handleExitClick = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  /**
   * Handle confirmed exit
   */
  const handleConfirmExit = useCallback(() => {
    // Track abandonment
    if (session) {
      try {
        track('culture_session_abandoned', {
          deck_id: session.deckId,
          session_id: session.sessionId,
          questions_answered: session.stats.questionsAnswered,
          duration_sec: session.stats.totalTimeSeconds,
        });
      } catch {
        // Silent failure
      }
    }

    abandonSession();
    navigate('/decks');
  }, [session, abandonSession, navigate, track]);

  /**
   * Handle session recovery
   */
  const handleRecoverSession = useCallback(() => {
    const recovered = recoverSession();
    setShowRecoveryDialog(false);
    if (!recovered && deckId) {
      initializeSession();
    }
  }, [recoverSession, deckId, initializeSession]);

  /**
   * Handle dismissing recovery
   */
  const handleDismissRecovery = useCallback(() => {
    dismissRecovery();
    setShowRecoveryDialog(false);
    if (deckId) {
      initializeSession();
    }
  }, [dismissRecovery, deckId, initializeSession]);

  /**
   * Handle language change
   */
  const handleLanguageChange = useCallback(
    (language: CultureLanguage) => {
      setLanguage(language);
    },
    [setLanguage]
  );

  // Recovery dialog
  if (showRecoveryDialog) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-700 p-4">
        <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('practice.recovery.title', 'Resume Practice?')}</DialogTitle>
              <DialogDescription>
                {t(
                  'practice.recovery.description',
                  'You have an unfinished practice session. Would you like to continue where you left off?'
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-start">
              <Button variant="outline" onClick={handleDismissRecovery}>
                {t('practice.recovery.startNew', 'Start New')}
              </Button>
              <Button onClick={handleRecoverSession}>
                {t('practice.recovery.resume', 'Resume Session')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Loading state
  if (isLoading || !session) {
    return <PracticePageSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Button
            variant="ghost"
            onClick={() => navigate('/decks')}
            className="mb-4 text-white hover:bg-white/20"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('practice.backToDecks', 'Back to Decks')}
          </Button>
          <Alert variant="destructive" className="bg-white">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('practice.error', 'Error')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-3">
            <Button onClick={() => clearError()} variant="default">
              {t('common:retry', 'Try Again')}
            </Button>
            <Button onClick={() => navigate('/decks')} variant="secondary">
              {t('practice.backToDecks', 'Back to Decks')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No current question
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Button
            variant="ghost"
            onClick={() => navigate('/decks')}
            className="mb-4 text-white hover:bg-white/20"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('practice.backToDecks', 'Back to Decks')}
          </Button>
          <Alert className="bg-white">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('practice.noQuestions', 'No Questions')}</AlertTitle>
            <AlertDescription>
              {t('practice.noQuestionsDescription', 'No questions available for this deck.')}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const progressPercent = (progress.current / progress.total) * 100;
  const currentLanguage = session.config.language;
  const isInFeedback = session.phase === 'feedback' && lastAnswerResponse !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleExitClick}
            className="text-white hover:bg-white/20"
            data-testid="exit-button"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('practice.exit', 'Exit')}
          </Button>

          <div className="flex items-center gap-4">
            {/* Language selector */}
            <LanguageSelector
              value={currentLanguage}
              onChange={handleLanguageChange}
              className="bg-white/20 text-white hover:bg-white/30"
            />

            {/* Session info */}
            <div className="text-right text-white">
              <div className="text-sm font-medium">{session.deckName}</div>
              <div className="text-xs opacity-80">
                {t('practice.xpEarned', 'XP: {{xp}}', { xp: session.stats.xpEarned })}
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm text-white">
            <span>
              {t('mcq.questionOf', {
                current: progress.current,
                total: progress.total,
              })}
            </span>
            <span>
              {t('practice.accuracy', '{{accuracy}}% accuracy', {
                accuracy: session.stats.accuracy,
              })}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2 bg-white/20" />
        </div>

        {/* Question or Feedback */}
        <div className="flex justify-center">
          {isInFeedback ? (
            <QuestionFeedback
              isCorrect={lastAnswerResponse.is_correct}
              correctOption={{
                label: OPTION_LETTERS[lastAnswerResponse.correct_option - 1],
                text: currentQuestion.question.options[lastAnswerResponse.correct_option - 1],
              }}
              xpEarned={lastAnswerResponse.xp_earned}
              language={currentLanguage}
              onNextQuestion={handleNextQuestion}
              isLastQuestion={progress.current >= progress.total}
              className="w-full max-w-2xl"
            />
          ) : (
            <MCQComponent
              question={currentQuestion.question}
              language={currentLanguage}
              onAnswer={handleAnswer}
              questionNumber={progress.current}
              totalQuestions={progress.total}
              disabled={isSubmitting}
            />
          )}
        </div>

        {/* Loading overlay */}
        {isSubmitting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="flex items-center gap-2 rounded-lg bg-white px-6 py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{t('common:loading', 'Loading...')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Exit confirmation dialog */}
      <ConfirmDialog
        open={showExitConfirm}
        onOpenChange={setShowExitConfirm}
        title={t('practice.exitTitle', 'Exit Practice?')}
        description={t(
          'practice.exitConfirm',
          'Your progress will be saved, but you will exit the current session. Are you sure you want to exit?'
        )}
        confirmText={t('common:confirm', 'Confirm')}
        cancelText={t('common:cancel', 'Cancel')}
        onConfirm={handleConfirmExit}
        variant="destructive"
      />
    </div>
  );
}

export default CulturePracticePage;
