// src/lib/userUtils.ts
// Shared utility helpers for user-related display logic.

/**
 * Returns up to two initials from a display name.
 * Falls back to 'A' (Anonymous) when name is absent.
 */
export function initialsOf(name?: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase() || 'A';
}
