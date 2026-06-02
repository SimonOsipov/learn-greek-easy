import { getPostHog } from './posthog';

export function identifyUser(userId: string): void {
  const client = getPostHog();
  if (typeof client?.identify === 'function') {
    client.identify(userId); // id only — NO properties, NO PII (diverges from web which sends email+created_at)
  }
}

export function resetIdentity(): void {
  const client = getPostHog();
  if (typeof client?.reset === 'function') {
    client.reset();
  }
}
