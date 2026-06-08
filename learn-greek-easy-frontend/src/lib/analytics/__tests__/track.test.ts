import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setPosthogInstance, getPosthogInstance, track } from '../track';

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

describe('track — adversarial / edge coverage', () => {
  afterEach(() => {
    __setPosthogInstance(null);
  });

  it('passes a deeply nested properties object through unmodified (object identity)', () => {
    const props = { nested: { a: 1, b: [true, null] }, top: 'val' };
    const mockCap = vi.fn();
    __setPosthogInstance({ capture: mockCap } as unknown as import('posthog-js').PostHog);
    track('deep_event', props);
    // The exact same reference must be forwarded — no cloning or mutation allowed
    expect(mockCap).toHaveBeenCalledWith('deep_event', props);
    const receivedProps = mockCap.mock.calls[0][1];
    expect(receivedProps).toBe(props);
  });

  it('does not throw when instance has capture but no other methods (partial instance)', () => {
    // Guard is typeof .capture === 'function'; a partial stub must still work
    const partialInstance = { capture: vi.fn() } as unknown as import('posthog-js').PostHog;
    __setPosthogInstance(partialInstance);
    expect(() => track('partial_event', { x: 1 })).not.toThrow();
    expect(partialInstance.capture as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      'partial_event',
      { x: 1 }
    );
  });

  it('no-ops when instance is set but capture is not a function (e.g. undefined field)', () => {
    const brokenInstance = { capture: undefined } as unknown as import('posthog-js').PostHog;
    __setPosthogInstance(brokenInstance);
    expect(() => track('broken_event')).not.toThrow();
  });

  it('getPosthogInstance() returns exactly what was injected (round-trip)', () => {
    const fakeInstance = { capture: vi.fn() } as unknown as import('posthog-js').PostHog;
    __setPosthogInstance(fakeInstance);
    expect(getPosthogInstance()).toBe(fakeInstance);
  });

  it('getPosthogInstance() returns null after reset', () => {
    __setPosthogInstance({ capture: vi.fn() } as unknown as import('posthog-js').PostHog);
    __setPosthogInstance(null);
    expect(getPosthogInstance()).toBeNull();
  });

  it('track() fires after set, then no-ops after cleared (lifecycle)', () => {
    const mockCap = vi.fn();
    __setPosthogInstance({ capture: mockCap } as unknown as import('posthog-js').PostHog);
    track('before_clear');
    expect(mockCap).toHaveBeenCalledTimes(1);

    __setPosthogInstance(null);
    track('after_clear');
    expect(mockCap).toHaveBeenCalledTimes(1); // no additional call after reset
  });
});
