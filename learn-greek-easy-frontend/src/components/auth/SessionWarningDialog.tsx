import React, { useMemo } from 'react';

import { Clock, AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SessionWarningDialogProps {
  open: boolean;
  onExtendSession: () => void;
  remainingSeconds: number;
}

/**
 * Session timeout warning dialog
 *
 * Shown 5 minutes before automatic logout.
 * Displays countdown and allows user to extend session.
 */
export const SessionWarningDialog: React.FC<SessionWarningDialogProps> = ({
  open,
  onExtendSession,
  remainingSeconds,
}) => {
  // Format remaining time as MM:SS
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingSeconds]);

  // Determine urgency level for styling
  const isUrgent = remainingSeconds < 60; // Last minute

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${isUrgent ? 'text-red-500' : 'text-orange-500'}`} />
            <DialogTitle>Session Expiring Soon</DialogTitle>
          </div>
          <DialogDescription>
            Your session will expire due to inactivity. Click "Stay Logged In" to continue your
            learning session.
          </DialogDescription>
        </DialogHeader>

        <Alert variant={isUrgent ? 'destructive' : 'default'} className="my-4">
          <Clock className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <span className="font-semibold">Time remaining:</span>
            <span className={`ml-2 font-mono text-lg ${isUrgent ? 'text-red-600' : ''}`}>
              {formattedTime}
            </span>
          </AlertDescription>
        </Alert>

        <div className="text-sm text-muted-foreground">
          <p>You will be automatically logged out when the timer reaches zero.</p>
          <p className="mt-2">
            Any unsaved changes will be lost. Please save your work before the session expires.
          </p>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            onClick={onExtendSession}
            className="w-full bg-gradient-to-br from-[#667eea] to-[#764ba2]"
            size="lg"
          >
            Stay Logged In (Extend Session)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
