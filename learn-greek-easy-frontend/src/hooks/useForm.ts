import { useState, useCallback } from 'react';

type ValidationRule<T = any> = {
  required?: boolean | string;
  minLength?: { value: number; message: string };
  maxLength?: { value: number; message: string };
  pattern?: { value: RegExp; message: string };
  validate?: (value: T) => string | undefined;
};

type ValidationRules<T> = {
  [K in keyof T]?: ValidationRule<T[K]>;
};

interface UseFormProps<T> {
  initialValues: T;
  validationRules?: ValidationRules<T>;
  onSubmit: (values: T) => void | Promise<void>;
}

/**
 * useForm Hook
 *
 * A custom form state management hook with built-in validation.
 * Provides a simple alternative to react-hook-form for basic forms.
 *
 * Features:
 * - Form state management (values, errors, touched)
 * - Field-level validation on blur
 * - Form-level validation on submit
 * - Async submission handling
 * - Form reset functionality
 * - Custom validation rules
 *
 * @example
 * ```tsx
 * const { values, errors, handleChange, handleBlur, handleSubmit, isSubmitting } = useForm({
 *   initialValues: { email: '', password: '', remember: false },
 *   validationRules: {
 *     email: {
 *       required: 'Email is required',
 *       pattern: {
 *         value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
 *         message: 'Invalid email format'
 *       }
 *     },
 *     password: {
 *       required: 'Password is required',
 *       minLength: { value: 8, message: 'Password must be at least 8 characters' }
 *     }
 *   },
 *   onSubmit: async (values) => {
 *     await authStore.login(values.email, values.password, values.remember);
 *     navigate('/dashboard');
 *   }
 * });
 * ```
 */
export function useForm<T extends Record<string, any>>({
  initialValues,
  validationRules = {},
  onSubmit,
}: UseFormProps<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback(
    (name: keyof T, value: any): string | undefined => {
      const rules = validationRules[name];
      if (!rules) return undefined;

      // Required validation
      if (rules.required) {
        if (!value || (typeof value === 'string' && !value.trim())) {
          return typeof rules.required === 'string' ? rules.required : `${String(name)} is required`;
        }
      }

      // Min length validation
      if (rules.minLength && typeof value === 'string') {
        if (value.length < rules.minLength.value) {
          return rules.minLength.message;
        }
      }

      // Max length validation
      if (rules.maxLength && typeof value === 'string') {
        if (value.length > rules.maxLength.value) {
          return rules.maxLength.message;
        }
      }

      // Pattern validation
      if (rules.pattern && typeof value === 'string') {
        if (!rules.pattern.value.test(value)) {
          return rules.pattern.message;
        }
      }

      // Custom validation
      if (rules.validate) {
        return rules.validate(value);
      }

      return undefined;
    },
    [validationRules]
  );

  const validateAllFields = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};

    Object.keys(validationRules).forEach((key) => {
      const error = validateField(key as keyof T, values[key]);
      if (error) {
        newErrors[key as keyof T] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values, validateField, validationRules]);

  const handleChange = useCallback((name: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }, []);

  const handleBlur = useCallback(
    (name: keyof T) => {
      setTouched((prev) => ({ ...prev, [name]: true }));

      const error = validateField(name, values[name]);
      if (error) {
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [values, validateField]
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();

      const isValid = validateAllFields();
      if (!isValid) return;

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (error) {
        // Error handling done by caller
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validateAllFields, onSubmit]
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setError: (name: keyof T, message: string) => {
      setErrors((prev) => ({ ...prev, [name]: message }));
    },
  };
}
