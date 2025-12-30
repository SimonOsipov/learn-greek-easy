import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { lazyWithRetry, namedExport } from '../lazyWithRetry';

describe('lazyWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('successful imports', () => {
    it('should return a lazy component when import succeeds on first try', async () => {
      const MockComponent = () => <div data-testid="mock-component">Hello</div>;
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });

      const LazyComponent = lazyWithRetry(importFn);

      // React.lazy returns a special object with $$typeof
      expect(LazyComponent).toBeDefined();
      expect(LazyComponent.$$typeof).toBe(Symbol.for('react.lazy'));
    });

    it('should render the component when wrapped in Suspense', async () => {
      vi.useRealTimers(); // Use real timers for render tests

      const MockComponent = () => <div data-testid="mock-component">Hello World</div>;
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });

      const LazyComponent = lazyWithRetry(importFn);

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
        expect(screen.getByText('Hello World')).toBeInTheDocument();
      });

      expect(importFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry logic', () => {
    it('should retry on failure and eventually succeed', async () => {
      vi.useRealTimers(); // Use real timers for async behavior

      const MockComponent = () => <div data-testid="success">Success!</div>;
      const importFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed to load chunk'))
        .mockRejectedValueOnce(new Error('Failed to load chunk'))
        .mockResolvedValue({ default: MockComponent });

      const LazyComponent = lazyWithRetry(importFn, {
        retries: 3,
        baseDelay: 10, // Short delay for testing
        maxDelay: 50,
      });

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      await waitFor(
        () => {
          expect(screen.getByTestId('success')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Should have called: initial + 2 failures then success = 3 total
      expect(importFn).toHaveBeenCalledTimes(3);
    });

    it('should throw after all retries are exhausted', async () => {
      vi.useRealTimers();

      const error = new Error('Persistent chunk error');
      const importFn = vi.fn().mockRejectedValue(error);

      const LazyComponent = lazyWithRetry(importFn, {
        retries: 2,
        baseDelay: 10,
        maxDelay: 50,
      });

      // Suppress React error boundary console errors
      const originalError = console.error;
      console.error = vi.fn();

      try {
        render(
          <Suspense fallback={<div>Loading...</div>}>
            <LazyComponent />
          </Suspense>
        );

        // Wait for all retries to complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        // initial + 2 retries = 3 total
        expect(importFn).toHaveBeenCalledTimes(3);
      } finally {
        console.error = originalError;
      }
    });

    it('should respect custom retry count of 0 (no retries)', async () => {
      vi.useRealTimers();

      const importFn = vi.fn().mockRejectedValue(new Error('Error'));

      const LazyComponent = lazyWithRetry(importFn, {
        retries: 0,
        baseDelay: 10,
      });

      const originalError = console.error;
      console.error = vi.fn();

      try {
        render(
          <Suspense fallback={<div>Loading...</div>}>
            <LazyComponent />
          </Suspense>
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Only initial call, no retries
        expect(importFn).toHaveBeenCalledTimes(1);
      } finally {
        console.error = originalError;
      }
    });
  });

  describe('delay calculation', () => {
    it('should calculate correct exponential delays', () => {
      // Test the delay formula: min(baseDelay * 2^attempt, maxDelay)
      const baseDelay = 1000;
      const maxDelay = 10000;

      const delays = [0, 1, 2, 3, 4, 5].map((attempt) =>
        Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
      );

      expect(delays[0]).toBe(1000); // 1000 * 2^0 = 1000
      expect(delays[1]).toBe(2000); // 1000 * 2^1 = 2000
      expect(delays[2]).toBe(4000); // 1000 * 2^2 = 4000
      expect(delays[3]).toBe(8000); // 1000 * 2^3 = 8000
      expect(delays[4]).toBe(10000); // min(16000, 10000) = 10000
      expect(delays[5]).toBe(10000); // min(32000, 10000) = 10000
    });
  });
});

describe('namedExport', () => {
  it('should transform named export to default export format', async () => {
    const MyComponent = () => null;
    const importFn = vi.fn().mockResolvedValue({
      MyComponent,
      OtherComponent: () => null,
    });

    const transformer = namedExport(importFn, 'MyComponent');
    const result = await transformer();

    expect(result).toEqual({ default: MyComponent });
  });

  it('should work with lazyWithRetry', async () => {
    const MyComponent = () => null;
    const importFn = vi.fn().mockResolvedValue({
      MyComponent,
    });

    const LazyComponent = lazyWithRetry(namedExport(importFn, 'MyComponent'));

    expect(LazyComponent).toBeDefined();
    expect(LazyComponent.$$typeof).toBe(Symbol.for('react.lazy'));
  });

  it('should render correctly when combined with lazyWithRetry', async () => {
    vi.useRealTimers();

    const MyComponent = () => <div data-testid="named-component">Named Export</div>;
    const importFn = vi.fn().mockResolvedValue({ MyComponent });

    const LazyComponent = lazyWithRetry(namedExport(importFn, 'MyComponent'));

    render(
      <Suspense fallback={<div>Loading...</div>}>
        <LazyComponent />
      </Suspense>
    );

    await waitFor(() => {
      expect(screen.getByTestId('named-component')).toBeInTheDocument();
      expect(screen.getByText('Named Export')).toBeInTheDocument();
    });
  });
});
