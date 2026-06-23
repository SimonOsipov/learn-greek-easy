// src/components/situations/__tests__/situationToCoverProps.test.ts
//
// QA-authored unit tests for the situationToCoverProps adapter (SIT-27-01).
// Verifies field mapping, DOMAIN_GRADIENT routing, fallback, and edge cases.
// The adapter is a pure function — no mocks needed.

import { describe, it, expect } from 'vitest';
import { situationToCoverProps } from '../situationToCoverProps';
import type { SituationCoverInput } from '../situationToCoverProps';

// ── Valid canonical DeckLevel / DeckCategory sets (must match deckGradient maps) ──
const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
const VALID_CATEGORIES = ['vocabulary', 'grammar', 'phrases', 'culture'] as const;

// ── Shared minimal fixture ────────────────────────────────────────────────────
const base: SituationCoverInput = {
  id: 'sit-001',
  domain: null,
  source_image_url: null,
  source_image_variants: undefined,
};

// ─────────────────────────────────────────────────────────────────────────────
describe('situationToCoverProps', () => {
  // AC-1: output always contains id
  it('preserves the situation id unchanged', () => {
    const result = situationToCoverProps({ ...base, id: 'abc-123' });
    expect(result.id).toBe('abc-123');
  });

  // ── Field mapping: source_image_url ───────────────────────────────────────
  describe('source_image_url → coverImageUrl', () => {
    it('maps a string URL to coverImageUrl', () => {
      const result = situationToCoverProps({
        ...base,
        source_image_url: 'https://cdn.example.com/img.jpg',
      });
      expect(result.coverImageUrl).toBe('https://cdn.example.com/img.jpg');
    });

    it('coerces null to undefined (deck types use optional, not null)', () => {
      const result = situationToCoverProps({ ...base, source_image_url: null });
      expect(result.coverImageUrl).toBeUndefined();
    });

    it('coerces undefined to undefined', () => {
      const result = situationToCoverProps({ ...base, source_image_url: undefined });
      expect(result.coverImageUrl).toBeUndefined();
    });
  });

  // ── Field mapping: source_image_variants ─────────────────────────────────
  describe('source_image_variants → coverImageVariants', () => {
    it('maps a variants Record to coverImageVariants', () => {
      const variants = {
        400: 'https://cdn.example.com/400.jpg',
        800: 'https://cdn.example.com/800.jpg',
      };
      const result = situationToCoverProps({ ...base, source_image_variants: variants });
      expect(result.coverImageVariants).toEqual(variants);
    });

    it('passes undefined through when source_image_variants is undefined (list-item path)', () => {
      const result = situationToCoverProps({ ...base, source_image_variants: undefined });
      expect(result.coverImageVariants).toBeUndefined();
    });

    it('coerces null variants to undefined', () => {
      const result = situationToCoverProps({ ...base, source_image_variants: null });
      expect(result.coverImageVariants).toBeUndefined();
    });
  });

  // ── DOMAIN_GRADIENT mapping ───────────────────────────────────────────────
  describe('domain → {level, category} via DOMAIN_GRADIENT', () => {
    const cases: Array<{ domain: string; level: string; category: string }> = [
      { domain: 'news', level: 'B1', category: 'culture' },
      { domain: 'everyday', level: 'A2', category: 'phrases' },
      { domain: 'travel', level: 'A2', category: 'vocabulary' },
      { domain: 'business', level: 'B2', category: 'vocabulary' },
      { domain: 'culture', level: 'B1', category: 'culture' },
    ];

    for (const { domain, level, category } of cases) {
      it(`maps domain '${domain}' → level='${level}', category='${category}'`, () => {
        const result = situationToCoverProps({ ...base, domain });
        expect(result.level).toBe(level);
        expect(result.category).toBe(category);
      });
    }

    // Canonical enum guard: every emitted level and category must be in the deckGradient maps
    it('emits only canonical DeckLevel values (A1|A2|B1|B2) for all known domains', () => {
      const domains = ['news', 'everyday', 'travel', 'business', 'culture'];
      for (const domain of domains) {
        const { level } = situationToCoverProps({ ...base, domain });
        expect(VALID_LEVELS).toContain(level);
      }
    });

    it('emits only canonical DeckCategory values for all known domains', () => {
      const domains = ['news', 'everyday', 'travel', 'business', 'culture'];
      for (const domain of domains) {
        const { category } = situationToCoverProps({ ...base, domain });
        expect(VALID_CATEGORIES).toContain(category);
      }
    });
  });

  // ── Fallback: unknown / missing domain ───────────────────────────────────
  describe('fallback gradient for unknown or missing domain', () => {
    it('falls back to B1/culture for an unknown domain string', () => {
      const result = situationToCoverProps({ ...base, domain: 'sports' });
      expect(result.level).toBe('B1');
      expect(result.category).toBe('culture');
    });

    it('falls back to B1/culture when domain is null', () => {
      const result = situationToCoverProps({ ...base, domain: null });
      expect(result.level).toBe('B1');
      expect(result.category).toBe('culture');
    });

    it('falls back to B1/culture when domain is undefined', () => {
      const result = situationToCoverProps({ ...base, domain: undefined });
      expect(result.level).toBe('B1');
      expect(result.category).toBe('culture');
    });

    it('falls back to B1/culture for empty string domain', () => {
      // Empty string is a defined key lookup miss — should fall back like unknown
      const result = situationToCoverProps({ ...base, domain: '' });
      expect(result.level).toBe('B1');
      expect(result.category).toBe('culture');
    });

    it('fallback level is a canonical DeckLevel (safe for deckGradient)', () => {
      const { level } = situationToCoverProps({ ...base, domain: null });
      expect(VALID_LEVELS).toContain(level);
    });

    it('fallback category is a canonical DeckCategory (safe for deckGradient)', () => {
      const { category } = situationToCoverProps({ ...base, domain: null });
      expect(VALID_CATEGORIES).toContain(category);
    });
  });

  // ── Output shape: required fields always present ─────────────────────────
  describe('output shape', () => {
    it('always returns id, level, and category (never undefined)', () => {
      const result = situationToCoverProps(base);
      expect(result.id).toBeDefined();
      expect(result.level).toBeDefined();
      expect(result.category).toBeDefined();
    });

    it('does NOT include C1 or C2 as a level (guard against situation.ts DeckLevel leak)', () => {
      // This would break deckGradient's LEVEL_SHIFT which only maps A1-B2
      const allDomains = [
        'news',
        'everyday',
        'travel',
        'business',
        'culture',
        null,
        undefined,
        'unknown',
      ];
      for (const domain of allDomains) {
        const result = situationToCoverProps({ ...base, domain: domain ?? null });
        expect(['C1', 'C2']).not.toContain(result.level);
      }
    });
  });

  // ── Combined full-detail path (list item: no variants) ────────────────────
  it('handles a realistic list-item situation (no variants, known domain)', () => {
    const result = situationToCoverProps({
      id: 'sit-42',
      domain: 'travel',
      source_image_url: 'https://cdn.example.com/travel.jpg',
      source_image_variants: undefined, // absent on list items until SIT-27-02
    });
    expect(result).toEqual({
      id: 'sit-42',
      level: 'A2',
      category: 'vocabulary',
      coverImageUrl: 'https://cdn.example.com/travel.jpg',
      coverImageVariants: undefined,
    });
  });

  // ── Combined full-detail path (detail response: has variants) ─────────────
  it('handles a realistic detail-response situation (with variants, unknown domain → fallback)', () => {
    const variants = { 400: 'https://cdn/400.jpg', 800: 'https://cdn/800.jpg' };
    const result = situationToCoverProps({
      id: 'sit-99',
      domain: 'cooking', // not in DOMAIN_GRADIENT → fallback
      source_image_url: 'https://cdn.example.com/cooking.jpg',
      source_image_variants: variants,
    });
    expect(result).toEqual({
      id: 'sit-99',
      level: 'B1',
      category: 'culture',
      coverImageUrl: 'https://cdn.example.com/cooking.jpg',
      coverImageVariants: variants,
    });
  });
});
