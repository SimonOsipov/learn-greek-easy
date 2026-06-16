// src/components/auth/__tests__/RegisterForm.schema.test.ts
//
// AUTH-01-01 RED specs for registerSchema.
//
// Base valid object includes `confirmPassword` matching `password` because the
// current (pre-impl) schema still requires it. Once the executor removes the
// confirmPassword field and the cross-field .refine, zod will simply strip the
// extra key — so keeping it in the base object is harmless post-implementation.

import { describe, it, expect } from 'vitest';

import { registerSchema } from '../RegisterForm';

const BASE_VALID = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'alllower8',
  confirmPassword: 'alllower8', // kept for RED state compat; stripped post-impl
  acceptedTerms: true as const,
};

// Helper: get the inner ZodObject shape regardless of whether the schema is
// wrapped in a ZodEffects (.refine) or is a bare ZodObject.
function getShape(schema: unknown): Record<string, unknown> | undefined {
  const s = schema as Record<string, unknown>;
  if (s.shape) return s.shape as Record<string, unknown>;
  const def = s._def as Record<string, unknown> | undefined;
  const inner = def?.schema as Record<string, unknown> | undefined;
  return inner?.shape as Record<string, unknown> | undefined;
}

// ── name field ───────────────────────────────────────────────────────────────

describe('registerSchema — name field', () => {
  it('name_optional_empty_passes: empty name should succeed (name is optional after impl)', () => {
    // RED: current schema has min(1, 'nameRequired') so this fails with that issue
    const result = registerSchema.safeParse({ ...BASE_VALID, name: '' });
    expect(result.success).toBe(true);
  });

  it('name_over_50_fails: name exceeding 50 chars should fail with nameMaxLength', () => {
    const longName = 'a'.repeat(51);
    const result = registerSchema.safeParse({ ...BASE_VALID, name: longName });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === 'name');
      expect(nameIssue?.message).toBe('nameMaxLength');
    }
  });

  it('name_exactly_50_passes: name of exactly 50 chars should succeed (boundary)', () => {
    const exactName = 'a'.repeat(50);
    const result = registerSchema.safeParse({ ...BASE_VALID, name: exactName });
    expect(result.success).toBe(true);
  });

  it('name_whitespace_only_passes: whitespace-only name trims to empty and succeeds as optional', () => {
    // .trim() converts "   " → "" before max(50) check; empty string satisfies optional.
    // The form sends full_name: "" → authStore uses email local-part as fallback.
    const result = registerSchema.safeParse({ ...BASE_VALID, name: '   ' });
    expect(result.success).toBe(true);
    if (result.success) {
      // Confirm trim() stripped the whitespace so the stored value is empty
      expect(result.data.name).toBe('');
    }
  });
});

// ── password field ───────────────────────────────────────────────────────────

describe('registerSchema — password field', () => {
  it('password_lowercase_8_passes: 8-char all-lowercase password should succeed (no complexity rule)', () => {
    // Should pass: schema has no uppercase/special requirement.
    // In the RED state this passes already (base includes confirmPassword), so this is a GREEN guard.
    const result = registerSchema.safeParse({
      ...BASE_VALID,
      password: 'alllower',
      confirmPassword: 'alllower',
    });
    expect(result.success).toBe(true);
  });

  it('password_7_chars_fails: 7-char password should fail with passwordMinLength', () => {
    const result = registerSchema.safeParse({
      ...BASE_VALID,
      password: 'short12',
      confirmPassword: 'short12',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwIssue = result.error.issues.find((i) => i.path[0] === 'password');
      expect(pwIssue?.message).toBe('passwordMinLength');
    }
  });
});

// ── confirmPassword field removal ────────────────────────────────────────────

describe('registerSchema — confirmPassword removed', () => {
  it('no_confirm_field: schema shape should NOT contain confirmPassword key, and object without confirmPassword should parse successfully', () => {
    // Shape assertion: the key must be absent after impl.
    // RED: current shape HAS confirmPassword → shape.confirmPassword is defined.
    const shape = getShape(registerSchema);
    expect(shape?.confirmPassword).toBeUndefined();

    // Parse assertion: a valid object without confirmPassword should succeed.
    // RED: current schema requires confirmPassword, so this also fails.
    const { confirmPassword: _omit, ...withoutConfirm } = BASE_VALID;
    const result = registerSchema.safeParse(withoutConfirm);
    expect(result.success).toBe(true);
  });
});

// ── acceptedTerms field ──────────────────────────────────────────────────────

describe('registerSchema — acceptedTerms field', () => {
  it('terms_false_fails: acceptedTerms=false should fail with termsRequired', () => {
    const result = registerSchema.safeParse({ ...BASE_VALID, acceptedTerms: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      const termsIssue = result.error.issues.find((i) => i.path[0] === 'acceptedTerms');
      expect(termsIssue?.message).toBe('termsRequired');
    }
  });
});

// ── email field ──────────────────────────────────────────────────────────────

describe('registerSchema — email field', () => {
  it('email_invalid_fails: non-email string should fail with emailInvalid', () => {
    const result = registerSchema.safeParse({ ...BASE_VALID, email: 'nope' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path[0] === 'email');
      expect(emailIssue?.message).toBe('emailInvalid');
    }
  });
});
