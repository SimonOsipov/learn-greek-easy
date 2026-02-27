/**
 * Reset Password Page
 *
 * Handles the password reset flow after user clicks the reset link in their email.
 * Supabase redirects here with a recovery token in the URL hash.
 * The Supabase client auto-detects the token and establishes a recovery session.
 *
 * Flow:
 * 1. User clicks reset link in email → redirected to /reset-password#access_token=...
 * 2. Supabase client detects token, establishes session
 * 3. User enters new password + confirmation
 * 4. Submit calls supabase.auth.updateUser({ password })
 * 5. Success screen with link to dashboard
 *
 * IMPORTANT: This route must be standalone (NOT inside PublicRoute) because
 * Supabase fires SIGNED_IN before PASSWORD_RECOVERY. If inside PublicRoute,
 * the user would be redirected to dashboard before setting their password.
 */

import React, { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { SubmitButton } from '@/components/forms';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import log from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { mapSupabaseResetError } from '@/utils/auth-errors';

/** Form state machine states */
type FormState = 'form' | 'success';

/**
 * Password validation schema
 */
const resetPasswordSchema = z
  .object({
    password: z.string().min(1, 'passwordRequired').min(8, 'passwordMinLength'),
    confirmPassword: z.string().min(1, 'confirmPasswordRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordsMismatch',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const ResetPassword: React.FC = () => {
  const { t } = useTranslation('auth');

  // Form state machine
  const [formState, setFormState] = useState<FormState>('form');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // React Hook Form
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const passwordValue = watch('password');

  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setUserEmail(data.user.email);
      }
    });
  }, []);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: ResetPasswordFormData) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        log.error('[ResetPassword] Update password error:', error);
        throw error;
      }

      log.info('[ResetPassword] Password updated successfully');
      setFormState('success');
    } catch (err) {
      const error = err instanceof Error ? err : { message: String(err) };
      setFormError(t(`resetPassword.errors.${mapSupabaseResetError(error.message)}`));
      log.error('[ResetPassword] Password reset failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to translate Zod error messages
  const getErrorMessage = (errorKey: string | undefined): string | undefined => {
    if (!errorKey) return undefined;
    return t(`resetPassword.errors.${errorKey}`);
  };

  const isFormDisabled = isSubmitting;

  // Success screen
  if (formState === 'success') {
    return (
      <AuthLayout>
        <Card className="shadow-xl" data-testid="reset-password-success-card">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="success-title">
              {t('resetPassword.successTitle')}
            </CardTitle>
            <CardDescription className="text-base">
              {t('resetPassword.successDescription')}
            </CardDescription>
          </CardHeader>

          <CardFooter className="flex flex-col space-y-4">
            <Button asChild className="w-full" variant="default">
              <Link to="/dashboard" data-testid="go-to-dashboard">
                {t('resetPassword.goToDashboard')}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </AuthLayout>
    );
  }

  // Password reset form
  return (
    <AuthLayout>
      <Card className="shadow-xl" data-testid="reset-password-card">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold" data-testid="reset-password-title">
            {t('resetPassword.title')}
          </CardTitle>
          <CardDescription data-testid="reset-password-description">
            {t('resetPassword.description')}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} data-testid="reset-password-form">
          <CardContent className="space-y-4">
            {/* Form-level error display */}
            {formError && (
              <Alert variant="destructive" data-testid="form-error">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {/* Hidden username field for password managers */}
            <input
              type="email"
              value={userEmail}
              autoComplete="username"
              aria-hidden="true"
              tabIndex={-1}
              className="sr-only"
              readOnly
              data-testid="hidden-email-input"
            />

            {/* New Password field */}
            <div className="space-y-2">
              <Label htmlFor="password">{t('resetPassword.newPassword')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('resetPassword.newPasswordPlaceholder')}
                  autoComplete="new-password"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  disabled={isFormDisabled}
                  {...register('password')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isFormDisabled}
                  aria-label={
                    showPassword ? t('passwordVisibility.hide') : t('passwordVisibility.show')
                  }
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-destructive" role="alert">
                  {getErrorMessage(errors.password.message)}
                </p>
              )}
              <PasswordStrengthIndicator password={passwordValue} className="mt-1" />
            </div>

            {/* Confirm Password field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('resetPassword.confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  data-testid="confirm-password-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                  aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                  aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                  disabled={isFormDisabled}
                  {...register('confirmPassword')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isFormDisabled}
                  aria-label={
                    showConfirmPassword
                      ? t('passwordVisibility.hide')
                      : t('passwordVisibility.show')
                  }
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {errors.confirmPassword && (
                <p
                  id="confirmPassword-error"
                  className="mt-1 text-sm text-destructive"
                  role="alert"
                >
                  {getErrorMessage(errors.confirmPassword.message)}
                </p>
              )}
            </div>

            <SubmitButton
              data-testid="reset-password-submit"
              loading={isSubmitting}
              loadingText={t('resetPassword.submitting')}
              className="w-full"
              size="lg"
            >
              {t('resetPassword.submit')}
            </SubmitButton>

            <div className="pt-2">
              <Button asChild variant="outline" className="w-full">
                <Link to="/login" data-testid="back-to-login-button">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('resetPassword.backToLogin')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </AuthLayout>
  );
};
