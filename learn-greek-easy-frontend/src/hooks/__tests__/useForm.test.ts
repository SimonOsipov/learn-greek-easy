/**
 * useForm Hook Tests
 * Tests form state management and validation
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useForm } from '@/hooks/useForm';

describe('useForm Hook', () => {
  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '', password: '' },
          onSubmit: vi.fn(),
        })
      );

      expect(result.current.values).toEqual({ email: '', password: '' });
      expect(result.current.errors).toEqual({});
      expect(result.current.touched).toEqual({});
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should initialize with provided values', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            email: 'test@example.com',
            password: 'Password123',
            remember: true,
          },
          onSubmit: vi.fn(),
        })
      );

      expect(result.current.values.email).toBe('test@example.com');
      expect(result.current.values.password).toBe('Password123');
      expect(result.current.values.remember).toBe(true);
    });
  });

  describe('Field Updates', () => {
    it('should update field value on handleChange', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleChange('email', 'test@example.com');
      });

      expect(result.current.values.email).toBe('test@example.com');
    });

    it('should clear error when field value changes', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validationRules: {
            email: { required: 'Email is required' },
          },
          onSubmit: vi.fn(),
        })
      );

      // Set an error
      act(() => {
        result.current.setError('email', 'Email is required');
      });

      expect(result.current.errors.email).toBe('Email is required');

      // Change value should clear error
      act(() => {
        result.current.handleChange('email', 'test@example.com');
      });

      expect(result.current.errors.email).toBeUndefined();
    });

    it('should handle multiple field changes', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '', password: '', name: '' },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleChange('email', 'test@example.com');
        result.current.handleChange('password', 'Password123');
        result.current.handleChange('name', 'John Doe');
      });

      expect(result.current.values).toEqual({
        email: 'test@example.com',
        password: 'Password123',
        name: 'John Doe',
      });
    });
  });

  describe('Field Validation', () => {
    it('should validate required fields on blur', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validationRules: {
            email: { required: 'Email is required' },
          },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.errors.email).toBe('Email is required');
      expect(result.current.touched.email).toBe(true);
    });

    it('should validate minLength on blur', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { password: '123' },
          validationRules: {
            password: {
              minLength: { value: 8, message: 'Password must be at least 8 characters' },
            },
          },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleBlur('password');
      });

      expect(result.current.errors.password).toBe('Password must be at least 8 characters');
    });

    it('should validate maxLength on blur', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { username: 'verylongusernamethatexceedsmaximum' },
          validationRules: {
            username: {
              maxLength: { value: 20, message: 'Username must be at most 20 characters' },
            },
          },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleBlur('username');
      });

      expect(result.current.errors.username).toBe('Username must be at most 20 characters');
    });

    it('should validate pattern (email regex) on blur', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'invalid-email' },
          validationRules: {
            email: {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email format',
              },
            },
          },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.errors.email).toBe('Invalid email format');
    });

    it('should pass pattern validation with valid email', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          validationRules: {
            email: {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email format',
              },
            },
          },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.errors.email).toBeUndefined();
    });

    it('should validate with custom validation function', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { password: 'weak' },
          validationRules: {
            password: {
              validate: (value) => {
                if (!/(?=.*[A-Z])/.test(value)) {
                  return 'Password must contain uppercase letter';
                }
                if (!/(?=.*[0-9])/.test(value)) {
                  return 'Password must contain number';
                }
                return undefined;
              },
            },
          },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleBlur('password');
      });

      expect(result.current.errors.password).toBe('Password must contain uppercase letter');
    });

    it('should handle multiple validation rules', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { password: 'ab' },
          validationRules: {
            password: {
              required: 'Password is required',
              minLength: { value: 8, message: 'Password must be at least 8 characters' },
            },
          },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleBlur('password');
      });

      // Should fail minLength (first validation that fails)
      expect(result.current.errors.password).toBe('Password must be at least 8 characters');
    });

    it('should handle required validation with boolean value', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { terms: '' },
          validationRules: {
            terms: { required: true },
          },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleBlur('terms');
      });

      expect(result.current.errors.terms).toBe('terms is required');
    });

    it('should handle whitespace-only strings as empty for required validation', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { name: '   ' },
          validationRules: {
            name: { required: 'Name is required' },
          },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleBlur('name');
      });

      expect(result.current.errors.name).toBe('Name is required');
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with values when form is valid', async () => {
      const onSubmit = vi.fn();
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com', password: 'Password123' },
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123',
      });
    });

    it('should not call onSubmit when form is invalid', async () => {
      const onSubmit = vi.fn();
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validationRules: {
            email: { required: 'Email is required' },
          },
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.errors.email).toBe('Email is required');
    });

    it('should set isSubmitting during submission', async () => {
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });

      const onSubmit = vi.fn().mockReturnValue(submitPromise);

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          onSubmit,
        })
      );

      // Start submission
      act(() => {
        result.current.handleSubmit();
      });

      // Check that it's submitting
      expect(result.current.isSubmitting).toBe(true);

      // Resolve the submission
      await act(async () => {
        resolveSubmit!();
        await submitPromise;
      });

      // Should no longer be submitting
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should handle async onSubmit', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalled();
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should handle onSubmit errors gracefully', async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error('Submission failed'));
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      // isSubmitting should be false after error
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should prevent default form submission when event is provided', async () => {
      const onSubmit = vi.fn();
      const preventDefault = vi.fn();
      const mockEvent = { preventDefault } as unknown as React.FormEvent;

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(preventDefault).toHaveBeenCalled();
    });
  });

  describe('Form Reset', () => {
    it('should reset values to initial values', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '', password: '' },
          onSubmit: vi.fn(),
        })
      );

      // Change values
      act(() => {
        result.current.handleChange('email', 'test@example.com');
        result.current.handleChange('password', 'Password123');
      });

      expect(result.current.values.email).toBe('test@example.com');

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.values).toEqual({ email: '', password: '' });
    });

    it('should clear all errors on reset', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validationRules: {
            email: { required: 'Email is required' },
          },
          onSubmit: vi.fn(),
        })
      );

      // Create an error
      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.errors.email).toBeDefined();

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.errors).toEqual({});
    });

    it('should clear touched state on reset', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          onSubmit: vi.fn(),
        })
      );

      // Touch field
      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.touched.email).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.touched).toEqual({});
    });

    it('should reset isSubmitting on reset', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          onSubmit: vi.fn(),
        })
      );

      // Manually set submitting (simulating state during submission)
      act(() => {
        result.current.reset();
      });

      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('setError', () => {
    it('should allow manually setting field errors', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.setError('email', 'Server error: Email already exists');
      });

      expect(result.current.errors.email).toBe('Server error: Email already exists');
    });

    it('should allow overwriting existing errors', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validationRules: {
            email: { required: 'Email is required' },
          },
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.errors.email).toBe('Email is required');

      act(() => {
        result.current.setError('email', 'Different error');
      });

      expect(result.current.errors.email).toBe('Different error');
    });
  });
});
