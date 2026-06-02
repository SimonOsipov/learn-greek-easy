import { type PostHogEventProperties } from '@posthog/core';

import { getPostHog } from './posthog';

export function track(event: string, properties?: Record<string, unknown>): void {
  const client = getPostHog();
  if (typeof client?.capture === 'function') {
    // PostHogEventProperties = { [key: string]: JsonType }.
    // Record<string, unknown> is wider than JsonType, but PostHog accepts
    // any JSON-serialisable value; the cast is safe — non-serialisable values
    // are silently dropped by the SDK on ingestion.
    client.capture(event, properties as PostHogEventProperties | undefined);
  }
}
