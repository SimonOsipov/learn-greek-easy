import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { APIRequestError } from '@/services/api';

import { reportAPIError } from '../errorReporting';
import { queueException } from '../sentry-queue';

vi.mock('../sentry-queue', () => ({
  queueException: vi.fn(),
}));

describe('reportAPIError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call queueException with error and context', () => {
    const error = new APIRequestError({
      status: 500,
      statusText: 'Internal Server Error',
      message: 'test error',
      detail: 'error details',
    });
    reportAPIError(error, { operation: 'submitAnswer' });

    expect(queueException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        operation: 'submitAnswer',
        apiError: {
          status: 500,
          statusText: 'Internal Server Error',
          message: 'test error',
          detail: 'error details',
        },
      })
    );
  });

  it('should work with generic errors', () => {
    const error = new Error('Generic error');
    reportAPIError(error, { endpoint: '/api/test' });

    expect(queueException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        endpoint: '/api/test',
      })
    );
  });

  it('should add timestamp to context', () => {
    const error = new Error('test');
    reportAPIError(error);

    expect(queueException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        timestamp: '2024-01-15T12:00:00.000Z',
      })
    );
  });

  it('should work without context', () => {
    const error = new Error('no context error');
    reportAPIError(error);

    expect(queueException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        timestamp: expect.any(String),
      })
    );
  });

  it('should include additional custom context properties', () => {
    const error = new Error('test');
    reportAPIError(error, {
      operation: 'customOperation',
      method: 'POST',
      customField: 'customValue',
    });

    expect(queueException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        operation: 'customOperation',
        method: 'POST',
        customField: 'customValue',
      })
    );
  });

  it('should not include apiError for non-APIRequestError', () => {
    const error = new Error('generic');
    reportAPIError(error, { operation: 'test' });

    const callArgs = vi.mocked(queueException).mock.calls[0];
    const context = callArgs[1] as Record<string, unknown>;
    expect(context.apiError).toBeUndefined();
  });

  it('should handle APIRequestError without detail', () => {
    const error = new APIRequestError({
      status: 404,
      statusText: 'Not Found',
      message: 'Resource not found',
    });
    reportAPIError(error, { operation: 'fetchResource' });

    expect(queueException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        apiError: {
          status: 404,
          statusText: 'Not Found',
          message: 'Resource not found',
          detail: undefined,
        },
      })
    );
  });
});
