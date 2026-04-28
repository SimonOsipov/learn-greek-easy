/**
 * Sentry Queue Tests
 *
 * Regression tests for the type-safety fixes made in TSCI-01-12:
 * - queueMessage now accepts SentryType.SeverityLevel (not a loose string),
 *   which prevents invalid values like 'warn' from reaching Sentry's
 *   captureMessage. Sentry's SeverityLevel is:
 *   'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug'
 *   — 'warn' is NOT a valid SeverityLevel and would be silently mishandled.
 *
 * Coverage targets:
 * - queueMessage() — valid SeverityLevel flows through to captureMessage
 * - queueMessage() — queued items store the exact SeverityLevel (not coerced)
 * - Flush path — captureMessage receives the stored SeverityLevel unchanged
 * - Default level — 'error' is passed when no level argument is given
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SeverityLevel } from '@sentry/react';

// We test the module's runtime behavior by inspecting what values reach
// Sentry.captureMessage. The module holds internal state (sentryLoaded, queue,
// Sentry reference) that we reset between tests via the module reset mechanism.
//
// Strategy:
// - When sentryLoaded=true (Sentry is live): mock Sentry directly at import time.
// - When sentryLoaded=false (pre-init): call queueMessage to enqueue, then
//   trigger initSentryAsync with a mocked dynamic import, and verify the flushed
//   captureMessage call.

// Mock @sentry/react so we control captureMessage
const mockCaptureMessage = vi.fn().mockReturnValue('mock-event-id');
const mockCaptureException = vi.fn().mockReturnValue('mock-event-id');
const mockAddBreadcrumb = vi.fn();
const mockLogger = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
};

vi.mock('@sentry/react', () => ({
  captureMessage: mockCaptureMessage,
  captureException: mockCaptureException,
  addBreadcrumb: mockAddBreadcrumb,
  logger: mockLogger,
}));

// Mock the instrument import that initSentryAsync pulls in
vi.mock('../instrument', () => ({}));

// Mock logger to suppress noise
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('sentry-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state between tests by re-importing with a fresh module instance
    vi.resetModules();
  });

  describe('Bug fix: SeverityLevel type discipline (TSCI-01-12)', () => {
    // Regression tests ensuring that the type narrowing introduced in TSCI-01-12
    // means only valid SeverityLevel values flow through to captureMessage.
    // Before the fix, the queue typed level as a loose string, allowing 'warn'
    // (which is NOT a valid Sentry SeverityLevel — the correct value is 'warning').

    it('passes valid SeverityLevel "error" through to captureMessage when Sentry is loaded', async () => {
      // Force PROD mode so initSentryAsync runs
      const originalProd = import.meta.env.PROD;
      vi.stubEnv('PROD', true as unknown as string);

      const { initSentryAsync, queueMessage } = await import('../sentry-queue');

      // Initialize Sentry first so sentryLoaded=true
      await initSentryAsync();

      const result = queueMessage('test error message', 'error');

      expect(mockCaptureMessage).toHaveBeenCalledWith('test error message', 'error');
      expect(result).toBe('mock-event-id');

      vi.stubEnv('PROD', originalProd as unknown as string);
    });

    it('passes valid SeverityLevel "warning" (not "warn") through to captureMessage', async () => {
      const originalProd = import.meta.env.PROD;
      vi.stubEnv('PROD', true as unknown as string);

      const { initSentryAsync, queueMessage } = await import('../sentry-queue');
      await initSentryAsync();

      queueMessage('test warning message', 'warning');

      expect(mockCaptureMessage).toHaveBeenCalledWith('test warning message', 'warning');

      vi.stubEnv('PROD', originalProd as unknown as string);
    });

    it('passes valid SeverityLevel "info" through to captureMessage', async () => {
      const originalProd = import.meta.env.PROD;
      vi.stubEnv('PROD', true as unknown as string);

      const { initSentryAsync, queueMessage } = await import('../sentry-queue');
      await initSentryAsync();

      queueMessage('test info message', 'info');

      expect(mockCaptureMessage).toHaveBeenCalledWith('test info message', 'info');

      vi.stubEnv('PROD', originalProd as unknown as string);
    });

    it('uses "error" as the default level when no level argument is given', async () => {
      const originalProd = import.meta.env.PROD;
      vi.stubEnv('PROD', true as unknown as string);

      const { initSentryAsync, queueMessage } = await import('../sentry-queue');
      await initSentryAsync();

      queueMessage('message with default level');

      expect(mockCaptureMessage).toHaveBeenCalledWith('message with default level', 'error');

      vi.stubEnv('PROD', originalProd as unknown as string);
    });

    it('queued message stores exact SeverityLevel and flushes it unchanged to captureMessage', async () => {
      // When Sentry is not yet loaded, messages go into the queue.
      // On flush, captureMessage must receive the same SeverityLevel that was passed.
      const originalProd = import.meta.env.PROD;
      vi.stubEnv('PROD', true as unknown as string);

      const { queueMessage, initSentryAsync } = await import('../sentry-queue');

      // Sentry not loaded yet — this goes into the queue
      const level: SeverityLevel = 'warning';
      const result = queueMessage('queued message', level);

      // While not loaded, returns null (no event ID yet)
      expect(result).toBeNull();
      expect(mockCaptureMessage).not.toHaveBeenCalled();

      // Now initialize Sentry — should flush the queue
      await initSentryAsync();

      // The flushed message must use the stored SeverityLevel ('warning', not 'warn')
      expect(mockCaptureMessage).toHaveBeenCalledWith('queued message', 'warning');

      vi.stubEnv('PROD', originalProd as unknown as string);
    });

    it('captureMessage is never called with "warn" (invalid Sentry level)', async () => {
      // Exhaustive check: regardless of how many valid-level messages are sent,
      // captureMessage should never receive the string 'warn'.
      const originalProd = import.meta.env.PROD;
      vi.stubEnv('PROD', true as unknown as string);

      const { initSentryAsync, queueMessage } = await import('../sentry-queue');
      await initSentryAsync();

      const validLevels: SeverityLevel[] = ['fatal', 'error', 'warning', 'log', 'info', 'debug'];
      for (const lvl of validLevels) {
        queueMessage(`message at ${lvl}`, lvl);
      }

      const calls = mockCaptureMessage.mock.calls;
      const receivedLevels = calls.map((c) => c[1]);

      // 'warn' must never appear — only valid SeverityLevel values
      expect(receivedLevels).not.toContain('warn');
      // Every level sent was a valid SeverityLevel
      expect(receivedLevels).toEqual(validLevels);

      vi.stubEnv('PROD', originalProd as unknown as string);
    });
  });

  describe('queueMessage when Sentry is not loaded', () => {
    it('returns null and does not call captureMessage', async () => {
      // PROD=false means initSentryAsync is a no-op, so sentryLoaded stays false
      const { queueMessage } = await import('../sentry-queue');

      const result = queueMessage('some message', 'error');

      expect(result).toBeNull();
      expect(mockCaptureMessage).not.toHaveBeenCalled();
    });
  });
});
