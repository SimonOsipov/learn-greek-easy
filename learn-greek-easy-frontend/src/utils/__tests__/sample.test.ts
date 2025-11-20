/**
 * Sample Test - Validates Vitest Setup
 */

import { describe, it, expect } from 'vitest';

describe('Vitest Setup Validation', () => {
  it('should run basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toContain('ell');
    expect([1, 2, 3]).toHaveLength(3);
  });

  it('should support async tests', async () => {
    const promise = Promise.resolve(42);
    await expect(promise).resolves.toBe(42);
  });

  it('should support TypeScript', () => {
    const user: { name: string; age: number } = {
      name: 'John',
      age: 30,
    };
    expect(user.name).toBe('John');
    expect(user.age).toBeGreaterThan(18);
  });
});
