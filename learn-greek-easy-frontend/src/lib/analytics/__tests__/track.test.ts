import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCapture = vi.fn();

vi.mock('posthog-js', () => ({
  default: {
    capture: mockCapture,
  },
}));

const { track } = await import('../track');

describe('track', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls posthog.capture with the event name', () => {
    track('some_event');
    expect(mockCapture).toHaveBeenCalledWith('some_event', undefined);
  });

  it('calls posthog.capture with event name and properties', () => {
    track('some_event', { foo: 'bar', count: 42 });
    expect(mockCapture).toHaveBeenCalledWith('some_event', { foo: 'bar', count: 42 });
  });

  it('is called once per invocation', () => {
    track('event_a');
    track('event_b');
    expect(mockCapture).toHaveBeenCalledTimes(2);
  });
});
