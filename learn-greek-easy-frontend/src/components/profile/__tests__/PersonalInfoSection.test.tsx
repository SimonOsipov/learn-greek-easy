import { describe, it, expect } from 'vitest';
import { createProfileSchema } from '../PersonalInfoSection';

// Use a passthrough t() since we're testing regex/validation logic, not translation strings
const t = (key: string) => key;
const schema = createProfileSchema(t as Parameters<typeof createProfileSchema>[0]);

describe('PersonalInfoSection - name validation', () => {
  describe('valid names (should pass)', () => {
    it('accepts standard Latin name', () => {
      expect(schema.safeParse({ name: 'John Doe' }).success).toBe(true);
    });

    it('accepts Greek name', () => {
      expect(schema.safeParse({ name: 'Κώστας Παπαδόπουλος' }).success).toBe(true);
    });

    it('accepts Russian/Cyrillic name', () => {
      expect(schema.safeParse({ name: 'Иван Петров' }).success).toBe(true);
    });

    it('accepts accented Latin name', () => {
      expect(schema.safeParse({ name: 'José García' }).success).toBe(true);
    });

    it('accepts hyphenated name', () => {
      expect(schema.safeParse({ name: 'Anne-Marie' }).success).toBe(true);
    });

    it('accepts name with apostrophe', () => {
      expect(schema.safeParse({ name: "O'Brien" }).success).toBe(true);
    });
  });

  describe('invalid names (should fail)', () => {
    it('rejects name with digits', () => {
      expect(schema.safeParse({ name: 'John123' }).success).toBe(false);
    });

    it('rejects name with @ symbol', () => {
      expect(schema.safeParse({ name: 'John@Doe' }).success).toBe(false);
    });

    it('rejects single character (minimum 2)', () => {
      expect(schema.safeParse({ name: 'A' }).success).toBe(false);
    });

    it('rejects empty string', () => {
      expect(schema.safeParse({ name: '' }).success).toBe(false);
    });
  });
});
