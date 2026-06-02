// Matches a PII-shaped key anywhere in an object tree.
export const PII_KEY_RE = /email|token|password|authorization/i;

// Recursively removes keys matching PII_KEY_RE (dropped entirely, not redacted).
// Typed as unknown->unknown: dropping keys cannot preserve a generic T cleanly.
export function scrubPii(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrubPii);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEY_RE.test(k)) continue; // drop key entirely
      out[k] = scrubPii(v);
    }
    return out;
  }
  return value;
}
