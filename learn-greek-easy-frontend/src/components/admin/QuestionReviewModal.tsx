import React, { useState, useEffect, useCallback } from 'react';

import { format } from 'date-fns';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { AlertDialog } from '@/components/dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { adminAPI, type CultureDeckListItem, type PendingQuestion } from '@/services/adminAPI';

type Language = 'el' | 'en' | 'ru';

interface QuestionReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string;
  articleUrl: string;
  onApproved: () => void;
  onRejected: () => void;
}

export const QuestionReviewModal: React.FC<QuestionReviewModalProps> = ({
  open,
  onOpenChange,
  questionId,
  articleUrl,
  onApproved,
  onRejected,
}) => {
  // Data state
  const [question, setQuestion] = useState<PendingQuestion | null>(null);
  const [decks, setDecks] = useState<CultureDeckListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');

  // Action state
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [questionData, decksData] = await Promise.all([
        adminAPI.getQuestion(questionId),
        adminAPI.getCultureDecks(),
      ]);
      setQuestion(questionData);
      setDecks(decksData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load question';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [questionId]);

  // Fetch question and decks on open
  useEffect(() => {
    if (open && questionId) {
      fetchData();
    }
    // Reset state when closed
    if (!open) {
      setQuestion(null);
      setDecks([]);
      setError(null);
      setSelectedDeckId('');
      setIsLoading(true);
    }
  }, [open, questionId, fetchData]);

  const handleApprove = async () => {
    if (!selectedDeckId || !question) return;

    setIsApproving(true);
    try {
      await adminAPI.approveQuestion(question.id, selectedDeckId);
      toast.success('Question approved successfully');
      onApproved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve question';
      toast.error(message);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!question) return;

    setIsRejecting(true);
    try {
      await adminAPI.rejectQuestion(question.id);
      toast.success('Question deleted successfully');
      onRejected();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete question';
      toast.error(message);
    } finally {
      setIsRejecting(false);
      setShowRejectConfirm(false);
    }
  };

  // Build options array
  const getOptions = () => {
    if (!question) return [];
    const options: (Record<string, string> | null)[] = [question.option_a, question.option_b];
    if (question.option_c) options.push(question.option_c);
    if (question.option_d) options.push(question.option_d);
    return options.filter((o): o is Record<string, string> => o !== null);
  };

  const optionLabels = ['A', 'B', 'C', 'D'];
  const options = getOptions();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[80vh] max-w-2xl overflow-y-auto"
          data-testid="question-review-modal"
        >
          <DialogHeader>
            <DialogTitle>Review Generated Question</DialogTitle>
          </DialogHeader>

          {isLoading && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-muted-foreground">Loading question...</p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/15 p-4 text-destructive">{error}</div>
          )}

          {!isLoading && !error && question && (
            <div className="space-y-4">
              {/* Language Switcher - Custom button-based tabs */}
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                {(['el', 'en', 'ru'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      selectedLanguage === lang
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    role="tab"
                    aria-selected={selectedLanguage === lang}
                  >
                    {lang === 'el' ? 'Greek' : lang === 'en' ? 'English' : 'Russian'}
                  </button>
                ))}
              </div>

              {/* Question Text */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Question</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{question.question_text[selectedLanguage]}</p>
                </CardContent>
              </Card>

              {/* Options */}
              <div className="space-y-2">
                <Label>Options</Label>
                {options.map((option, index) => {
                  const isCorrect = index + 1 === question.correct_option;
                  return (
                    <div
                      key={index}
                      className={cn(
                        'flex items-center justify-between rounded-md border p-3',
                        isCorrect &&
                          'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                      )}
                      data-testid={`option-${optionLabels[index]}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{optionLabels[index]}</span>
                        <span>{option[selectedLanguage]}</span>
                      </div>
                      {isCorrect && (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="h-4 w-4" />
                          <span className="text-sm">Correct</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Source Article */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Source:</span>
                <a
                  href={articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  View Article
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* Created At */}
              <div className="text-sm text-muted-foreground">
                Generated: {format(new Date(question.created_at), 'PPpp')}
              </div>

              {/* Deck Selector */}
              <div className="flex items-center gap-4">
                <Label htmlFor="deck-select">Assign to Deck:</Label>
                <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                  <SelectTrigger className="w-[280px]" id="deck-select">
                    <SelectValue placeholder="Select a deck..." />
                  </SelectTrigger>
                  <SelectContent>
                    {decks.map((deck) => (
                      <SelectItem key={deck.id} value={deck.id}>
                        {deck.name} ({deck.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="destructive"
              onClick={() => setShowRejectConfirm(true)}
              disabled={isLoading || isApproving || isRejecting}
            >
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              disabled={!selectedDeckId || isLoading || isApproving || isRejecting}
            >
              {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Confirmation */}
      <AlertDialog
        open={showRejectConfirm}
        onOpenChange={setShowRejectConfirm}
        title="Delete Question?"
        description="This will permanently delete the generated question. This action cannot be undone. The article will become available for new question generation."
        variant="warning"
        dismissible={!isRejecting}
        actions={[
          {
            label: 'Cancel',
            onClick: () => setShowRejectConfirm(false),
            variant: 'outline',
          },
          {
            label: isRejecting ? 'Deleting...' : 'Delete',
            onClick: handleReject,
            variant: 'destructive',
          },
        ]}
      />
    </>
  );
};
