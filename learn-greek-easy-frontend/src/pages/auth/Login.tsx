import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { useAuthStore } from '@/stores/authStore';

/**
 * Login form validation schema
 * - Email: Required, valid email format
 * - Password: Required, minimum 8 characters (basic check for login)
 * - RememberMe: Optional boolean
 */
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    mode: 'onSubmit', // Validate on submit, then revalidate on change
    reValidateMode: 'onChange',
  });

  // Watch rememberMe value for checkbox
  const rememberMeValue = watch('rememberMe');

  /**
   * Handle form submission with validation
   * - Clears previous errors
   * - Calls auth store login
   * - Handles success (navigate to dashboard or return URL)
   * - Handles errors (display at form level)
   */
  const onSubmit = async (data: LoginFormData) => {
    setFormError(null);

    try {
      await login(data.email, data.password, data.rememberMe);

      // Check if there's a saved location to return to
      const from = location.state?.from || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      // Display API error at form level
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Login failed. Please check your credentials and try again.';
      setFormError(errorMessage);
    }
  };

  // Determine if form should be disabled
  const isFormDisabled = isLoading || isSubmitting;

  return (
    <AuthLayout>
      <Card className="shadow-xl" data-testid="login-card">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4">
            <span className="text-4xl">🏛️</span>
          </div>
          <CardTitle className="text-2xl font-bold" data-testid="login-title">
            Καλώς ήρθατε!
          </CardTitle>
          <CardDescription data-testid="login-description">
            Welcome back, sign in to continue learning Greek
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} data-testid="login-form">
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

            {/* Email field with validation */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="email-input"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
                disabled={isFormDisabled}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password field with validation and visibility toggle */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
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
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.password.message}
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
                    // Manually update the form value
                    register('rememberMe').onChange({
                      target: { value: checked, name: 'rememberMe' },
                    });
                  }}
                  disabled={isFormDisabled}
                  {...register('rememberMe')}
                />
                <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
                  Remember me
                </Label>
              </div>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <SubmitButton
              data-testid="login-submit"
              loading={isFormDisabled}
              loadingText="Signing in..."
              className="w-full bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white hover:opacity-90"
              size="lg"
            >
              Sign In
            </SubmitButton>

            {/* OAuth Divider */}
            <div className="relative flex items-center my-6">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="px-4 text-sm text-gray-500">OR CONTINUE WITH</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <Button type="button" variant="outline" className="w-full" disabled>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
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
              Google (Coming Soon)
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link
                to="/register"
                data-testid="register-link"
                className="font-medium text-primary hover:underline"
              >
                Sign up for free
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
};
