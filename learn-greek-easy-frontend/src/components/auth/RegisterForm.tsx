/**
 * Registration Form Component
 *
 * Embedded registration form using Supabase authentication.
 * Users stay on our page - no redirects during signup.
 *
 * State Machine:
 * - 'form': Show registration form
 * - 'verification': Show "check your email" screen
 * - 'error': Show error with retry option
 *
 * Features:
 * - Email/password registration
 * - Password strength indicator
 * - Terms of service checkbox
 * - Google signup button
 * - Resend verification email
 * - Loading states
 * - Error handling
 */

import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import posthog from 'posthog-js';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { SubmitButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import log from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { authAPI } from '@/services/authAPI';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/auth';

/** Form state machine states */
type FormState = 'form' | 'verification' | 'error';

/**
 * Registration form validation schema
 * Password validation requirements
 */
const registerSchema = z
  .object({
    name: z.string().min(1, 'nameRequired').min(2, 'nameMinLength').max(50, 'nameMaxLength'),
    email: z.string().min(1, 'emailRequired').email('emailInvalid'),
    password: z.string().min(1, 'passwordRequired').min(8, 'passwordMinLength'),
    confirmPassword: z.string().min(1, 'confirmPasswordRequired'),
    acceptedTerms: z.boolean().refine((val) => val === true, {
      message: 'termsRequired',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordsMismatch',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Map Supabase signup error to user-friendly translated message
 */
const mapSupabaseSignupError = (error: { message: string }, t: (key: string) => string): string => {
  const msg = error.message.toLowerCase();
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return t('register.errors.emailExists');
  }
  if (msg.includes('password')) {
    return t('register.errors.invalidPassword');
  }
  return error.message;
};

export const RegisterForm: React.FC = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();

  // Form state machine
  const [formState, setFormState] = useState<FormState>('form');
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  // Watch values for UI feedback
  const passwordValue = watch('password');
  const acceptedTermsValue = watch('acceptedTerms');

  /**
   * Handle form submission
   */
  const onSubmit = async (data: RegisterFormData) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      log.info('[RegisterForm] Attempting Supabase signup');
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.name },
          emailRedirectTo: `${window.location.origin}/callback`,
        },
      });

      if (error) {
        log.error('[RegisterForm] Supabase signup error:', error);
        throw error;
      }

      setRegisteredEmail(data.email);

      // If auto-confirm is off, show verification screen
      if (authData.user && !authData.session) {
        log.info('[RegisterForm] Email confirmation required');
        setFormState('verification');
        return;
      }

      // If auto-confirm is on (dev), user is logged in immediately
      if (authData.session) {
        log.info('[RegisterForm] Auto-confirmed, fetching profile');
        // Fetch profile and set in store
        const profileResponse = await authAPI.getProfile();
        const user: User = {
          id: profileResponse.id,
          email: profileResponse.email,
          name: profileResponse.full_name || profileResponse.email.split('@')[0],
          avatar: profileResponse.avatar_url || undefined,
          role: profileResponse.effective_role ?? (profileResponse.is_superuser ? 'admin' : 'free'),
          preferences: {
            language: 'en',
            dailyGoal: profileResponse.settings?.daily_goal || 20,
            notifications: profileResponse.settings?.email_notifications ?? true,
            theme: profileResponse.settings?.theme || 'light',
          },
          stats: {
            streak: 0,
            wordsLearned: 0,
            totalXP: 0,
            joinedDate: new Date(profileResponse.created_at),
          },
          createdAt: new Date(profileResponse.created_at),
          updatedAt: new Date(profileResponse.updated_at),
          authProvider: profileResponse.auth_provider ?? undefined,
        };

        // Track with PostHog
        if (typeof posthog?.identify === 'function') {
          posthog.identify(user.id, {
            email: user.email,
            created_at: user.createdAt.toISOString(),
          });
        }
        if (typeof posthog?.capture === 'function') {
          posthog.capture('user_signed_up', {
            method: 'email',
          });
        }

        useAuthStore.setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        log.info('[RegisterForm] Successfully registered and logged in');
        navigate('/dashboard');
        return;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? mapSupabaseSignupError(err, t)
          : t('register.errors.registrationFailed');
      setFormError(errorMessage);
      log.error('[RegisterForm] Registration failed:', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle resend verification email
   */
  const handleResendEmail = async () => {
    setIsResending(true);
    setResendSuccess(false);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: registeredEmail,
      });

      if (error) {
        log.error('[RegisterForm] Resend failed:', error);
        throw error;
      }

      setResendSuccess(true);
      // Reset success message after 5 seconds
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      log.error('[RegisterForm] Resend error:', err);
      // Don't show error - just silently fail and let user retry
    } finally {
      setIsResending(false);
    }
  };

  /**
   * Handle Google signup
   */
  const handleGoogleSignup = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/callback`,
        },
      });

      if (error) {
        log.error('[RegisterForm] Google OAuth error:', error);
        setFormError(t('register.errors.registrationFailed'));
      }
    } catch (err) {
      log.error('[RegisterForm] Google signup error:', err);
      setFormError(t('register.errors.registrationFailed'));
    }
  };

  /**
   * Reset form to initial state
   */
  const handleStartOver = () => {
    setFormState('form');
    setRegisteredEmail('');
    setFormError(null);
  };

  // Helper to translate Zod error messages
  const getErrorMessage = (errorKey: string | undefined): string | undefined => {
    if (!errorKey) return undefined;
    return t(`register.errors.${errorKey}`);
  };

  const isFormDisabled = isSubmitting;

  // Render verification screen
  if (formState === 'verification') {
    return (
      <AuthLayout>
        <Card className="shadow-xl" data-testid="verification-card">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="verification-title">
              {t('register.checkEmailTitle')}
            </CardTitle>
            <CardDescription className="text-base">
              {t('register.checkEmailDescription')}
            </CardDescription>
            <p className="mt-2 font-medium text-foreground" data-testid="registered-email">
              {registeredEmail}
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">{t('register.checkSpam')}</p>

            {resendSuccess && (
              <div
                className="rounded-md border border-green-200 bg-green-50 p-3 text-center text-sm text-green-600"
                role="status"
                data-testid="resend-success"
              >
                {t('register.resendSuccess')}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={handleResendEmail}
              disabled={isResending}
              data-testid="resend-button"
            >
              {isResending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  {t('register.resendEmail')}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('register.resendEmail')}
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              variant="ghost"
              className="w-full"
              onClick={handleStartOver}
              data-testid="start-over-button"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('register.wrongEmail')}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t('register.hasAccount')}{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                {t('register.signIn')}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </AuthLayout>
    );
  }

  // Render registration form
  return (
    <AuthLayout>
      <Card className="shadow-xl" data-testid="register-card">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4">
            <span className="text-4xl">📚</span>
          </div>
          <CardTitle className="text-2xl font-bold" data-testid="register-title">
            {t('register.title')}
          </CardTitle>
          <CardDescription data-testid="register-description">
            {t('register.subtitle')}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} data-testid="register-form">
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

            {/* Name field */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('register.name')}</Label>
              <Input
                id="name"
                data-testid="name-input"
                type="text"
                placeholder={t('register.namePlaceholder')}
                autoComplete="name"
                aria-invalid={errors.name ? 'true' : 'false'}
                aria-describedby={errors.name ? 'name-error' : undefined}
                disabled={isFormDisabled}
                {...register('name')}
              />
              {errors.name && (
                <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
                  {getErrorMessage(errors.name.message)}
                </p>
              )}
            </div>

            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('register.email')}</Label>
              <Input
                id="email"
                data-testid="email-input"
                type="email"
                placeholder={t('register.emailPlaceholder')}
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

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password">{t('register.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('register.passwordPlaceholder')}
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
                <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                  {getErrorMessage(errors.password.message)}
                </p>
              )}
              <PasswordStrengthIndicator password={passwordValue} />
            </div>

            {/* Confirm Password field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('register.confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  data-testid="confirm-password-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('register.confirmPasswordPlaceholder')}
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
                <p id="confirmPassword-error" className="mt-1 text-sm text-red-600" role="alert">
                  {getErrorMessage(errors.confirmPassword.message)}
                </p>
              )}
            </div>

            {/* Terms checkbox */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={acceptedTermsValue}
                  onCheckedChange={(checked) => {
                    setValue('acceptedTerms', checked === true, { shouldValidate: true });
                  }}
                  disabled={isFormDisabled}
                  aria-invalid={errors.acceptedTerms ? 'true' : 'false'}
                  aria-describedby={errors.acceptedTerms ? 'terms-error' : undefined}
                />
                <Label htmlFor="terms" className="cursor-pointer text-sm font-normal">
                  {t('register.acceptTerms')}{' '}
                  <Link to="/terms" className="text-primary hover:underline">
                    {t('register.termsLink')}
                  </Link>
                </Label>
              </div>
              {errors.acceptedTerms && (
                <p id="terms-error" className="text-sm text-red-600" role="alert">
                  {getErrorMessage(errors.acceptedTerms.message)}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <SubmitButton
              data-testid="register-submit"
              loading={isSubmitting}
              loadingText={t('register.submitting')}
              className="w-full"
              size="lg"
            >
              {t('register.submit')}
            </SubmitButton>

            {/* OAuth Divider */}
            <div className="relative my-6 flex items-center">
              <div className="flex-grow border-t border-border"></div>
              <span className="px-4 text-sm text-muted-foreground">
                {t('register.orContinueWith')}
              </span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            {/* Google Sign Up Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignup}
              disabled={isFormDisabled}
              data-testid="google-signup-button"
            >
              <GoogleIcon />
              {t('register.signUpWithGoogle')}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t('register.hasAccount')}{' '}
              <Link
                to="/login"
                data-testid="login-link"
                className="font-medium text-primary hover:underline"
              >
                {t('register.signIn')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
};

// Google icon component
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export default RegisterForm;
