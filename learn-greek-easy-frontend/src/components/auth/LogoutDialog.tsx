import React, { useState } from 'react';

import { LogOut } from 'lucide-react';
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
import { useAuthStore } from '@/stores/authStore';

interface LogoutDialogProps {
  trigger?: React.ReactNode;
}

/**
 * Logout confirmation dialog
 *
 * Shows a confirmation before logging the user out.
 * Cleans up auth state and redirects to login page.
 */
export const LogoutDialog: React.FC<LogoutDialogProps> = ({ trigger }) => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/login');
    toast({
      title: 'Logged out successfully',
      description: 'Αντίο! See you next time! 👋',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="logout-button" variant="ghost" className="w-full justify-start">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Logout Confirmation</DialogTitle>
          <DialogDescription>
            Are you sure you want to logout? You'll need to sign in again to access your learning
            progress.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleLogout}>
            Yes, Logout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
