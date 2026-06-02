/// <reference types="jest" />
import { scrubPii, PII_KEY_RE } from '../scrub';

describe('scrubPii', () => {
  describe('PII key removal', () => {
    it('drops top-level PII keys', () => {
      const input = { email: 'user@example.com', name: 'Alice' };
      expect(scrubPii(input)).toEqual({ name: 'Alice' });
    });

    it('drops token key', () => {
      const input = { token: 'abc123', role: 'admin' };
      expect(scrubPii(input)).toEqual({ role: 'admin' });
    });

    it('drops password key', () => {
      const input = { password: 'secret', username: 'bob' };
      expect(scrubPii(input)).toEqual({ username: 'bob' });
    });

    it('drops authorization key', () => {
      const input = { authorization: 'Bearer xyz', method: 'GET' };
      expect(scrubPii(input)).toEqual({ method: 'GET' });
    });

    it('is case-insensitive — drops EMAIL and Authorization', () => {
      const input = { EMAIL: 'x@y.com', Authorization: 'Bearer tok', safe: 1 };
      expect(scrubPii(input)).toEqual({ safe: 1 });
    });
  });

  describe('nested object scrubbing', () => {
    it('drops PII keys at every depth', () => {
      const input = {
        user: {
          email: 'u@example.com',
          profile: {
            token: 'deep-secret',
            displayName: 'Alice',
          },
        },
        requestId: 'req-1',
      };
      const expected = {
        user: {
          profile: {
            displayName: 'Alice',
          },
        },
        requestId: 'req-1',
      };
      expect(scrubPii(input)).toEqual(expected);
    });

    it('passes non-PII key values through unchanged', () => {
      const input = { foo: 'bar', count: 42, active: true };
      expect(scrubPii(input)).toEqual({ foo: 'bar', count: 42, active: true });
    });
  });

  describe('array handling', () => {
    it('scrubs PII keys element-wise in arrays', () => {
      const input = [
        { email: 'a@b.com', id: 1 },
        { token: 'tok', id: 2 },
        { name: 'safe', id: 3 },
      ];
      expect(scrubPii(input)).toEqual([{ id: 1 }, { id: 2 }, { name: 'safe', id: 3 }]);
    });

    it('handles arrays of primitives unchanged', () => {
      expect(scrubPii([1, 'hello', true, null])).toEqual([1, 'hello', true, null]);
    });
  });

  describe('primitive passthrough', () => {
    it('returns strings as-is', () => {
      expect(scrubPii('hello')).toBe('hello');
    });

    it('returns numbers as-is', () => {
      expect(scrubPii(42)).toBe(42);
    });

    it('returns booleans as-is', () => {
      expect(scrubPii(true)).toBe(true);
      expect(scrubPii(false)).toBe(false);
    });

    it('returns null as-is', () => {
      expect(scrubPii(null)).toBeNull();
    });
  });

  describe('PII_KEY_RE', () => {
    it('matches expected PII key patterns case-insensitively', () => {
      expect(PII_KEY_RE.test('email')).toBe(true);
      expect(PII_KEY_RE.test('EMAIL')).toBe(true);
      expect(PII_KEY_RE.test('token')).toBe(true);
      expect(PII_KEY_RE.test('password')).toBe(true);
      expect(PII_KEY_RE.test('authorization')).toBe(true);
      expect(PII_KEY_RE.test('Authorization')).toBe(true);
    });

    it('does not match safe keys', () => {
      expect(PII_KEY_RE.test('name')).toBe(false);
      expect(PII_KEY_RE.test('id')).toBe(false);
      expect(PII_KEY_RE.test('role')).toBe(false);
    });
  });
});
