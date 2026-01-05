import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
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
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/stores/authStore';

/**
 * Registration form validation schema
 * - Name: Required, min 2 chars, max 50 chars
 * - Email: Required, valid email format
 * - Password: Required, minimum 8 characters
 * - ConfirmPassword: Required, must match password
 * - AcceptedTerms: Must be true
 *
 * Note: Error messages are translated at display time using t() function
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

export const Register: React.FC = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
    },
    mode: 'onSubmit', // Validate on submit, then revalidate on change
    reValidateMode: 'onChange',
  });

  // Watch password for strength indicator
  const passwordValue = watch('password');
  const acceptedTermsValue = watch('acceptedTerms');

  // Simple password strength calculation for UI demo
  const calculatePasswordStrength = (pwd: string): number => {
    if (!pwd) return 0;
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (pwd.length >= 12) strength += 25;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) strength += 25;
    if (/[0-9]/.test(pwd)) strength += 12.5;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 12.5;
    return Math.min(strength, 100);
  };

  const passwordStrength = calculatePasswordStrength(passwordValue);
  const getStrengthText = (): string => {
    if (!passwordValue) return '';
    if (passwordStrength < 33) return t('register.passwordStrength.weak');
    if (passwordStrength < 66) return t('register.passwordStrength.fair');
    return t('register.passwordStrength.strong');
  };

  /**
   * Handle form submission with validation
   * - Clears previous errors
   * - Calls auth store register
   * - Handles success (navigate to dashboard)
   * - Handles errors (display at form level)
   */
  const onSubmit = async (data: RegisterFormData) => {
    setFormError(null);

    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        agreeToTerms: data.acceptedTerms,
        ageConfirmation: true, // We assume users are 18+ if they can access the form
      });
      // Success - navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      // Display API error at form level
      const errorMessage =
        err instanceof Error ? err.message : t('register.errors.registrationFailed');
      setFormError(errorMessage);
    }
  };

  // Determine if form should be disabled
  const isFormDisabled = isLoading || isSubmitting;

  // Helper to translate Zod error messages
  const getErrorMessage = (errorKey: string | undefined): string | undefined => {
    if (!errorKey) return undefined;
    return t(`register.errors.${errorKey}`);
  };

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
            {/* Form-level error display (API errors, network errors) */}
            {formError && (
              <div
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600"
                role="alert"
              >
                {formError}
              </div>
            )}

            {/* Name field with validation */}
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

            {/* Email field with validation */}
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

            {/* Password field with validation and visibility toggle */}
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
              {passwordValue && (
                <div className="space-y-1">
                  <Progress value={passwordStrength} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {t('register.passwordStrength.label')}{' '}
                    <span
                      className={`font-medium ${
                        passwordStrength < 33
                          ? 'text-red-500'
                          : passwordStrength < 66
                            ? 'text-yellow-500'
                            : 'text-green-500'
                      }`}
                    >
                      {getStrengthText()}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password field with validation and visibility toggle */}
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

            {/* Terms acceptance with validation */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={acceptedTermsValue}
                  onCheckedChange={(checked) => {
                    // Manually update the form value
                    register('acceptedTerms').onChange({
                      target: { value: checked, name: 'acceptedTerms' },
                    });
                  }}
                  disabled={isFormDisabled}
                  aria-invalid={errors.acceptedTerms ? 'true' : 'false'}
                  aria-describedby={errors.acceptedTerms ? 'terms-error' : undefined}
                  {...register('acceptedTerms')}
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
              loading={isFormDisabled}
              loadingText={t('register.submitting')}
              className="w-full bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white hover:opacity-90"
              size="lg"
            >
              {t('register.submit')}
            </SubmitButton>

            {/* OAuth Divider */}
            <div className="relative my-6 flex items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="px-4 text-sm text-gray-500">{t('register.orContinueWith')}</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <GoogleSignInButton
              disabled={isFormDisabled}
              onSuccess={() => navigate('/dashboard')}
              onError={(error) => setFormError(error)}
            />

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
