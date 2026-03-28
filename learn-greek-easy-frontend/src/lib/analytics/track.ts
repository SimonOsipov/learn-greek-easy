import posthog from 'posthog-js';

export function track(event: string, properties?: Record<string, unknown>): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture(event, properties);
  }
}
