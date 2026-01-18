/**
 * Mock Exam Session Page
 *
 * Full-screen immersive mock citizenship exam experience.
 * Orchestrates the complete exam flow: timer, questions, feedback, results.
 *
 * Features:
 * - 45-minute countdown timer with warning levels
 * - Session recovery from sessionStorage
 * - Exit confirmation dialog
 * - beforeunload handler for browser close protection
 * - Keyboard shortcuts (Escape, Space/Arrow for navigation)
 * - Language switching for question display
 * - Progress tracking with visual feedback
 * - Auto-submit on timer expiry
 * - PostHog analytics events
 */

import { useEffect, useRef, useState, useCallback } from 'react';

import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { MCQComponent, QuestionFeedback, LanguageSelector } from '@/components/culture';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { MockExamHeader, TimerWarningBanner } from '@/components/mockExam';
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
import { toast } from '@/hooks/use-toast';
import { useMockExamKeyboardShortcuts } from '@/hooks/useMockExamKeyboardShortcuts';
import { useMockExamTimer } from '@/hooks/useMockExamTimer';
import { useQuestionLanguage } from '@/hooks/useQuestionLanguage';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import log from '@/lib/logger';
import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import type { CultureQuestionResponse } from '@/types/culture';
import type { MockExamAnswerResponse } from '@/types/mockExam';

/** Option letter mapping for feedback display */
const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Loading skeleton for session page
 */
function SessionPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b border-border bg-background/95 px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="p-4 pt-8 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Skeleton className="mb-6 h-10 w-48" />
          <Skeleton className="mb-8 h-4 w-full" />
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
              <Skeleton className="mx-auto h-12 w-48" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Mock Exam Session Page Component
 */
export const MockExamSessionPage: React.FC = () => {
  const { t } = useTranslation(['mockExam', 'common', 'culture']);
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
    startExam,
    answerQuestion,
    nextQuestion,
    abandonExam,
    clearError,
    checkRecoverableSession,
    recoverSession,
    dismissRecovery,
  } = useMockExamSessionStore();

  // Language management
  const { questionLanguage, setQuestionLanguage } = useQuestionLanguage();

  // Local state
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAnswerResponse, setLastAnswerResponse] = useState<MockExamAnswerResponse | null>(null);
  const [hasShown5MinWarning, setHasShown5MinWarning] = useState(false);
  const [hasShown1MinWarning, setHasShown1MinWarning] = useState(false);

  // Refs for tracking
  const hasTrackedStart = useRef(false);
  const hasInitialized = useRef(false);

  // Timer hook with warning callbacks
  const { formattedTime, warningLevel, remainingSeconds } = useMockExamTimer({
    onWarning: (level) => {
      if (level === 'warning_5min' && !hasShown5MinWarning) {
        setHasShown5MinWarning(true);
        toast({
          title: t('session.warning5min', { defaultValue: '5 minutes remaining!' }),
          description: t('session.warning5minDesc', {
            defaultValue: 'Make sure to submit your remaining answers.',
          }),
        });
      }
      if (level === 'warning_1min' && !hasShown1MinWarning) {
        setHasShown1MinWarning(true);
        toast({
          title: t('session.warning1min', { defaultValue: 'Only 1 minute left!' }),
          description: t('session.warning1minDesc', {
            defaultValue: 'Your exam will auto-submit when time runs out.',
          }),
          variant: 'destructive',
        });
      }
    },
    onExpired: () => {
      // Timer expired - navigate to results after store handles completion
      log.info('Timer expired, navigating to results');
    },
  });

  // Calculate derived state
  const isInFeedback = lastAnswerResponse !== null && currentQuestion?.answeredAt !== null;
  const isLastQuestion = progress.current >= progress.total;

  // Keyboard shortcuts
  useMockExamKeyboardShortcuts({
    onEscape: () => setShowExitConfirm(true),
    onNextQuestion: handleNextQuestion,
    isInFeedback,
    disabled: showExitConfirm || showRecoveryDialog || isLoading || isSubmitting,
  });

  // Check for recoverable session on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const hasRecoverable = checkRecoverableSession();
    if (hasRecoverable) {
      setShowRecoveryDialog(true);
    } else if (!session) {
      // Start new session
      startExam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate to results when session completes
  useEffect(() => {
    if (summary) {
      const timer = setTimeout(() => {
        navigate('/practice/culture-exam/results');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [summary, navigate]);

  // Track session start
  useEffect(() => {
    if (session && session.status === 'active' && !hasTrackedStart.current) {
      hasTrackedStart.current = true;
      try {
        track('mock_exam_session_started' as never, {
          session_id: session.backendSession.id,
          question_count: session.questions.length,
          is_resumed: session.isResumed,
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

  /**
   * Handle answer submission
   */
  const handleAnswer = useCallback(
    async (selectedOption: number) => {
      if (!session || !currentQuestion || isSubmitting) return;

      setIsSubmitting(true);

      try {
        await answerQuestion(selectedOption);

        // Get the response from the updated store state
        const updatedQuestion = useMockExamSessionStore.getState().currentQuestion;
        if (updatedQuestion) {
          setLastAnswerResponse({
            is_correct: updatedQuestion.isCorrect,
            correct_option: selectedOption, // Will be overwritten if backend returns different
            xp_earned: updatedQuestion.xpEarned,
            current_score: useMockExamSessionStore.getState().session?.stats.correctCount ?? 0,
            answers_count: useMockExamSessionStore.getState().session?.stats.questionsAnswered ?? 0,
            duplicate: false,
          });
        }

        // Track answer event
        try {
          track('mock_exam_question_answered' as never, {
            session_id: session.backendSession.id,
            question_id: currentQuestion.question.id,
            selected_option: selectedOption,
            is_correct: updatedQuestion?.isCorrect,
            time_remaining: remainingSeconds,
          });
        } catch {
          // Silent failure for analytics
        }
      } catch (err) {
        log.error('Failed to submit answer:', err);
        toast({
          title: t('common:error', { defaultValue: 'Error' }),
          description: t('session.answerError', {
            defaultValue: 'Failed to submit answer. Please try again.',
          }),
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [session, currentQuestion, isSubmitting, answerQuestion, track, remainingSeconds, t]
  );

  /**
   * Handle next question button
   */
  function handleNextQuestion() {
    setLastAnswerResponse(null);
    nextQuestion();
  }

  /**
   * Handle exit button click
   */
  const handleExitClick = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  /**
   * Handle confirmed exit
   */
  const handleConfirmExit = useCallback(async () => {
    // Track abandonment
    if (session) {
      try {
        track('mock_exam_session_abandoned' as never, {
          session_id: session.backendSession.id,
          questions_answered: session.stats.questionsAnswered,
          time_remaining: remainingSeconds,
        });
      } catch {
        // Silent failure
      }
    }

    await abandonExam();
    navigate('/practice/culture-exam');
  }, [session, abandonExam, navigate, track, remainingSeconds]);

  /**
   * Handle session recovery - resume
   */
  const handleRecoverSession = useCallback(async () => {
    const recovered = await recoverSession();
    setShowRecoveryDialog(false);
    if (!recovered) {
      // If recovery failed, start fresh
      await startExam();
    }
  }, [recoverSession, startExam]);

  /**
   * Handle dismissing recovery - start new
   */
  const handleDismissRecovery = useCallback(async () => {
    dismissRecovery();
    setShowRecoveryDialog(false);
    await startExam();
  }, [dismissRecovery, startExam]);

  // Recovery dialog
  if (showRecoveryDialog) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {t('session.recoveryTitle', { defaultValue: 'Resume Exam?' })}
              </DialogTitle>
              <DialogDescription>
                {t('session.recoveryDescription', {
                  defaultValue:
                    'You have an unfinished mock exam. Would you like to continue where you left off?',
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-start">
              <Button variant="outline" onClick={handleDismissRecovery}>
                {t('session.startNew', { defaultValue: 'Start New' })}
              </Button>
              <Button onClick={handleRecoverSession}>
                {t('session.resume', { defaultValue: 'Resume Exam' })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Loading state
  if (isLoading || !session) {
    return <SessionPageSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Alert variant="destructive" className="bg-card">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('common:error', { defaultValue: 'Error' })}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-3">
            <Button onClick={() => clearError()} variant="default">
              {t('common:retry', { defaultValue: 'Try Again' })}
            </Button>
            <Button onClick={() => navigate('/practice/culture-exam')} variant="secondary">
              {t('results.backToHome')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No current question (shouldn't happen but handle gracefully)
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Alert className="bg-card">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('session.noQuestions', { defaultValue: 'No Questions' })}</AlertTitle>
            <AlertDescription>
              {t('session.noQuestionsDescription', {
                defaultValue: 'No questions available for this exam.',
              })}
            </AlertDescription>
          </Alert>
          <Button onClick={() => navigate('/practice/culture-exam')} className="mt-4">
            {t('results.backToHome')}
          </Button>
        </div>
      </div>
    );
  }

  // Map MockExamQuestion to CultureQuestionResponse format for MCQComponent
  const mcqQuestion: CultureQuestionResponse = {
    id: currentQuestion.question.id,
    question_text: currentQuestion.question.question_text,
    options: currentQuestion.question.options,
    option_count: currentQuestion.question.option_count,
    image_url: currentQuestion.question.image_url,
    order_index: currentQuestion.question.order_index,
  };

  const progressPercent = (progress.current / progress.total) * 100;
  const showWarningBanner = warningLevel === 'warning_1min';

  return (
    <div
      className={`min-h-screen bg-background ${showWarningBanner ? 'pb-16' : ''}`}
      data-testid="mock-exam-session-page"
    >
      {/* Sticky Header */}
      <MockExamHeader
        onExit={handleExitClick}
        formattedTime={formattedTime}
        warningLevel={warningLevel}
        currentQuestion={progress.current}
        totalQuestions={progress.total}
        correctCount={session.stats.correctCount}
        answeredCount={session.stats.questionsAnswered}
      />

      {/* Main Content */}
      <div className="p-4 pt-6 md:p-8">
        <div className="mx-auto max-w-2xl">
          {/* Language selector */}
          <div className="mb-4 flex justify-end">
            <LanguageSelector value={questionLanguage} onChange={setQuestionLanguage} size="sm" />
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <Progress value={progressPercent} className="h-2 bg-secondary" />
          </div>

          {/* Question or Feedback */}
          <div className="flex justify-center">
            {isInFeedback && lastAnswerResponse ? (
              <QuestionFeedback
                isCorrect={lastAnswerResponse.is_correct ?? false}
                correctOption={{
                  label: OPTION_LETTERS[(lastAnswerResponse.correct_option ?? 1) - 1],
                  text: currentQuestion.question.options[
                    (lastAnswerResponse.correct_option ?? 1) - 1
                  ],
                }}
                xpEarned={lastAnswerResponse.xp_earned}
                language={questionLanguage}
                onNextQuestion={handleNextQuestion}
                isLastQuestion={isLastQuestion}
                className="w-full max-w-2xl"
              />
            ) : (
              <MCQComponent
                question={mcqQuestion}
                language={questionLanguage}
                onAnswer={handleAnswer}
                questionNumber={progress.current}
                totalQuestions={progress.total}
                disabled={isSubmitting}
              />
            )}
          </div>
        </div>
      </div>

      {/* Timer Warning Banner (1 minute) */}
      <TimerWarningBanner visible={showWarningBanner} formattedTime={formattedTime} />

      {/* Exit confirmation dialog */}
      <ConfirmDialog
        open={showExitConfirm}
        onOpenChange={setShowExitConfirm}
        title={t('session.abandonTitle', { defaultValue: 'Abandon Exam?' })}
        description={t('session.abandonConfirm')}
        confirmText={t('session.abandonYes')}
        cancelText={t('session.abandonNo')}
        onConfirm={handleConfirmExit}
        variant="destructive"
      />
    </div>
  );
};
