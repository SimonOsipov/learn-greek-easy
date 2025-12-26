import { describe, it, expect } from 'vitest';
import log, { debug, info, warn, error, trace } from '../logger';

describe('logger', () => {
  it('should export default logger', () => {
    expect(log).toBeDefined();
    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.trace).toBe('function');
  });

  it('should export named convenience methods', () => {
    expect(typeof trace).toBe('function');
    expect(typeof debug).toBe('function');
    expect(typeof info).toBe('function');
    expect(typeof warn).toBe('function');
    expect(typeof error).toBe('function');
  });

  it('should have setLevel and getLevel methods', () => {
    expect(typeof log.setLevel).toBe('function');
    expect(typeof log.getLevel).toBe('function');
  });

  it('should have setDefaultLevel method', () => {
    expect(typeof log.setDefaultLevel).toBe('function');
  });

  it('should have rebuild method', () => {
    expect(typeof log.rebuild).toBe('function');
  });

  it('should allow changing log levels', () => {
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

  it('should support all log level values', () => {
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

  it('should have getLogger for named loggers', () => {
    expect(typeof log.getLogger).toBe('function');
    const namedLogger = log.getLogger('test-logger');
    expect(namedLogger).toBeDefined();
    expect(typeof namedLogger.debug).toBe('function');
    expect(typeof namedLogger.info).toBe('function');
    expect(typeof namedLogger.warn).toBe('function');
    expect(typeof namedLogger.error).toBe('function');
  });
});
