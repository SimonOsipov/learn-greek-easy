/**
 * Auth0 Login Form Component
 *
 * Embedded login form using Auth0's authentication API.
 * Users stay on our page - no redirects during email/password login.
 *
 * Features:
 * - Email/password login
 * - Password visibility toggle
 * - Remember me checkbox (UI only - Auth0 SDK handles token persistence)
 * - Forgot Password link
 * - Google login button (redirect-based)
 * - Loading states
 * - Error handling with Auth0 error mapping
 */

import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';

import { AuthLayout } from '@/components/auth/AuthLayout';
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
import { loginWithAuth0, loginWithGoogle } from '@/lib/auth0WebAuth';
import log from '@/lib/logger';

/**
 * Login form validation schema
 * Matches basic validation requirements for login
 */
const loginSchema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
  password: z.string().min(1, 'passwordRequired').min(8, 'passwordMinLength'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Auth0LoginForm: React.FC = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();

  // Form state
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  // Watch rememberMe value for checkbox
  const rememberMeValue = watch('rememberMe');

  /**
   * Handle form submission
   */
  const onSubmit = async (data: LoginFormData) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      await loginWithAuth0(data.email, data.password);
      // On success, redirect to returnTo from location.state or /dashboard
      const from = (location.state as { from?: string })?.from || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      const errorKey = err instanceof Error ? err.message : 'auth0Error';
      // Map error key to translated message
      const translatedError = t(`login.auth0.errors.${errorKey}`, {
        defaultValue: t('login.auth0.errors.auth0Error'),
      });
      setFormError(translatedError);
      log.error('[Auth0LoginForm] Login failed:', errorKey);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle Google login
   */
  const handleGoogleLogin = () => {
    const returnTo = (location.state as { from?: string })?.from || '/dashboard';
    loginWithGoogle(returnTo);
  };

  // Helper to translate Zod error messages
  const getErrorMessage = (errorKey: string | undefined): string | undefined => {
    if (!errorKey) return undefined;
    return t(`login.errors.${errorKey}`);
  };

  const isFormDisabled = isSubmitting;

  return (
    <AuthLayout>
      <Card className="shadow-xl" data-testid="login-card">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4">
            <span className="text-4xl">🏛️</span>
          </div>
          <CardTitle className="text-2xl font-bold" data-testid="login-title">
            {t('login.title')}
          </CardTitle>
          <CardDescription data-testid="login-description">
            {t('login.subtitle')}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} data-testid="login-form">
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
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                data-testid="email-input"
                type="email"
                placeholder={t('login.emailPlaceholder')}
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
              <Label htmlFor="password">{t('login.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('login.passwordPlaceholder')}
                  autoComplete="current-password"
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
            </div>

            {/* Remember me checkbox and forgot password link */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMeValue}
                  onCheckedChange={(checked) => {
                    setValue('rememberMe', checked === true, { shouldValidate: false });
                  }}
                  disabled={isFormDisabled}
                />
                <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
                  {t('login.rememberMe')}
                </Label>
              </div>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                {t('login.forgotPassword')}
              </Link>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <SubmitButton
              data-testid="login-submit"
              loading={isSubmitting}
              loadingText={t('login.submitting')}
              className="w-full bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white hover:opacity-90"
              size="lg"
            >
              {t('login.submit')}
            </SubmitButton>

            {/* OAuth Divider */}
            <div className="relative my-6 flex items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="px-4 text-sm text-gray-500">{t('login.orContinueWith')}</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            {/* Google Sign In Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isFormDisabled}
              data-testid="google-login-button"
            >
              <GoogleIcon />
              {t('login.auth0.signInWithGoogle')}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t('login.noAccount')}{' '}
              <Link
                to="/register"
                data-testid="register-link"
                className="font-medium text-primary hover:underline"
              >
                {t('login.signUp')}
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

export default Auth0LoginForm;
