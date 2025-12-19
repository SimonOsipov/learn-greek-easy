import { useState } from 'react';

import { AlertTriangle, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const { t } = useTranslation('settings');
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
      setError(t('danger.deleteAccount.pleaseEnterPassword'));
      return;
    }

    // For MVP, accept any password with length >= 6
    // TODO: Replace with actual password verification
    setStep(3);
  };

  const handleDelete = async () => {
    if (!acknowledged) {
      setError(t('danger.deleteAccount.mustAcknowledge'));
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Clear all localStorage data
      localStorage.clear();

      toast({
        title: t('danger.deleteAccount.success'),
        description: t('danger.deleteAccount.successDescription'),
      });

      // Logout and redirect
      logout();
      handleClose();
      navigate('/');
    } catch (error) {
      toast({
        title: t('danger.deleteAccount.error'),
        description: error instanceof Error ? error.message : t('common:error.tryAgain'),
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
                  {t('danger.deleteAccount.dialogTitle')}
                </DialogTitle>
              </div>
              <DialogDescription className="space-y-3 pt-2">
                <p className="font-medium text-foreground">
                  {t('danger.deleteAccount.willDelete')}
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>{t('danger.deleteAccount.deleteItems.account')}</li>
                  <li>{t('danger.deleteAccount.deleteItems.progress')}</li>
                  <li>{t('danger.deleteAccount.deleteItems.statistics')}</li>
                  <li>{t('danger.deleteAccount.deleteItems.deckData')}</li>
                  <li>{t('danger.deleteAccount.deleteItems.settings')}</li>
                </ul>
                <p className="font-medium text-red-600">
                  {t('danger.deleteAccount.permanentWarning')}
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {t('danger.cancel')}
              </Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                {t('danger.continue')}
              </Button>
            </DialogFooter>
          </>
        ) : step === 2 ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <DialogTitle className="text-red-600">
                  {t('danger.deleteAccount.verifyPassword')}
                </DialogTitle>
              </div>
              <DialogDescription className="space-y-4 pt-2">
                <p className="text-foreground">{t('danger.deleteAccount.enterPassword')}</p>
                <div className="space-y-2">
                  <Label htmlFor="verify-password">
                    {t('danger.deleteAccount.currentPassword')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="verify-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder={t('danger.deleteAccount.enterPasswordPlaceholder')}
                      disabled={isDeleting}
                      className={error ? 'border-red-500' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
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
                {t('danger.back')}
              </Button>
              <Button variant="destructive" onClick={handleVerifyPassword} disabled={!password}>
                {t('danger.deleteAccount.verifyPasswordButton')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <DialogTitle className="text-red-600">
                  {t('danger.deleteAccount.finalConfirmation')}
                </DialogTitle>
              </div>
              <DialogDescription className="space-y-4 pt-2">
                <p className="font-medium text-foreground">
                  {t('danger.deleteAccount.absolutelySure')}
                </p>
                <p className="text-sm">{t('danger.deleteAccount.dataNotRecoverable')}</p>
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
                    {t('danger.deleteAccount.acknowledge')}
                  </label>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
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
                {t('danger.back')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!acknowledged || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('danger.deleteAccount.deleting')}
                  </>
                ) : (
                  t('danger.deleteAccount.deleteMyAccount')
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
