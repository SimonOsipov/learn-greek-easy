/**
 * I18NG-02 — en↔ru deep key-path parity across ALL 17 namespaces.
 *
 * Asserts every namespace has identical deep key-paths in en/ and ru/, AFTER
 * normalizing i18next CLDR plural suffixes (_zero|_one|_two|_few|_many|_other)
 * — Russian has more plural forms than English, so we compare plural FAMILIES,
 * not exact suffix sets.
 *
 * PARITY-ONLY. i18next-parser orphan/unused-key detection is DEFERRED: the ~128
 * dynamic t() callsites make static unused-key detection impractical without a
 * hand-maintained allowlist; tracked as a follow-up, NOT in this story.
 *
 * KNOWN_DRIFT: 59 pre-existing admin paths (ADMIN2-13, explicitly OUT OF SCOPE
 * for INFRA-06). Subtracted before asserting, so the suite is GREEN now but
 * FAILS on any NEW missing key in any namespace. The set must only ever SHRINK
 * — the stale-entry guard test below enforces that.
 */
import { describe, it, expect } from 'vitest';

const enMods = import.meta.glob('../locales/en/*.json', { eager: true });
const ruMods = import.meta.glob('../locales/ru/*.json', { eager: true });

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function flatten(obj: Record<string, unknown>, prefix = '', out = new Set<string>()): Set<string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, key, out);
    } else {
      out.add(key.replace(PLURAL_SUFFIX, ''));
    }
  }
  return out;
}
function nsName(path: string): string {
  return path.replace(/^.*\/([^/]+)\.json$/, '$1');
}
function bundle(mods: Record<string, unknown>): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {};
  for (const [p, mod] of Object.entries(mods)) {
    map[nsName(p)] = flatten((mod as { default: Record<string, unknown> }).default);
  }
  return map;
}

const KNOWN_DRIFT: ReadonlySet<string> = new Set([
  // en-only (57):
  'admin:decks.breadcrumb.decks',
  'admin:decks.statusPremium',
  'admin:decks.table.cards',
  'admin:decks.table.deck',
  'admin:decks.table.lastEdit',
  'admin:decks.table.owner',
  'admin:decks.table.type',
  'admin:news.drawer.allChecksPassed',
  'admin:news.drawer.audio.a2Narration',
  'admin:news.drawer.audio.b1Narration',
  'admin:news.drawer.audio.b1NotShipping',
  'admin:news.drawer.audio.b2Narration',
  'admin:news.drawer.audio.generatedFrom',
  'admin:news.drawer.audio.notGeneratedYet',
  'admin:news.drawer.audio.pauseLabel',
  'admin:news.drawer.audio.playLabel',
  'admin:news.drawer.audio.regenerate',
  'admin:news.drawer.cancel',
  'admin:news.drawer.country.cyprus',
  'admin:news.drawer.country.greece',
  'admin:news.drawer.country.world',
  'admin:news.drawer.dirty.body',
  'admin:news.drawer.dirty.cancel',
  'admin:news.drawer.dirty.discardAndContinue',
  'admin:news.drawer.dirty.saveAndContinue',
  'admin:news.drawer.dirty.title',
  'admin:news.drawer.image.altText',
  'admin:news.drawer.image.helper',
  'admin:news.drawer.image.invalidUrl',
  'admin:news.drawer.image.kicker',
  'admin:news.drawer.image.photoCredit',
  'admin:news.drawer.image.sourceUrl',
  'admin:news.drawer.linkedSituation.emptyText',
  'admin:news.drawer.linkedSituation.generate',
  'admin:news.drawer.linkedSituation.helper',
  'admin:news.drawer.linkedSituation.kicker',
  'admin:news.drawer.linkedSituation.regenerate',
  'admin:news.drawer.linkedSituation.unlink',
  'admin:news.drawer.linkedSituationLabel',
  'admin:news.drawer.published',
  'admin:news.drawer.publishedOn',
  'admin:news.drawer.regenerateTranslations',
  'admin:news.drawer.save',
  'admin:news.drawer.saving',
  'admin:news.drawer.tabs.audio',
  'admin:news.drawer.tabs.body',
  'admin:news.drawer.tabs.image',
  'admin:news.drawer.tabs.linkedSituation',
  'admin:news.drawer.tabs.translations',
  'admin:news.drawer.title',
  'admin:news.drawer.translations.hintEl',
  'admin:news.drawer.translations.hintEn',
  'admin:news.drawer.translations.hintRu',
  'admin:news.drawer.translations.titleEl',
  'admin:news.drawer.translations.titleEn',
  'admin:news.drawer.translations.titleRu',
  'admin:news.drawer.updatedRelative',
  // ru-only (2):
  'admin:tabs.newsComingSoon',
  'admin:tabs.newsComingSoonDescription',
]);

describe('i18n en↔ru deep key-path parity (all namespaces)', () => {
  const en = bundle(enMods);
  const ru = bundle(ruMods);
  const namespaces = Object.keys(en).sort();

  it('en and ru expose the same 17 namespaces', () => {
    expect(namespaces).toEqual(Object.keys(ru).sort());
    expect(namespaces).toHaveLength(17);
  });

  for (const ns of namespaces) {
    it(`"${ns}" has en↔ru key parity (minus known drift)`, () => {
      const enKeys = en[ns],
        ruKeys = ru[ns];
      const enNotRu = [...enKeys].filter((k) => !ruKeys.has(k)).map((k) => `${ns}:${k}`);
      const ruNotEn = [...ruKeys].filter((k) => !enKeys.has(k)).map((k) => `${ns}:${k}`);
      const unexpected = [...enNotRu, ...ruNotEn].filter((p) => !KNOWN_DRIFT.has(p)).sort();
      expect(
        unexpected,
        `New en↔ru drift in "${ns}" (add the missing key to the OTHER locale; ` +
          `do NOT add it to KNOWN_DRIFT):\n${unexpected.join('\n')}`
      ).toEqual([]);
    });
  }

  it('KNOWN_DRIFT has no stale entries (every listed path still drifts)', () => {
    const live = new Set<string>();
    for (const ns of namespaces) {
      const e = en[ns],
        r = ru[ns];
      for (const k of e) if (!r.has(k)) live.add(`${ns}:${k}`);
      for (const k of r) if (!e.has(k)) live.add(`${ns}:${k}`);
    }
    const stale = [...KNOWN_DRIFT].filter((p) => !live.has(p)).sort();
    expect(
      stale,
      `Stale KNOWN_DRIFT entries (now fixed — remove them):\n${stale.join('\n')}`
    ).toEqual([]);
  });
});
