/**
 * Forgot Password Page
 *
 * Uses Supabase password reset flow.
 *
 * Flow:
 * 1. User enters email
 * 2. Submit triggers supabase.auth.resetPasswordForEmail
 * 3. Success screen shows "Check your email" message
 * 4. Supabase returns success even for non-existent emails (security best practice)
 * 5. User clicks link in email → redirected to /reset-password to set new password
 */

import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { SubmitButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import log from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';

/** Form state machine states */
type FormState = 'form' | 'success';

/**
 * Email validation schema
 */
const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Forgot Password Component
 *
 * Features:
 * - Email input with validation
 * - Submit triggers Supabase password reset email
 * - Success state shows confirmation
 * - Error display with retry capability
 * - "Try different email" button on success screen
 */
export const ForgotPassword: React.FC = () => {
  const { t } = useTranslation('auth');

  // Form state machine
  const [formState, setFormState] = useState<FormState>('form');
  const [submittedEmail, setSubmittedEmail] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  /**
   * Handle form submission
   */
  const onSubmit = async (data: ForgotPasswordFormData) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        log.error('[ForgotPassword] Supabase reset error:', error);
        throw error;
      }

      setSubmittedEmail(data.email);
      setFormState('success');
    } catch (err) {
      const translatedError = t('forgotPassword.auth0.errors.sendFailed');
      setFormError(translatedError);
      log.error('[ForgotPassword] Password reset failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle "Try different email" action
   */
  const handleTryDifferentEmail = () => {
    setFormState('form');
    setSubmittedEmail('');
    setFormError(null);
    reset();
  };

  // Helper to translate Zod error messages
  const getErrorMessage = (errorKey: string | undefined): string | undefined => {
    if (!errorKey) return undefined;
    return t(`forgotPassword.auth0.errors.${errorKey}`);
  };

  const isFormDisabled = isSubmitting;

  // Render success screen
  if (formState === 'success') {
    return (
      <AuthLayout>
        <Card className="shadow-xl" data-testid="forgot-password-success-card">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="success-title">
              {t('forgotPassword.auth0.checkEmailTitle')}
            </CardTitle>
            <CardDescription className="text-base">
              {t('forgotPassword.auth0.checkEmailDescription')}
            </CardDescription>
            <p className="mt-2 font-medium text-foreground" data-testid="submitted-email">
              {submittedEmail}
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              {t('forgotPassword.auth0.checkSpam')}
            </p>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleTryDifferentEmail}
              data-testid="try-different-email-button"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('forgotPassword.auth0.tryDifferentEmail')}
            </Button>

            <Button asChild variant="ghost" className="w-full">
              <Link to="/login" data-testid="back-to-login-link">
                {t('forgotPassword.backToLogin')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  // Render email form
  return (
    <AuthLayout>
      <Card className="shadow-xl" data-testid="forgot-password-card">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold" data-testid="forgot-password-title">
            {t('forgotPassword.title')}
          </CardTitle>
          <CardDescription data-testid="forgot-password-description">
            {t('forgotPassword.auth0.description')}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} data-testid="forgot-password-form">
          <CardContent className="space-y-4">
            {/* Form-level error display */}
            {formError && (
              <div
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600"
                role="alert"
                data-testid="form-error"
              >
                {formError}
              </div>
            )}

            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('forgotPassword.auth0.email')}</Label>
              <Input
                id="email"
                data-testid="email-input"
                type="email"
                placeholder={t('forgotPassword.auth0.emailPlaceholder')}
                autoComplete="email"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
                disabled={isFormDisabled}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                  {getErrorMessage(errors.email.message)}
                </p>
              )}
            </div>

            <SubmitButton
              data-testid="forgot-password-submit"
              loading={isSubmitting}
              loadingText={t('forgotPassword.auth0.submitting')}
              className="w-full bg-gradient-to-br from-gradient-from to-gradient-to text-white hover:opacity-90"
              size="lg"
            >
              {t('forgotPassword.auth0.submit')}
            </SubmitButton>

            <div className="pt-2">
              <Button asChild variant="outline" className="w-full">
                <Link to="/login" data-testid="back-to-login-button">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('forgotPassword.backToLogin')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </AuthLayout>
  );
};
