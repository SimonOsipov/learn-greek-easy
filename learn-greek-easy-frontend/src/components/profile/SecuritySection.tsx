import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  Shield,
  Lock,
  Key,
  AlertTriangle,
  Smartphone,
  RotateCcw,
  Trash2,
  Crown,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { PasswordField } from '@/components/forms/PasswordField';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog';
import { ResetProgressDialog } from '@/components/settings/ResetProgressDialog';
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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';

import type { TFunction } from 'i18next';

// Factory function to create schema with translations
const createPasswordSchema = (t: TFunction) =>
  z
    .object({
      currentPassword: z
        .string()
        .min(1, t('security.validation.currentPasswordRequired'))
        .min(8, t('security.validation.passwordMinLength')),
      newPassword: z
        .string()
        .min(1, t('security.validation.currentPasswordRequired'))
        .min(8, t('security.validation.passwordMinLength'))
        .regex(/[A-Z]/, t('security.validation.passwordUppercase'))
        .regex(/[a-z]/, t('security.validation.passwordLowercase'))
        .regex(/[0-9]/, t('security.validation.passwordNumber')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('security.validation.passwordsDoNotMatch'),
      path: ['confirmPassword'],
    });

type PasswordFormData = z.infer<ReturnType<typeof createPasswordSchema>>;

export const SecuritySection: React.FC = () => {
  const { t } = useTranslation('profile');
  const { toast } = useToast();
  const { user, updatePassword } = useAuthStore();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const passwordSchema = createPasswordSchema(t);

  const {
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
    reset: resetPasswordForm,
    watch: watchPassword,
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onPasswordChange = async (data: PasswordFormData) => {
    try {
      await updatePassword(data.currentPassword, data.newPassword);

      toast({
        title: t('security.changePassword.success'),
        description: t('security.changePassword.successDescription'),
      });

      setPasswordDialogOpen(false);
      resetPasswordForm();
    } catch (error) {
      toast({
        title: t('security.changePassword.error'),
        description:
          error instanceof Error ? error.message : t('security.changePassword.errorDescription'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-6" data-testid="security-section">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {t('security.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('security.subtitle')}</p>
      </div>

      <Separator className="mb-6" />

      <div className="space-y-6">
        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-5 w-5 text-blue-600" />
              {t('security.changePassword.title')}
            </CardTitle>
            <CardDescription>{t('security.changePassword.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                {t('security.changePassword.description')}
              </p>
              <Button
                data-testid="change-password-button"
                variant="outline"
                size="sm"
                onClick={() => setPasswordDialogOpen(true)}
              >
                {t('security.changePassword.update')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Section */}
        {user && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Crown className="h-5 w-5 text-amber-500" />
                {t('security.subscription.title')}
              </CardTitle>
              <CardDescription>{t('security.subscription.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('security.subscription.currentPlan')}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      {user.role === 'premium' ? (
                        <Badge className="border-0 bg-gradient-to-r from-purple-500 to-purple-700 text-white">
                          {t('security.subscription.premium')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t('security.subscription.free')}</Badge>
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
                          title: t('security.subscription.upgradeTitle'),
                          description: t('security.subscription.upgradeDescription'),
                        });
                      }}
                    >
                      {t('security.subscription.upgrade')}
                    </Button>
                  )}
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm text-muted-foreground">
                    {t('security.subscription.memberSince', {
                      date: format(new Date(user.createdAt), 'MMMM yyyy'),
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Two-Factor Authentication (Coming Soon) */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5 text-green-600" />
              {t('security.twoFactor.title')}
              <span className="ml-auto rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {t('security.twoFactor.comingSoon')}
              </span>
            </CardTitle>
            <CardDescription>{t('security.twoFactor.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-gray-200 p-4 opacity-50 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                  <Shield className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {t('security.twoFactor.enable2FA')}
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {t('security.twoFactor.enable2FADescription')}
                  </p>
                </div>
                <Button disabled variant="outline" size="sm">
                  {t('security.twoFactor.enable')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-5 w-5 text-purple-600" />
              {t('security.sessions.title')}
            </CardTitle>
            <CardDescription>{t('security.sessions.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {t('security.sessions.currentDevice')}
                    </p>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                      {t('security.sessions.activeNow')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {navigator.userAgent.includes('Mac') ? 'macOS' : 'Unknown'} •{' '}
                    {navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Unknown Browser'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    {t('security.sessions.lastActive')} {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('security.sessions.comingSoonDescription')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-600">{t('security.dangerZone.title')}</CardTitle>
            </div>
            <CardDescription>{t('security.dangerZone.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reset Progress */}
            <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-red-600" />
                  <h3 className="font-medium text-red-900 dark:text-red-100">
                    {t('security.dangerZone.resetProgress.title')}
                  </h3>
                </div>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {t('security.dangerZone.resetProgress.description')}
                </p>
              </div>
              <Button
                variant="outline"
                className="ml-4 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900"
                onClick={() => setShowResetDialog(true)}
              >
                {t('security.dangerZone.resetProgress.button')}
              </Button>
            </div>

            {/* Delete Account */}
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <h3 className="font-medium text-red-900 dark:text-red-100">
                    {t('security.dangerZone.deleteAccount.title')}
                  </h3>
                </div>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {t('security.dangerZone.deleteAccount.description')}
                </p>
              </div>
              <Button
                variant="destructive"
                className="ml-4"
                onClick={() => setShowDeleteDialog(true)}
              >
                {t('security.dangerZone.deleteAccount.button')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent data-testid="password-dialog">
          <DialogHeader>
            <DialogTitle data-testid="password-change-title">
              {t('security.changePassword.dialogTitle')}
            </DialogTitle>
            <DialogDescription>{t('security.changePassword.dialogDescription')}</DialogDescription>
          </DialogHeader>

          <form
            data-testid="password-change-form"
            onSubmit={handlePasswordSubmit(onPasswordChange)}
            className="space-y-4"
          >
            <PasswordField
              data-testid="current-password-input"
              label={t('security.changePassword.currentPassword')}
              name="currentPassword"
              value={watchPassword('currentPassword')}
              onChange={(value) =>
                registerPassword('currentPassword').onChange({ target: { value } })
              }
              error={passwordErrors.currentPassword?.message}
              placeholder={t('security.changePassword.currentPasswordPlaceholder')}
              required
              autoComplete="current-password"
            />

            <PasswordField
              data-testid="new-password-input"
              label={t('security.changePassword.newPassword')}
              name="newPassword"
              value={watchPassword('newPassword')}
              onChange={(value) => registerPassword('newPassword').onChange({ target: { value } })}
              error={passwordErrors.newPassword?.message}
              placeholder={t('security.changePassword.newPasswordPlaceholder')}
              required
              showStrength
              autoComplete="new-password"
            />

            <PasswordField
              data-testid="confirm-password-input"
              label={t('security.changePassword.confirmPassword')}
              name="confirmPassword"
              value={watchPassword('confirmPassword')}
              onChange={(value) =>
                registerPassword('confirmPassword').onChange({ target: { value } })
              }
              error={passwordErrors.confirmPassword?.message}
              placeholder={t('security.changePassword.confirmPasswordPlaceholder')}
              required
              autoComplete="new-password"
            />

            {/* Password Requirements */}
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
              <p className="mb-2 text-sm font-medium text-blue-900 dark:text-blue-100">
                {t('security.changePassword.requirements')}
              </p>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>• {t('security.changePassword.requirementLength')}</li>
                <li>• {t('security.changePassword.requirementCase')}</li>
                <li>• {t('security.changePassword.requirementNumber')}</li>
              </ul>
            </div>

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
                {t('security.changePassword.cancel')}
              </Button>
              <SubmitButton
                data-testid="password-change-submit"
                loading={isPasswordSubmitting}
                loadingText={t('security.changePassword.updating')}
              >
                {t('security.changePassword.update')}
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ResetProgressDialog open={showResetDialog} onOpenChange={setShowResetDialog} />
      <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
    </div>
  );
};
