import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Lock, Crown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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

// Password change validation schema - messages will be handled by t() at runtime
const createPasswordChangeSchema = (t: (key: string) => string) =>
  z
    .object({
      currentPassword: z
        .string()
        .min(1, t('validation.currentPasswordRequired'))
        .min(8, t('validation.passwordMinLength')),
      newPassword: z
        .string()
        .min(1, t('validation.newPasswordRequired'))
        .min(8, t('validation.passwordMinLength')),
      confirmPassword: z.string().min(1, t('validation.confirmPasswordRequired')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('validation.passwordsDoNotMatch'),
      path: ['confirmPassword'],
    });

type PasswordChangeFormData = z.infer<ReturnType<typeof createPasswordChangeSchema>>;

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
  const { t } = useTranslation('settings');
  const { user, updatePassword } = useAuthStore();
  const { toast } = useToast();

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  // Password change form with translated validation messages
  const passwordChangeSchema = createPasswordChangeSchema(t);
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
        title: t('account.password.success'),
        description: t('account.password.successDescription'),
      });

      setPasswordDialogOpen(false);
      resetPasswordForm();
    } catch (error) {
      toast({
        title: t('account.password.error'),
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
          <CardTitle>{t('account.title')}</CardTitle>
          <CardDescription>
            {t('account.subtitle')}. {t('account.loggedInAs')}{' '}
            <strong data-testid="user-email">{user.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">{t('account.password.title')}</h3>
            </div>

            <div className="rounded-lg bg-muted/50 p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                {t('account.password.description')}
              </p>
              <Button
                data-testid="change-password-button"
                variant="outline"
                size="sm"
                onClick={() => setPasswordDialogOpen(true)}
              >
                {t('account.password.change')}
              </Button>
            </div>
          </div>

          {/* Subscription Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">{t('account.subscription.title')}</h3>
            </div>

            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('account.subscription.currentPlan')}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {user.role === 'premium' ? (
                      <Badge className="border-0 bg-gradient-to-r from-purple-500 to-purple-700 text-white">
                        {t('account.subscription.premium')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t('account.subscription.free')}</Badge>
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
                        title: t('account.subscription.upgradeTitle'),
                        description: t('account.subscription.upgradeDescription'),
                      });
                    }}
                  >
                    {t('account.subscription.upgrade')}
                  </Button>
                )}
              </div>

              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  {t('account.subscription.memberSince', {
                    date: format(new Date(user.createdAt), 'MMMM yyyy'),
                  })}
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
            <DialogTitle data-testid="password-change-title">
              {t('account.password.dialogTitle')}
            </DialogTitle>
            <DialogDescription>{t('account.password.dialogDescription')}</DialogDescription>
          </DialogHeader>

          <form
            data-testid="password-change-form"
            onSubmit={handlePasswordSubmit(onPasswordChange)}
            className="space-y-4"
          >
            <PasswordField
              data-testid="current-password-input"
              label={t('account.password.current')}
              name="currentPassword"
              value={watchPassword('currentPassword')}
              onChange={(value) =>
                registerPassword('currentPassword').onChange({ target: { value } })
              }
              error={passwordErrors.currentPassword?.message}
              placeholder={t('account.password.currentPlaceholder')}
              required
              autoComplete="current-password"
            />

            <PasswordField
              data-testid="new-password-input"
              label={t('account.password.new')}
              name="newPassword"
              value={watchPassword('newPassword')}
              onChange={(value) => registerPassword('newPassword').onChange({ target: { value } })}
              error={passwordErrors.newPassword?.message}
              placeholder={t('account.password.newPlaceholder')}
              required
              showStrength
              autoComplete="new-password"
            />

            <PasswordField
              data-testid="confirm-password-input"
              label={t('account.password.confirm')}
              name="confirmPassword"
              value={watchPassword('confirmPassword')}
              onChange={(value) =>
                registerPassword('confirmPassword').onChange({ target: { value } })
              }
              error={passwordErrors.confirmPassword?.message}
              placeholder={t('account.password.confirmPlaceholder')}
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
                {t('account.password.cancel')}
              </Button>
              <SubmitButton
                data-testid="password-change-submit"
                loading={isPasswordSubmitting}
                loadingText={t('account.password.updating')}
              >
                {t('account.password.update')}
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
