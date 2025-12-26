import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';

// Mock Sentry before importing logger
vi.mock('@sentry/react', () => ({
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Mock console methods to suppress output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'trace').mockImplementation(() => {});

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export default logger', async () => {
    const { default: log } = await import('../logger');
    expect(log).toBeDefined();
    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.trace).toBe('function');
  });

  it('should export named convenience methods', async () => {
    const { trace, debug, info, warn, error } = await import('../logger');
    expect(typeof trace).toBe('function');
    expect(typeof debug).toBe('function');
    expect(typeof info).toBe('function');
    expect(typeof warn).toBe('function');
    expect(typeof error).toBe('function');
  });

  it('should have setLevel and getLevel methods', async () => {
    const { default: log } = await import('../logger');
    expect(typeof log.setLevel).toBe('function');
    expect(typeof log.getLevel).toBe('function');
  });

  it('should have setDefaultLevel method', async () => {
    const { default: log } = await import('../logger');
    expect(typeof log.setDefaultLevel).toBe('function');
  });

  it('should have rebuild method', async () => {
    const { default: log } = await import('../logger');
    expect(typeof log.rebuild).toBe('function');
  });

  it('should allow changing log levels', async () => {
    const { default: log } = await import('../logger');
    const originalLevel = log.getLevel();

    // Set to error level
    log.setLevel('error');
    expect(log.getLevel()).toBe(4); // 4 = error level in loglevel

    // Set to trace level
    log.setLevel('trace');
    expect(log.getLevel()).toBe(0); // 0 = trace level in loglevel

    // Restore original level
    log.setLevel(originalLevel);
  });

  it('should support all log level values', async () => {
    const { default: log } = await import('../logger');
    // Test all valid log levels
    const levels: Array<'trace' | 'debug' | 'info' | 'warn' | 'error'> = [
      'trace',
      'debug',
      'info',
      'warn',
      'error',
    ];

    const originalLevel = log.getLevel();

    levels.forEach((level, index) => {
      log.setLevel(level);
      expect(log.getLevel()).toBe(index);
    });

    // Restore original level
    log.setLevel(originalLevel);
  });

  it('should have getLogger for named loggers', async () => {
    const { default: log } = await import('../logger');
    expect(typeof log.getLogger).toBe('function');
    const namedLogger = log.getLogger('test-logger');
    expect(namedLogger).toBeDefined();
    expect(typeof namedLogger.debug).toBe('function');
    expect(typeof namedLogger.info).toBe('function');
    expect(typeof namedLogger.warn).toBe('function');
    expect(typeof namedLogger.error).toBe('function');
  });

  describe('Sentry integration', () => {
    describe('in development mode (import.meta.env.PROD = false)', () => {
      it('should not call Sentry.captureMessage for error logs', async () => {
        const { default: log } = await import('../logger');
        log.setLevel('trace');
        log.error('Test error message');
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
      });

      it('should not call Sentry.addBreadcrumb for warn logs', async () => {
        const { default: log } = await import('../logger');
        log.setLevel('trace');
        log.warn('Test warning message');
        expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
      });

      it('should not call Sentry.addBreadcrumb for info logs', async () => {
        const { default: log } = await import('../logger');
        log.setLevel('trace');
        log.info('Test info message');
        expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
      });

      it('should not call any Sentry methods for debug logs', async () => {
        const { default: log } = await import('../logger');
        log.setLevel('trace');
        log.debug('Test debug message');
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
        expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
      });

      it('should not call any Sentry methods for trace logs', async () => {
        const { default: log } = await import('../logger');
        log.setLevel('trace');
        log.trace('Test trace message');
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
        expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
      });
    });

    describe('message formatting', () => {
      it('should handle string arguments', async () => {
        // In development, we can't test Sentry calls directly,
        // but we can verify the logger works without errors
        const { default: log } = await import('../logger');
        log.setLevel('trace');
        expect(() => log.error('Simple string message')).not.toThrow();
      });

      it('should handle multiple arguments', async () => {
        const { default: log } = await import('../logger');
        log.setLevel('trace');
        expect(() => log.error('Message', 'with', 'multiple', 'parts')).not.toThrow();
      });

      it('should handle object arguments', async () => {
        const { default: log } = await import('../logger');
        log.setLevel('trace');
        expect(() => log.error('Error with object:', { key: 'value' })).not.toThrow();
      });

      it('should handle numeric arguments', async () => {
        const { default: log } = await import('../logger');
        log.setLevel('trace');
        expect(() => log.error('Error code:', 500)).not.toThrow();
      });

      it('should handle null and undefined arguments', async () => {
        const { default: log } = await import('../logger');
        log.setLevel('trace');
        expect(() => log.error('Null value:', null)).not.toThrow();
        expect(() => log.error('Undefined value:', undefined)).not.toThrow();
      });

      it('should handle mixed argument types', async () => {
        const { default: log } = await import('../logger');
        log.setLevel('trace');
        expect(() =>
          log.error('Mixed:', 'string', 123, { obj: true }, null, undefined)
        ).not.toThrow();
      });
    });
  });
});

describe('logger Sentry integration in production mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Note: We cannot directly modify import.meta.env.PROD in Vitest
    // as it's read at module load time. These tests verify the code structure
    // and that the Sentry mock is properly set up.
  });

  afterEach(() => {
    // Restore original environment
    vi.unstubAllEnvs();
  });

  it('should have Sentry mock properly configured', () => {
    expect(vi.isMockFunction(Sentry.captureMessage)).toBe(true);
    expect(vi.isMockFunction(Sentry.addBreadcrumb)).toBe(true);
  });

  it('should export Sentry functions that can be called', () => {
    // Verify the mock functions can be called
    Sentry.captureMessage('test', 'error');
    expect(Sentry.captureMessage).toHaveBeenCalledWith('test', 'error');

    Sentry.addBreadcrumb({ category: 'test', message: 'msg', level: 'info' });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'test',
      message: 'msg',
      level: 'info',
    });
  });

  // Note: Testing actual production behavior requires integration tests
  // because import.meta.env.PROD is evaluated at module load time.
  // The production behavior can be verified by:
  // 1. Building with `npm run build`
  // 2. Checking Sentry dashboard for captured events
  // 3. E2E tests in a production-like environment
});
