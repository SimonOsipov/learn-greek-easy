import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
            <div className="relative my-6 flex items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="px-4 text-sm text-gray-500">OR CONTINUE WITH</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <GoogleSignInButton
              disabled={isFormDisabled}
              onSuccess={() => {
                const from = location.state?.from || '/dashboard';
                navigate(from, { replace: true });
              }}
              onError={(error) => setFormError(error)}
            />

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
