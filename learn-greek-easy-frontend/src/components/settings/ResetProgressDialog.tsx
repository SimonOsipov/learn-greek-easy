import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ResetProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetProgressDialog({ open, onOpenChange }: ResetProgressDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleClose = () => {
    if (isResetting) return;
    setStep(1);
    setConfirmText('');
    setIsResetting(false);
    onOpenChange(false);
  };

  const handleReset = async () => {
    setIsResetting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Clear progress data from localStorage
      localStorage.removeItem('learn-greek-easy:review-data');
      localStorage.removeItem('learn-greek-easy:analytics');
      localStorage.removeItem('learn-greek-easy:deck-progress');

      toast({
        title: 'Progress reset successfully',
        description: 'All your learning progress has been cleared.',
      });

      handleClose();

      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: 'Failed to reset progress',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      setIsResetting(false);
    }
  };

  const isConfirmValid = confirmText === 'RESET';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {step === 1 ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <DialogTitle className="text-red-600">
                  Reset All Progress?
                </DialogTitle>
              </div>
              <DialogDescription className="space-y-3 pt-2">
                <p className="font-medium text-foreground">
                  This will permanently delete:
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>All deck progress and review history</li>
                  <li>All learning statistics and analytics</li>
                  <li>All spaced repetition data</li>
                  <li>Study streaks and achievements</li>
                </ul>
                <p className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
                  <Check className="mr-2 inline-block h-4 w-4" />
                  Your account and settings will be preserved
                </p>
                <p className="font-medium text-red-600">
                  This action cannot be undone.
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <DialogTitle className="text-red-600">
                  Final Confirmation
                </DialogTitle>
              </div>
              <DialogDescription className="space-y-4 pt-2">
                <p className="text-foreground">
                  To confirm, type <span className="font-mono font-bold">RESET</span> below:
                </p>
                <div className="space-y-2">
                  <Label htmlFor="confirm-reset">Confirmation Text</Label>
                  <Input
                    id="confirm-reset"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type RESET"
                    className="font-mono"
                    disabled={isResetting}
                  />
                  {confirmText && !isConfirmValid && (
                    <p className="text-sm text-red-600">
                      Must type "RESET" exactly (case-sensitive)
                    </p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={isResetting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={!isConfirmValid || isResetting}
              >
                {isResetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset My Progress'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
