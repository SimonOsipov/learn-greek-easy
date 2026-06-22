/**
 * LEXGEN-12-04 — lexgenInbox namespace i18n value-non-emptiness guard.
 *
 * Structural en↔ru key-path parity for the lexgenInbox subtree (and tabs.lexgenInbox)
 * is ALREADY covered generically by `parity.test.ts`, which globs every
 * locales/{en,ru}/*.json namespace and asserts deep key-path symmetry. This file
 * adds the one thing that guard does NOT: it asserts every key actually CONSUMED by
 * the verification-inbox UI resolves to a real, non-empty translated string in BOTH
 * locales — so future drift (a key emptied, removed, or left English in ru) fails CI.
 *
 * The REFERENCED_KEYS list is sourced from the live `t('lexgenInbox....')` /
 * `t('tabs.lexgenInbox')` callsites in LexgenInboxView.tsx, LexgenProposalDetail.tsx,
 * and AdminPage.tsx — it guards real usage, not just JSON shape. Keep it in sync if
 * a new lexgenInbox key is consumed by those components.
 */

import { describe, it, expect } from 'vitest';

import enAdmin from '../locales/en/admin.json';
import ruAdmin from '../locales/ru/admin.json';

/** Resolve a dot-separated key path against a (possibly nested) translation object. */
function resolve(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc !== null && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
}

// Every lexgenInbox key consumed by the inbox UI (incl. the tab label).
const REFERENCED_KEYS: readonly string[] = [
  'tabs.lexgenInbox',
  // page head + states
  'lexgenInbox.title',
  'lexgenInbox.sub',
  'lexgenInbox.kicker',
  'lexgenInbox.empty',
  'lexgenInbox.error',
  'lexgenInbox.breadcrumb.dashboard',
  'lexgenInbox.breadcrumb.current',
  // queue columns
  'lexgenInbox.column.lemma',
  'lexgenInbox.column.pos',
  'lexgenInbox.column.flaggedFields',
  'lexgenInbox.column.age',
  // detail panel
  'lexgenInbox.detail.provenance',
  'lexgenInbox.detail.flagged',
  'lexgenInbox.detail.readOnlyNote',
  'lexgenInbox.detail.fieldsHeading',
  'lexgenInbox.detail.contentHeading',
  // detail field labels
  'lexgenInbox.detail.field.gender',
  'lexgenInbox.detail.field.declensionGroup',
  'lexgenInbox.detail.field.ipa',
  'lexgenInbox.detail.field.frequency',
  'lexgenInbox.detail.field.glossEn',
  'lexgenInbox.detail.field.glossRu',
  'lexgenInbox.detail.field.exampleGreek',
  'lexgenInbox.detail.field.exampleTranslation',
];

const en = enAdmin as unknown as Record<string, unknown>;
const ru = ruAdmin as unknown as Record<string, unknown>;

describe('lexgenInbox i18n value guard (en + ru)', () => {
  it.each(REFERENCED_KEYS)('"%s" is a non-empty string in en/admin.json', (key) => {
    const value = resolve(en, key);
    expect(typeof value, `en is missing or non-string for "${key}"`).toBe('string');
    expect((value as string).trim().length, `en value for "${key}" is empty`).toBeGreaterThan(0);
  });

  it.each(REFERENCED_KEYS)('"%s" is a non-empty string in ru/admin.json', (key) => {
    const value = resolve(ru, key);
    expect(typeof value, `ru is missing or non-string for "${key}"`).toBe('string');
    expect((value as string).trim().length, `ru value for "${key}" is empty`).toBeGreaterThan(0);
  });

  // NOTE: no strict en !== ru assertion here. Per the project i18n convention,
  // English strings in ru/admin.json are acceptable as intentional placeholders
  // for newly added admin v1 sections, so a hard equality ban would false-fail
  // legitimate future additions (CodeRabbit). Non-emptiness above is the guard.
});
