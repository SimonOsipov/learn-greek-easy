import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Key, AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { PasswordField } from '@/components/forms/PasswordField';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog';
import { ResetProgressDialog } from '@/components/settings/ResetProgressDialog';
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
  const { updatePassword } = useAuthStore();
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
        <h2 className="text-xl font-bold text-foreground">{t('security.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('security.subtitle')}</p>
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
                data-testid="reset-progress-button"
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
                data-testid="delete-account-button"
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
