import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setPosthogInstance, track } from '../track';

const mockCapture = vi.fn();

describe('track', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setPosthogInstance({ capture: mockCapture } as unknown as import('posthog-js').PostHog);
  });

  afterEach(() => {
    __setPosthogInstance(null);
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

  it('does not throw and does not call capture when posthog instance is null', () => {
    __setPosthogInstance(null);
    expect(() => track('e')).not.toThrow();
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
