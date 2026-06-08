let _posthog: import('posthog-js').PostHog | null = null;

export function __setPosthogInstance(instance: import('posthog-js').PostHog | null): void {
  _posthog = instance;
}

export function getPosthogInstance(): import('posthog-js').PostHog | null {
  return _posthog;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (typeof _posthog?.capture === 'function') {
    _posthog.capture(event, properties);
  }
}
