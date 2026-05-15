// src/pages/admin/types.ts

/**
 * Top-level admin tab type (ASHELL-06)
 *
 * Keys map 1:1 to the `?tab=` URL search param so the browser URL always
 * reflects the currently active section.
 */
export type AdminTabType =
  | 'dashboard'
  | 'inbox'
  | 'decks'
  | 'news'
  | 'situations'
  | 'exercises'
  | 'errors'
  | 'feedback'
  | 'changelog'
  | 'announcements';

const VALID_TABS: readonly AdminTabType[] = [
  'dashboard',
  'inbox',
  'decks',
  'news',
  'situations',
  'exercises',
  'errors',
  'feedback',
  'changelog',
  'announcements',
];

/**
 * Type guard — validates that an arbitrary string (e.g. from URLSearchParams)
 * is a known AdminTabType.
 */
export function isValidTab(value: string | null | undefined): value is AdminTabType {
  return VALID_TABS.includes(value as AdminTabType);
}
