import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Lock, Crown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { PasswordField } from '@/components/forms/PasswordField';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';

// Password change validation schema
const passwordChangeSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Current password is required')
      .min(8, 'Password must be at least 8 characters'),
    newPassword: z
      .string()
      .min(1, 'New password is required')
      .min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

/**
 * AccountSection Component
 *
 * Provides essential account management features:
 * - Password change functionality
 * - Subscription tier display with upgrade option
 *
 * Integrates with authStore for all data operations.
 * Uses react-hook-form with Zod validation for forms.
 */
export function AccountSection() {
  const { user, updatePassword } = useAuthStore();
  const { toast } = useToast();

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  // Password change form
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
    reset: resetPasswordForm,
    watch: watchPassword,
  } = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onPasswordChange = async (data: PasswordChangeFormData) => {
    try {
      await updatePassword(data.currentPassword, data.newPassword);

      toast({
        title: 'Password updated',
        description: 'Your password has been successfully changed.',
      });

      setPasswordDialogOpen(false);
      resetPasswordForm();
    } catch (error) {
      toast({
        title: 'Failed to update password',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>
            Manage your password and subscription. Logged in as{' '}
            <strong data-testid="user-email">{user.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Password</h3>
            </div>

            <div className="rounded-lg bg-muted/50 p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Change your password to keep your account secure
              </p>
              <Button
                data-testid="change-password-button"
                variant="outline"
                size="sm"
                onClick={() => setPasswordDialogOpen(true)}
              >
                Change Password
              </Button>
            </div>
          </div>

          {/* Subscription Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Subscription</h3>
            </div>

            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current plan</p>
                  <div className="mt-1 flex items-center gap-2">
                    {user.role === 'premium' ? (
                      <Badge className="border-0 bg-gradient-to-r from-purple-500 to-purple-700 text-white">
                        Premium
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Free Plan</Badge>
                    )}
                  </div>
                </div>

                {user.role === 'free' && (
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800"
                    onClick={() => {
                      toast({
                        title: 'Premium upgrade',
                        description: 'Payment integration coming soon!',
                      });
                    }}
                  >
                    Upgrade to Premium
                  </Button>
                )}
              </div>

              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  Member since {format(new Date(user.createdAt), 'MMMM yyyy')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent data-testid="password-dialog">
          <DialogHeader>
            <DialogTitle data-testid="password-change-title">Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new password
            </DialogDescription>
          </DialogHeader>

          <form
            data-testid="password-change-form"
            onSubmit={handlePasswordSubmit(onPasswordChange)}
            className="space-y-4"
          >
            <PasswordField
              data-testid="current-password-input"
              label="Current Password"
              name="currentPassword"
              value={watchPassword('currentPassword')}
              onChange={(value) =>
                registerPassword('currentPassword').onChange({ target: { value } })
              }
              error={passwordErrors.currentPassword?.message}
              placeholder="Enter your current password"
              required
              autoComplete="current-password"
            />

            <PasswordField
              data-testid="new-password-input"
              label="New Password"
              name="newPassword"
              value={watchPassword('newPassword')}
              onChange={(value) => registerPassword('newPassword').onChange({ target: { value } })}
              error={passwordErrors.newPassword?.message}
              placeholder="Enter new password"
              required
              showStrength
              autoComplete="new-password"
            />

            <PasswordField
              data-testid="confirm-password-input"
              label="Confirm New Password"
              name="confirmPassword"
              value={watchPassword('confirmPassword')}
              onChange={(value) =>
                registerPassword('confirmPassword').onChange({ target: { value } })
              }
              error={passwordErrors.confirmPassword?.message}
              placeholder="Confirm new password"
              required
              autoComplete="new-password"
            />

            <DialogFooter>
              <Button
                data-testid="password-change-cancel"
                type="button"
                variant="outline"
                onClick={() => {
                  setPasswordDialogOpen(false);
                  resetPasswordForm();
                }}
                disabled={isPasswordSubmitting}
              >
                Cancel
              </Button>
              <SubmitButton
                data-testid="password-change-submit"
                loading={isPasswordSubmitting}
                loadingText="Updating..."
              >
                Update Password
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
