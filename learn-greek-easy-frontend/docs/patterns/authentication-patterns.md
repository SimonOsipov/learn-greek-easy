# Authentication Patterns

Authentication UI patterns for login, registration, and password management.

[← Back to Main Style Guide](../Style-Guide.md)

---

## Authentication UI Patterns

### Form Layout Pattern

All authentication forms (Login, Register, ForgotPassword) follow a consistent vertical layout with centered alignment.

**Structure**:
```tsx
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

<AuthLayout>
  <Card className="shadow-xl">
    <CardHeader className="space-y-1 text-center">
      <div className="mb-4">
        <span className="text-4xl">🏛️</span>
      </div>
      <CardTitle className="text-2xl font-bold">{t('auth:login.title')}</CardTitle>
      <CardDescription>Welcome back! Sign in to continue learning Greek</CardDescription>
    </CardHeader>

    <CardContent className="space-y-4">
      {/* Form fields */}
    </CardContent>

    <CardFooter className="flex flex-col space-y-4">
      {/* Action buttons */}
    </CardFooter>
  </Card>
</AuthLayout>
```

**Key Principles**:
- Centered card with max-width of 28rem (448px)
- Consistent vertical spacing (space-y-4, space-y-8)
- Light background for contrast
- Logo/brand at top for context
- Footer links for navigation between auth pages

---

### Input Field Pattern

Authentication forms use consistent input styling with labels, error states, and validation.

**Basic Input Field**:
```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="your@email.com"
    autoComplete="email"
    aria-invalid={errors.email ? 'true' : 'false'}
    aria-describedby={errors.email ? 'email-error' : undefined}
    {...register('email')}
  />
  {errors.email && (
    <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
      {errors.email.message}
    </p>
  )}
</div>
```

**Password Input with Visibility Toggle**:
```tsx
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

const [showPassword, setShowPassword] = useState(false);

<div className="space-y-2">
  <Label htmlFor="password">Password</Label>
  <div className="relative">
    <Input
      id="password"
      type={showPassword ? 'text' : 'password'}
      placeholder="Enter your password"
      autoComplete="current-password"
      {...register('password')}
    />
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </Button>
  </div>
</div>
```

**Input Field States**:
- **Default**: Border gray-300, focus ring primary
- **Error**: Red border, red text error message below
- **Disabled**: Opacity 50%, cursor not-allowed

---

### Error Handling Pattern

Display validation errors inline below inputs and general errors at form level.

**Inline Field Errors**:
```tsx
<Input
  id="email"
  type="email"
  aria-invalid={errors.email ? 'true' : 'false'}
  aria-describedby={errors.email ? 'email-error' : undefined}
/>
{errors.email && (
  <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
    {errors.email.message}
  </p>
)}
```

**Form-Level Error** (API errors, network issues):
```tsx
{formError && (
  <div
    className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600"
    role="alert"
  >
    {formError}
  </div>
)}
```

---

### Submit Button Pattern

Submit buttons show loading state and are disabled during submission.

**Pattern** (from Login.tsx):
```tsx
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

<Button
  type="submit"
  className="w-full bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white hover:opacity-90"
  size="lg"
  disabled={isFormDisabled}
>
  {isFormDisabled ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Signing in...
    </>
  ) : (
    'Sign In'
  )}
</Button>
```

**States**:
- **Default**: Full width, primary gradient variant, large size
- **Loading**: Spinner icon, disabled, "Processing..." text
- **Disabled**: Opacity 50%, cursor not-allowed

---

### Validation Pattern

Client-side validation using React Hook Form and Zod schema.

**Validation Schema**:
```tsx
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;
```

**Form Setup with Validation**:
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
} = useForm<LoginFormData>({
  resolver: zodResolver(loginSchema),
  mode: 'onSubmit', // Validate on submit
  reValidateMode: 'onChange', // Revalidate on change after first submit
});
```

---

### When to Use

- **Login Page**: Email + password, remember me, forgot password link
- **Registration Page**: Email + password + name, password strength indicator, terms acceptance
- **Forgot Password Page**: Email only, success message with next steps

### Accessibility Considerations

- All inputs have associated labels (htmlFor + id)
- Error messages linked with aria-describedby
- Invalid inputs marked with aria-invalid
- Submit button disabled during loading (prevents double-submit)
- Focus management: Focus first input on mount
- Keyboard navigation: Tab through inputs, Enter to submit

### Related Components

- Login page: `/src/pages/auth/Login.tsx`
- Input: `@/components/ui/input`
- Button: `@/components/ui/button`
- Label: `@/components/ui/label`

---
