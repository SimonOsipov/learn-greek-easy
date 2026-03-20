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

import { useEffect, useState, useCallback, useMemo } from 'react';

import { AlertCircle, CheckCircle, ChevronLeft, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';

import { MCQComponent, LanguageSelector, ScoreCard } from '@/components/culture';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { PracticeHeader } from '@/components/practice';
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
import { Skeleton } from '@/components/ui/skeleton';
import { usePracticeSession } from '@/hooks/usePracticeSession';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import i18n from '@/i18n';
import { trackNewsLevelToggled } from '@/lib/analytics';
import { reportAPIError } from '@/lib/errorReporting';
import log from '@/lib/logger';
import { MAX_ANSWER_TIME_SECONDS } from '@/lib/timeFormatUtils';
import { cultureDeckAPI, type LocalizedText } from '@/services/cultureDeckAPI';
import { useCultureSessionStore } from '@/stores/cultureSessionStore';
import { useXPStore } from '@/stores/xpStore';
import type {
  CultureQuestionResponse,
  CultureAnswerResponse,
  CultureLanguage,
} from '@/types/culture';
import type { CultureSessionConfig } from '@/types/cultureSession';
import { DEFAULT_SESSION_CONFIG } from '@/types/cultureSession';
import { getPersistedNewsLevel, setPersistedNewsLevel, type NewsLevel } from '@/utils/newsLevel';

/**
 * Loading skeleton for practice page
 */
function PracticePageSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--practice-bg)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[520px]">
        {/* Header skeleton: exit button left, language pill right */}
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-5 w-16 bg-secondary" />
          <Skeleton className="h-8 w-28 rounded-lg bg-secondary" />
        </div>
        {/* Question card skeleton */}
        <Card className="bg-card/95">
          <CardContent className="space-y-6 p-6">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
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
    resetSession,
  } = useCultureSessionStore();

  // XP store - for refreshing XP after answer submission
  const loadXPStats = useXPStore((state) => state.loadXPStats);

  const showLevelToggle = Boolean(currentQuestion?.question.original_article_url);

  // Local state
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [lastAnswerResponse, setLastAnswerResponse] = useState<CultureAnswerResponse | null>(null);
  const [hasNoQuestionsDue, setHasNoQuestionsDue] = useState(false);
  const [hasStudiedQuestions, setHasStudiedQuestions] = useState(false);
  const [isPracticeAnywayLoading, setIsPracticeAnywayLoading] = useState(false);
  const [newsLevel, setNewsLevel] = useState<NewsLevel>(getPersistedNewsLevel);

  // Compute effective question with audio URL based on selected news level.
  // A2 level prefers audio_a2_url, falling back to audio_url.
  // B2 level prefers audio_url, falling back to audio_a2_url.
  const effectiveQuestion = useMemo(() => {
    if (!currentQuestion) return null;
    const q = currentQuestion.question;
    const effectiveAudioUrl =
      newsLevel === 'a2' ? (q.audio_a2_url ?? q.audio_url) : (q.audio_url ?? q.audio_a2_url);
    return { ...q, audio_url: effectiveAudioUrl };
  }, [currentQuestion, newsLevel]);

  const { resetTracking } = usePracticeSession({
    startEvent: 'culture_session_started',
    completeEvent: 'culture_session_completed',
    abandonEvent: 'culture_session_abandoned',
    isSessionActive: Boolean(session && session.status === 'active'),
    isSessionComplete: Boolean(summary),
    getStartProps: useCallback(() => {
      if (!session) return null;
      return {
        deck_id: session.deckId,
        session_id: session.sessionId,
        question_count: session.questions.length,
        language: session.config.language,
      };
    }, [session]),
    getCompleteProps: useCallback(
      (_durationSec: number) => {
        if (!summary) return null;
        return {
          deck_id: summary.deckId,
          session_id: summary.sessionId,
          questions_total: summary.questionResults.length,
          questions_correct: summary.stats.correctCount,
          accuracy: summary.stats.accuracy,
          duration_sec: summary.durationSeconds,
          xp_earned: summary.stats.xpEarned,
        };
      },
      [summary]
    ),
    getAbandonProps: useCallback(
      (durationSec: number) => {
        if (
          !session ||
          session.status !== 'active' ||
          session.stats.questionsAnswered === 0 ||
          summary
        ) {
          return null;
        }
        return {
          deck_id: session.deckId,
          session_id: session.sessionId,
          questions_answered: session.stats.questionsAnswered,
          duration_sec: durationSec,
        };
      },
      [session, summary]
    ),
    fallbackDurationSec: 0,
    onCompleteTracked: useCallback(() => {
      loadXPStats(true);
    }, [loadXPStats]),
  });

  // Check for recoverable session on mount
  useEffect(() => {
    const hasRecoverable = checkRecoverableSession();
    if (hasRecoverable) {
      setShowRecoveryDialog(true);
    } else if (
      deckId &&
      !summary &&
      (!session || session.deckId !== deckId || session.status !== 'active')
    ) {
      resetSession();
      initializeSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

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

  /**
   * Initialize a new practice session
   */
  const initializeSession = useCallback(async () => {
    if (!deckId) return;

    try {
      // Fetch questions from backend API
      const queue = await cultureDeckAPI.getQuestionQueue(deckId, {
        limit: 50,
        include_new: true,
        new_questions_limit: 20,
      });

      // Track if user has studied questions (for "Practice Anyway" feature)
      setHasStudiedQuestions(queue.has_studied_questions);

      if (queue.questions.length === 0) {
        // Handle empty queue - user has no due questions
        log.info('No questions due for review');
        setHasNoQuestionsDue(true);
        return;
      }

      // Map backend response to frontend format
      const questions: CultureQuestionResponse[] = queue.questions.map((q) => ({
        id: q.id,
        question_text: q.question_text,
        options: q.options,
        option_count: q.option_count,
        image_url: q.image_url,
        audio_url: q.audio_url,
        audio_a2_url: q.audio_a2_url,
        order_index: q.order_index,
        correct_option: q.correct_option,
        original_article_url: q.original_article_url,
        also_in_decks: q.also_in_decks,
      }));

      const config: CultureSessionConfig = {
        ...DEFAULT_SESSION_CONFIG,
        questionCount: questions.length,
      };

      // Get deck name in current language (fallback to 'en')
      const lang = (i18n.language as keyof LocalizedText) || 'en';
      const deckName = queue.deck_name[lang] || queue.deck_name.en;

      // Use real deck name and category from API
      startSession(deckId, deckName, queue.category, questions, config);
    } catch (err) {
      reportAPIError(err, { operation: 'initializeSession', endpoint: `/culture/${deckId}/queue` });
    }
  }, [deckId, startSession]);

  /**
   * Handle answer submission
   */
  const handleAnswer = useCallback(
    (selectedOption: number) => {
      if (!session || !currentQuestion) return;

      const isCorrect = selectedOption === currentQuestion.question.correct_option;

      const startedAt = currentQuestion.startedAt
        ? new Date(currentQuestion.startedAt).getTime()
        : Date.now();
      const timeTakenMs = Date.now() - startedAt;
      const timeTakenSeconds = Math.min(Math.round(timeTakenMs / 1000), MAX_ANSWER_TIME_SECONDS);

      const optimisticResponse: CultureAnswerResponse = {
        is_correct: isCorrect,
        correct_option: currentQuestion.question.correct_option,
        xp_earned: isCorrect ? 10 : 2,
        deck_category: session.category,
      };

      setLastAnswerResponse(optimisticResponse);
      answerQuestion(selectedOption, optimisticResponse);

      cultureDeckAPI
        .submitAnswer(currentQuestion.question.id, {
          selected_option: selectedOption,
          time_taken: timeTakenSeconds,
          language: session.config.language,
        })
        .catch((err) => {
          reportAPIError(err, {
            operation: 'submitAnswer',
            endpoint: `/culture/questions/${currentQuestion.question.id}/answer`,
          });
        });

      try {
        track('culture_question_answered', {
          deck_id: session.deckId,
          session_id: session.sessionId,
          question_id: currentQuestion.question.id,
          selected_option: selectedOption,
          is_correct: isCorrect,
          time_ms: timeTakenMs,
          xp_earned: optimisticResponse.xp_earned,
        });
      } catch {
        // Silent failure for analytics
      }
    },
    [session, currentQuestion, answerQuestion, track]
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

  /**
   * Handle A2/B2 level toggle
   */
  const handleNewsLevelChange = useCallback((level: NewsLevel) => {
    setPersistedNewsLevel(level);
    setNewsLevel(level);
    trackNewsLevelToggled({ level, page: 'culture_practice' });
  }, []);

  /**
   * Handle Try Again button on ScoreCard
   */
  const handleTryAgain = useCallback(() => {
    resetSession();
    resetTracking();
    initializeSession();
  }, [resetSession, resetTracking, initializeSession]);

  /**
   * Handle "Practice Anyway" - fetch weakest questions when no questions are due
   */
  const handlePracticeAnyway = useCallback(async () => {
    if (!deckId) return;

    setIsPracticeAnywayLoading(true);

    try {
      // Fetch weakest questions with force_practice mode
      const queue = await cultureDeckAPI.getQuestionQueue(deckId, {
        limit: 50,
        include_new: false, // Don't include new questions in practice anyway mode
        force_practice: true,
      });

      if (queue.questions.length === 0) {
        // Should not happen if has_studied_questions is true, but handle gracefully
        log.warn('Practice Anyway returned no questions');
        return;
      }

      // Map backend response to frontend format
      const questions: CultureQuestionResponse[] = queue.questions.map((q) => ({
        id: q.id,
        question_text: q.question_text,
        options: q.options,
        option_count: q.option_count,
        image_url: q.image_url,
        audio_url: q.audio_url,
        audio_a2_url: q.audio_a2_url,
        order_index: q.order_index,
        correct_option: q.correct_option,
        original_article_url: q.original_article_url,
        also_in_decks: q.also_in_decks,
      }));

      const config: CultureSessionConfig = {
        ...DEFAULT_SESSION_CONFIG,
        questionCount: questions.length,
      };

      // Get deck name in current language (fallback to 'en')
      const lang = (i18n.language as keyof LocalizedText) || 'en';
      const deckName = queue.deck_name[lang] || queue.deck_name.en;

      // Reset the "no questions due" state and start session
      setHasNoQuestionsDue(false);
      startSession(deckId, deckName, queue.category, questions, config);
    } catch (err) {
      reportAPIError(err, {
        operation: 'handlePracticeAnyway',
        endpoint: `/culture/${deckId}/queue?force_practice=true`,
      });
    } finally {
      setIsPracticeAnywayLoading(false);
    }
  }, [deckId, startSession]);

  // Recovery dialog
  if (showRecoveryDialog) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--practice-bg)] p-4">
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

  // Session complete - show inline ScoreCard
  if (summary) {
    return (
      <div className="min-h-screen bg-[var(--practice-bg)] px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-[520px]">
          <ScoreCard
            correct={summary.stats.correctCount}
            incorrect={summary.stats.incorrectCount}
            total={summary.stats.questionsAnswered}
            onTryAgain={handleTryAgain}
          />
        </div>
      </div>
    );
  }

  // No questions due for review state
  if (hasNoQuestionsDue) {
    return (
      <div className="min-h-screen bg-[var(--practice-bg)] px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-[520px]">
          <Button
            variant="ghost"
            onClick={() => navigate(`/culture/decks/${deckId}`)}
            className="mb-4"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('practice.backToDeck', 'Back to Deck')}
          </Button>
          <Card className="bg-card">
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-foreground">
                {t('practice.allCaughtUp', 'All Caught Up!')}
              </h2>
              <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
                {t(
                  'practice.noQuestionsDueDescription',
                  'Great job! You have no questions due for review right now. Come back later or explore other decks.'
                )}
              </p>
              <div className="mx-auto flex w-full max-w-xs flex-col gap-3">
                {/* Practice Anyway button - only show if user has studied questions before */}
                {hasStudiedQuestions && (
                  <Button
                    onClick={handlePracticeAnyway}
                    disabled={isPracticeAnywayLoading}
                    className="w-full"
                    data-testid="practice-anyway-button"
                  >
                    {isPracticeAnywayLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('common:loading', 'Loading...')}
                      </>
                    ) : (
                      t('practice.practiceAnyway', 'Practice Anyway')
                    )}
                  </Button>
                )}
                <div className="flex gap-3">
                  <Button className="flex-1" variant="outline" onClick={() => navigate('/decks')}>
                    {t('practice.browseDecks', 'Browse Decks')}
                  </Button>
                  <Button
                    className="flex-1"
                    variant={hasStudiedQuestions ? 'outline' : 'default'}
                    onClick={() => navigate(`/culture/decks/${deckId}`)}
                  >
                    {t('practice.returnToDeck', 'Return to Deck')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
      <div className="min-h-screen bg-[var(--practice-bg)] px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-[520px]">
          <Button variant="ghost" onClick={() => navigate('/decks')} className="mb-4">
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('practice.backToDecks', 'Back to Decks')}
          </Button>
          <Alert variant="destructive" className="bg-card">
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
      <div className="min-h-screen bg-[var(--practice-bg)] px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-[520px]">
          <Button variant="ghost" onClick={() => navigate('/decks')} className="mb-4">
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('practice.backToDecks', 'Back to Decks')}
          </Button>
          <Alert className="bg-card">
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

  const currentLanguage = session.config.language;

  return (
    <div className="min-h-screen bg-[var(--practice-bg)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[520px]">
        {/* Header */}
        <PracticeHeader
          onExit={handleExitClick}
          exitLabel={t('practice.exit', 'Exit')}
          exitTestId="exit-button"
          className="mb-4 px-0 py-0"
          rightSlot={
            <>
              {showLevelToggle && (
                <div
                  className="flex items-center gap-1"
                  aria-label={t('common:news.level.label', 'Content level')}
                >
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {t('common:news.level.difficulty')}
                  </span>
                  <Button
                    variant={newsLevel === 'a2' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleNewsLevelChange('a2')}
                    data-testid="level-toggle-a2"
                  >
                    {t('common:news.level.a2', 'A2')}
                  </Button>
                  <Button
                    variant={newsLevel === 'b2' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleNewsLevelChange('b2')}
                    data-testid="level-toggle-b2"
                  >
                    {t('common:news.level.b2', 'B2')}
                  </Button>
                </div>
              )}
              {showLevelToggle && <div className="h-6 w-px bg-border" aria-hidden="true" />}
              <LanguageSelector
                value={currentLanguage}
                onChange={handleLanguageChange}
                variant="pill"
                size="sm"
              />
            </>
          }
        />

        {/* Question with inline feedback */}
        <div key={session.currentIndex} className="flex justify-center">
          <MCQComponent
            question={effectiveQuestion as NonNullable<typeof effectiveQuestion>}
            language={currentLanguage}
            onAnswer={handleAnswer}
            questionNumber={progress.current}
            totalQuestions={progress.total}
            category={session.category}
            deckId={deckId}
            showFeedback={true}
            onNext={handleNextQuestion}
            isLastQuestion={progress.current >= progress.total}
            answerResult={
              lastAnswerResponse
                ? {
                    isCorrect: lastAnswerResponse.is_correct,
                    correctOption: lastAnswerResponse.correct_option,
                  }
                : undefined
            }
          />
        </div>
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
