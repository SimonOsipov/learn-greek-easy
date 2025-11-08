# Form Components Reference

Reusable form components and hooks for form management.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Form Components (3)

Reusable form components that provide consistent form patterns across the application. These components are designed for simple controlled component patterns and provide consistent styling, validation display, and accessibility features.

### FormField

**Purpose**: Reusable form field component that combines label, input, and error display with consistent styling and accessibility.

**File**: `/src/components/forms/FormField.tsx`

**Interface**:
```typescript
interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'url';
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'url' | 'search';
  className?: string;
  helperText?: string;
}
```

**Usage**:
```tsx
import { FormField } from '@/components/forms';

<FormField
  label="Email address"
  name="email"
  type="email"
  value={email}
  onChange={setEmail}
  error={errors.email}
  placeholder="name@example.com"
  required
  autoComplete="email"
  inputMode="email"
  helperText="We'll never share your email"
/>
```

**Key Features**:
- Integrated label with required indicator (*)
- Error state styling (red border on input)
- Error display with AlertCircle icon
- Helper text support
- Full accessibility with ARIA attributes
- Mobile-optimized (text-base prevents iOS zoom)
- Consistent spacing (space-y-2)

---

### PasswordField

**Purpose**: Specialized password input field with show/hide toggle and optional strength indicator.

**File**: `/src/components/forms/PasswordField.tsx`

**Interface**:
```typescript
interface PasswordFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  showStrength?: boolean;
  className?: string;
}
```

**Usage**:
```tsx
import { PasswordField } from '@/components/forms';

// Login page - basic password field
<PasswordField
  label="Password"
  name="password"
  value={password}
  onChange={setPassword}
  error={errors.password}
  required
  autoComplete="current-password"
/>

// Register page - with strength indicator
<PasswordField
  label="Create Password"
  name="password"
  value={password}
  onChange={setPassword}
  error={errors.password}
  required
  showStrength
  autoComplete="new-password"
/>
```

**Key Features**:
- Password visibility toggle with Eye/EyeOff icons
- Optional password strength indicator (weak/medium/strong)
- Strength calculation based on:
  - Length (< 8 = weak)
  - Character types (uppercase, lowercase, numbers, special characters)
  - Visual progress bar with color coding (red/yellow/green)
- Integrated label and error display
- Full accessibility with ARIA attributes
- Mobile-optimized

**Password Strength Levels**:
- **Weak (Red)**: < 8 characters OR < 2 character types
- **Medium (Yellow)**: 2-3 character types
- **Strong (Green)**: 3+ character types (upper, lower, number, special)

---

### SubmitButton

**Purpose**: Specialized submit button with built-in loading state management for consistent form submission UX.

**File**: `/src/components/forms/SubmitButton.tsx`

**Interface**:
```typescript
interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}
```

**Usage**:
```tsx
import { SubmitButton } from '@/components/forms';

// Login form
<SubmitButton
  loading={isSubmitting}
  loadingText="Signing in..."
  className="w-full bg-gradient-to-br from-[#667eea] to-[#764ba2]"
  size="lg"
>
  Sign In
</SubmitButton>

// Register form
<SubmitButton
  loading={isLoading}
  loadingText="Creating Account..."
  className="w-full"
>
  Create Account
</SubmitButton>
```

**Key Features**:
- Automatic loading state with Loader2 spinner
- Disabled state during submission
- Customizable loading text
- Full width on mobile, auto on desktop (w-full md:w-auto)
- Inherits all Button props except 'type' (always 'submit')
- Consistent loading indicator position (left side with mr-2)

**Default Behavior**:
- Type: Always 'submit' (cannot be changed)
- Default loading text: "Processing..."
- Disabled when: `loading || disabled`
- Loading indicator: Loader2 with spin animation

---

### useForm Hook

**Purpose**: Custom form state management hook with built-in validation. Provides a simple alternative to react-hook-form for basic forms.

**File**: `/src/hooks/useForm.ts`

**Interface**:
```typescript
interface ValidationRules<T> {
  [K in keyof T]?: {
    required?: boolean | string;
    minLength?: { value: number; message: string };
    maxLength?: { value: number; message: string };
    pattern?: { value: RegExp; message: string };
    validate?: (value: T[K]) => string | undefined;
  };
}

interface UseFormProps<T> {
  initialValues: T;
  validationRules?: ValidationRules<T>;
  onSubmit: (values: T) => void | Promise<void>;
}

interface UseFormReturn<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  handleChange: (name: keyof T, value: any) => void;
  handleBlur: (name: keyof T) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  reset: () => void;
  setError: (name: keyof T, message: string) => void;
}
```

**Usage**:
```tsx
import { useForm } from '@/hooks/useForm';
import { FormField, PasswordField, SubmitButton } from '@/components/forms';

function LoginForm() {
  const {
    values,
    errors,
    handleChange,
    handleBlur,
    handleSubmit,
    isSubmitting
  } = useForm({
    initialValues: {
      email: '',
      password: '',
      remember: false
    },
    validationRules: {
      email: {
        required: 'Email is required',
        pattern: {
          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          message: 'Invalid email format'
        }
      },
      password: {
        required: 'Password is required',
        minLength: {
          value: 8,
          message: 'Password must be at least 8 characters'
        }
      }
    },
    onSubmit: async (values) => {
      await authStore.login(values.email, values.password, values.remember);
      navigate('/dashboard');
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        label="Email"
        name="email"
        type="email"
        value={values.email}
        onChange={(value) => handleChange('email', value)}
        onBlur={() => handleBlur('email')}
        error={errors.email}
        required
      />

      <PasswordField
        label="Password"
        name="password"
        value={values.password}
        onChange={(value) => handleChange('password', value)}
        onBlur={() => handleBlur('password')}
        error={errors.password}
        required
      />

      <SubmitButton loading={isSubmitting} loadingText="Signing in...">
        Sign in
      </SubmitButton>
    </form>
  );
}
```

**Key Features**:
- Form state management (values, errors, touched)
- Field-level validation on blur
- Form-level validation on submit
- Async submission handling
- Form reset functionality
- Built-in validation rules:
  - Required fields
  - Min/max length
  - Regex pattern matching
  - Custom validation functions
- Automatic error clearing on input change
- Loading state management

**Validation Rules**:
- **required**: Boolean or custom error message
- **minLength**: Minimum string length with custom message
- **maxLength**: Maximum string length with custom message
- **pattern**: Regex pattern with custom message
- **validate**: Custom validation function returning error message or undefined

**Best Practices**:
- Use for simple forms with basic validation
- For complex forms with nested fields or advanced validation, consider using react-hook-form instead
- Auth pages (Login, Register) already use react-hook-form with Zod validation - no need to replace
- Ideal for: Contact forms, search filters, simple settings forms

---

