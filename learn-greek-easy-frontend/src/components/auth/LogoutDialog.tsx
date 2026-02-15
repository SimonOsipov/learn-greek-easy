import React, { useState } from 'react';

import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface LogoutDialogProps {
  trigger?: React.ReactNode;
}

/**
 * Logout confirmation dialog
 *
 * Shows a confirmation before logging the user out.
 * Cleans up auth state via Supabase and redirects to the main landing page.
 */
export const LogoutDialog: React.FC<LogoutDialogProps> = ({ trigger }) => {
  const { t } = useTranslation('auth');
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setOpen(false);
      navigate('/');
      toast({
        title: t('logout.success.title'),
        description: t('logout.success.description'),
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="logout-button" variant="ghost" className="w-full justify-start">
            <LogOut className="mr-2 h-4 w-4" />
            {t('logout.button')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="logout-dialog">
        <DialogHeader>
          <DialogTitle>{t('logout.title')}</DialogTitle>
          <DialogDescription>{t('logout.description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t('logout.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleLogout}
            disabled={isLoggingOut}
            data-testid="logout-confirm-button"
          >
            {isLoggingOut ? t('logout.loggingOut', 'Logging out...') : t('logout.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
