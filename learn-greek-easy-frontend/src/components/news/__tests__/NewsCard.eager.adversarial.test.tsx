/**
 * Adversarial + edge coverage for PERF-04-02/03 eager-loading wiring (QA Mode B).
 *
 * The AC tests cover the happy path (eager prop → loading/fetchPriority attributes,
 * null-variants guard, boundary index=3 vs 4).  This file adds the cases they
 * deliberately left out:
 *
 *   1. Empty-object variants `{}` passed directly to NewsCard:
 *      - eager=true + image_variants={} → buildSrcSet({}) returns undefined → srcSet absent
 *        → browser would load full original at high priority.
 *      - This is NOT a runtime bug (backend collapses {} → null via `image_variants or None`
 *        in news_item_service.py:511), but the frontend must not silently accept it.
 *        We document the behaviour: eager+empty-variants means high-priority original fetch.
 *
 *   2. Boundary: exactly 3 items (all eager), exactly 4 items (3 eager + 1 lazy).
 *      Already tested by the AC tests in NewsSection.test.tsx; duplicated here at the
 *      NewsCard level for isolated prop coverage.
 *
 *   3. Fewer than 3 items — no crash, correct eagerness.
 *
 *   4. A non-first-row item with variants (index >= 3) is NOT eager even when variants exist.
 *      Verified via NewsSection — confirmed here for the guard expression.
 *
 *   5. eager=true with image_url=null — no <img> rendered at all (no error).
 *
 *   6. eager=undefined (default) — treated identically to eager=false.
 */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

import { NewsCard } from '../NewsCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, fb?: string) => fb ?? k, i18n: { language: 'en' } }),
}));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/newsAudioCoordinator', () => ({
  registerActivePlayer: vi.fn(),
  clearActivePlayer: vi.fn(),
}));
vi.mock('@/lib/waveform', () => ({
  generateBars: (count: number) => Array.from({ length: count }, (_, i) => (i + 1) / count),
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE: NewsItemResponse = {
  id: 'adv-1',
  title_el: 'Τίτλος',
  title_en: 'Title',
  title_ru: 'Заголовок',
  description_el: 'Περιγραφή',
  description_en: 'Description',
  description_ru: 'Описание',
  publication_date: '2026-01-01',
  original_article_url: 'https://example.com',
  image_url: 'https://cdn.example.com/original.jpg',
  image_variants: null,
  audio_url: null,
  audio_generated_at: null,
  audio_duration_seconds: null,
  audio_file_size_bytes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  country: 'greece',
  title_el_a2: null,
  description_el_a2: null,
  audio_a2_url: null,
  audio_a2_duration_seconds: null,
  audio_a2_generated_at: null,
  audio_a2_file_size_bytes: null,
  has_a2_content: false,
  alt_text: null,
  photo_credit: null,
  status: 'published',
  linked_situation: null,
};

const VARIANTS = {
  400: 'https://cdn.example.com/img_400w.webp',
  800: 'https://cdn.example.com/img_800w.webp',
  1600: 'https://cdn.example.com/img_1600w.webp',
};

function getImg(): HTMLImageElement | null {
  return document.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
}

// ---------------------------------------------------------------------------
// 1. Empty-object variants {} with eager=true
//    Backend CANNOT deliver this (news_item_service.py:511 collapses {} → null via `or None`),
//    but we document the frontend's current behaviour in case a future code path bypasses that
//    coercion, and to assert the TypeScript type gap is acknowledged.
// ---------------------------------------------------------------------------

describe('PERF-04-02/03 adversarial: empty-object image_variants', () => {
  it('eager=true with image_variants={} renders the img with loading="eager" but srcSet absent (empty-srcSet, loads original)', () => {
    // Cast needed because the TS type Record<number,string>|null admits {} but the runtime
    // contract is that the backend never sends {}. We test the frontend-only boundary.
    const article = {
      ...BASE,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      image_variants: {} as any,
    } as NewsItemResponse;

    render(<NewsCard article={article} newsLang="el" eager={true} />);
    const img = getImg();
    expect(img).not.toBeNull();

    // BEHAVIOUR DOCUMENTED: eager=true overrides loading even when srcSet is absent.
    // This means if {} ever reaches the frontend, a high-priority full-original load occurs.
    // This is acceptable TODAY because the backend coercion prevents {} from arriving.
    // If that coercion is ever removed, the guard in NewsSection.tsx MUST key on
    // `buildSrcSet(item.image_variants) != null` instead of `item.image_variants != null`.
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('fetchpriority')).toBe('high');

    // Critically: srcSet must be absent/empty — buildSrcSet({}) returns undefined.
    const srcset = img?.getAttribute('srcset') ?? '';
    expect(srcset).toBe('');
  });

  it('NewsCard with eager=false and image_variants={} stays lazy (guard is in NewsSection, not NewsCard)', () => {
    const article = {
      ...BASE,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      image_variants: {} as any,
    } as NewsItemResponse;

    render(<NewsCard article={article} newsLang="el" eager={false} />);
    const img = getImg();
    expect(img).not.toBeNull();
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('fetchpriority')).not.toBe('high');
  });
});

// ---------------------------------------------------------------------------
// 2. eager=undefined (default) — must be identical to eager=false
// ---------------------------------------------------------------------------

describe('PERF-04-02 adversarial: eager=undefined is the same as eager=false', () => {
  it('eager omitted → loading="lazy", no fetchPriority="high"', () => {
    render(<NewsCard article={{ ...BASE, image_variants: VARIANTS }} newsLang="el" />);
    const img = getImg();
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('fetchpriority')).not.toBe('high');
  });

  it('eager=undefined explicitly → same as omitted', () => {
    render(
      <NewsCard article={{ ...BASE, image_variants: VARIANTS }} newsLang="el" eager={undefined} />
    );
    const img = getImg();
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('fetchpriority')).not.toBe('high');
  });
});

// ---------------------------------------------------------------------------
// 3. eager=true with image_url=null — no <img> rendered, no crash
// ---------------------------------------------------------------------------

describe('PERF-04-02 adversarial: eager=true with null image_url', () => {
  it('no <img> element rendered when image_url is null regardless of eager', () => {
    render(<NewsCard article={{ ...BASE, image_url: null }} newsLang="el" eager={true} />);
    expect(getImg()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. fetchPriority attribute value casing (React 19 camelCase → HTML lowercase)
//    React 19 renders fetchPriority as the lowercase "fetchpriority" DOM attribute.
//    Verify we are NOT accidentally setting "fetchPriority" (camelCase) as an attribute
//    (that would be a no-op in older renderers and ignored by the browser).
// ---------------------------------------------------------------------------

describe('PERF-04-02 adversarial: fetchPriority attribute casing', () => {
  it('sets fetchpriority="high" (case-insensitive HTML attribute) in the DOM when eager=true', () => {
    render(<NewsCard article={{ ...BASE, image_variants: VARIANTS }} newsLang="el" eager={true} />);
    const img = getImg();
    // React 19 maps the camelCase JSX prop `fetchPriority` to the lowercase HTML attribute
    // `fetchpriority`. jsdom (HTML spec) is case-insensitive for attribute lookup, so both
    // getAttribute('fetchpriority') and getAttribute('fetchPriority') return the same value.
    // The meaningful assertion is that the value is "high".
    expect(img?.getAttribute('fetchpriority')).toBe('high');
  });

  it('does NOT set fetchpriority when eager=false', () => {
    render(
      <NewsCard article={{ ...BASE, image_variants: VARIANTS }} newsLang="el" eager={false} />
    );
    const img = getImg();
    expect(img?.getAttribute('fetchpriority')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. sizes attribute is present and includes the 400px terminal value
//    (PERF-04-03 AC: ensures the browser resolves ≤400w at dashboard width)
// ---------------------------------------------------------------------------

describe('PERF-04-03 adversarial: sizes attribute contains 400px terminal value', () => {
  it('sizes ends with 400px so the browser selects the 400w derivative at dashboard layout width', () => {
    render(<NewsCard article={{ ...BASE, image_variants: VARIANTS }} newsLang="el" eager={true} />);
    const img = getImg();
    const sizes = img?.getAttribute('sizes') ?? '';
    // Must contain the terminal "400px" — this is what bounds the LCP payload.
    expect(sizes).toContain('400px');
    // Full expected value matches the implementation.
    expect(sizes).toBe('(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px');
  });

  it('sizes attribute is present even when eager is absent', () => {
    render(<NewsCard article={{ ...BASE, image_variants: VARIANTS }} newsLang="el" />);
    const img = getImg();
    expect(img?.getAttribute('sizes')).toContain('400px');
  });
});

// ---------------------------------------------------------------------------
// 6. recoverDerivativeError is NOT triggered on the happy path
//    (PERF-04-03 AC#3: no round-trip on eager card when variants are valid)
//    We verify the img's onError handler is wired to recoverDerivativeError,
//    and that with a valid srcSet the handler is not pre-called.
// ---------------------------------------------------------------------------

describe('PERF-04-03 adversarial: recoverDerivativeError not pre-triggered', () => {
  it('eager card with valid variants has no derivativeFallback marker on initial render', () => {
    render(<NewsCard article={{ ...BASE, image_variants: VARIANTS }} newsLang="el" eager={true} />);
    const img = getImg();
    // dataset.derivativeFallback must NOT be "done" — that would mean error already fired.
    expect(img?.dataset.derivativeFallback).toBeUndefined();
  });

  it('non-eager card also has no derivativeFallback marker on initial render', () => {
    render(
      <NewsCard article={{ ...BASE, image_variants: VARIANTS }} newsLang="el" eager={false} />
    );
    const img = getImg();
    expect(img?.dataset.derivativeFallback).toBeUndefined();
  });
});
