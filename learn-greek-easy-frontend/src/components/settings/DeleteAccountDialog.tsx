import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/hooks/use-toast';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout } = useAuthStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isDeleting) return;
    setStep(1);
    setPassword('');
    setShowPassword(false);
    setAcknowledged(false);
    setIsDeleting(false);
    setError(null);
    onOpenChange(false);
  };

  const handleVerifyPassword = () => {
    setError(null);

    // Simple password validation (in real app, verify with backend)
    if (password.length < 6) {
      setError('Please enter your password');
      return;
    }

    // For MVP, accept any password with length >= 6
    // TODO: Replace with actual password verification
    setStep(3);
  };

  const handleDelete = async () => {
    if (!acknowledged) {
      setError('You must acknowledge that this action cannot be undone');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Clear all localStorage data
      localStorage.clear();

      toast({
        title: 'Account deleted successfully',
        description: 'Your account and all data have been permanently deleted.',
      });

      // Logout and redirect
      logout();
      handleClose();
      navigate('/');
    } catch (error) {
      toast({
        title: 'Failed to delete account',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {step === 1 ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <DialogTitle className="text-red-600">
                  Delete Account?
                </DialogTitle>
              </div>
              <DialogDescription className="space-y-3 pt-2">
                <p className="font-medium text-foreground">
                  This will permanently delete:
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>Your account and all login credentials</li>
                  <li>All learning progress and review history</li>
                  <li>All statistics, analytics, and achievements</li>
                  <li>All deck data and flashcards</li>
                  <li>All settings and preferences</li>
                </ul>
                <p className="font-medium text-red-600">
                  This action cannot be undone. All data will be lost permanently.
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
        ) : step === 2 ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <DialogTitle className="text-red-600">
                  Verify Your Password
                </DialogTitle>
              </div>
              <DialogDescription className="space-y-4 pt-2">
                <p className="text-foreground">
                  Enter your current password to continue:
                </p>
                <div className="space-y-2">
                  <Label htmlFor="verify-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="verify-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="Enter your password"
                      disabled={isDeleting}
                      className={error ? 'border-red-500' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleVerifyPassword}
                disabled={!password}
              >
                Verify Password
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
                <p className="font-medium text-foreground">
                  Are you absolutely sure you want to delete your account?
                </p>
                <p className="text-sm">
                  All your data will be permanently deleted and cannot be recovered.
                </p>
                <div className="flex items-start space-x-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <Checkbox
                    id="acknowledge"
                    checked={acknowledged}
                    onCheckedChange={(checked) => {
                      setAcknowledged(checked === true);
                      setError(null);
                    }}
                    disabled={isDeleting}
                  />
                  <label
                    htmlFor="acknowledge"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I understand this action cannot be undone and all my data will be permanently deleted
                  </label>
                </div>
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep(2);
                  setError(null);
                }}
                disabled={isDeleting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!acknowledged || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete My Account'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
