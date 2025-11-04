import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReviewStore } from '@/stores/reviewStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { FlashcardContainer } from '@/components/review/FlashcardContainer';
import { FlashcardSkeleton } from '@/components/review/FlashcardSkeleton';
import { KeyboardShortcutsHelp } from '@/components/review/KeyboardShortcutsHelp';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, ChevronLeft } from 'lucide-react';

export function FlashcardReviewPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const {
    activeSession,
    currentCard,
    startSession,
    isLoading,
    error,
    sessionSummary,
  } = useReviewStore();

  // Enable keyboard shortcuts
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  // Start session on mount
  useEffect(() => {
    if (deckId && !activeSession) {
      startSession(deckId);
    }
  }, [deckId, activeSession, startSession]);

  // Navigate to summary when session ends
  useEffect(() => {
    if (sessionSummary && deckId) {
      // Small delay for smooth transition
      const timer = setTimeout(() => {
        navigate(`/decks/${deckId}/summary`);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [sessionSummary, deckId, navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-10">
        <FlashcardSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-10">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate(`/decks/${deckId}`)}
            className="text-white hover:bg-white/20 mb-4"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Deck
          </Button>
          <Alert variant="destructive" className="bg-white">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-3">
            <Button onClick={() => deckId && startSession(deckId)} variant="default">
              Retry
            </Button>
            <Button onClick={() => navigate(`/decks/${deckId}`)} variant="secondary">
              Back to Deck
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No cards due state
  if (!currentCard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-10">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate(`/decks/${deckId}`)}
            className="text-white hover:bg-white/20 mb-4"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Deck
          </Button>
          <Alert className="bg-white">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No cards due</AlertTitle>
            <AlertDescription>
              You've reviewed all the cards in this deck! Come back later for more practice.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate(`/decks/${deckId}`)} variant="secondary">
              Back to Deck
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main flashcard view
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-10">
      <div className="max-w-4xl mx-auto mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate(`/decks/${deckId}`)}
          className="text-white hover:bg-white/20"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Exit Review
        </Button>
      </div>
      <FlashcardContainer card={currentCard} />
      <KeyboardShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}
