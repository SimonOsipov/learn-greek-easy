/**
 * Tests for NewsCard srcset + fallback behavior (PERF-10).
 *
 * Covers:
 * - <img> element rendered (not CSS background-image)
 * - srcSet present when image_variants provided
 * - Falls back gracefully when image_variants null
 * - width/height attributes present (CLS prevention)
 * - loading="lazy" attribute present
 */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

import { NewsCard } from '../NewsCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, fb?: string) => fb ?? k }),
}));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/newsAudioCoordinator', () => ({
  registerActivePlayer: vi.fn(),
  clearActivePlayer: vi.fn(),
}));
vi.mock('@/lib/waveform', () => ({
  generateBars: (count: number) => Array.from({ length: count }, (_, i) => (i + 1) / count),
}));

const baseArticle: NewsItemResponse = {
  id: 'news-1',
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

describe('NewsCard srcset (PERF-10)', () => {
  it('renders a real <img> element (not just CSS background)', () => {
    const article = { ...baseArticle, image_url: 'https://cdn.example.com/original.jpg' };
    render(<NewsCard article={article} newsLang="el" />);
    // The <img> should be present in the DOM
    const img = document.querySelector('img[aria-hidden="true"]');
    expect(img).not.toBeNull();
  });

  it('img has srcSet when image_variants provided', () => {
    const article = {
      ...baseArticle,
      image_variants: {
        400: 'https://cdn.example.com/img_400w.webp',
        800: 'https://cdn.example.com/img_800w.webp',
        1600: 'https://cdn.example.com/img_1600w.webp',
      },
    };
    render(<NewsCard article={article} newsLang="el" />);
    const img = document.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
    expect(img?.srcset).toBeTruthy();
    expect(img?.srcset).toContain('400w');
  });

  it('img falls back gracefully when image_variants null', () => {
    render(<NewsCard article={{ ...baseArticle, image_variants: null }} newsLang="el" />);
    const img = document.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    // No error; srcset absent or empty
    expect(!img?.srcset || img.srcset === '').toBe(true);
  });

  it('img has intrinsic width and height (CLS prevention)', () => {
    render(<NewsCard article={baseArticle} newsLang="el" />);
    const img = document.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
    expect(img?.getAttribute('width')).toBeTruthy();
    expect(img?.getAttribute('height')).toBeTruthy();
  });

  it('img has loading="lazy"', () => {
    render(<NewsCard article={baseArticle} newsLang="el" />);
    const img = document.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
    expect(img?.getAttribute('loading')).toBe('lazy');
  });

  it('img has no fetchPriority when eager is absent (default lazy)', () => {
    render(<NewsCard article={baseArticle} newsLang="el" />);
    const img = document.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
    // fetchPriority must NOT be set to "high" when eager is absent/false
    expect(img?.getAttribute('fetchpriority')).not.toBe('high');
  });

  it('no <img> rendered when image_url is null', () => {
    render(<NewsCard article={{ ...baseArticle, image_url: null }} newsLang="el" />);
    const img = document.querySelector('img[aria-hidden="true"]');
    expect(img).toBeNull();
  });
});

// PERF-04-02: eager prop wires loading="eager" + fetchPriority="high"
describe('NewsCard eager loading (PERF-04-02)', () => {
  const articleWithVariants: NewsItemResponse = {
    ...{
      id: 'news-eager',
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
    },
    image_variants: {
      400: 'https://cdn.example.com/img_400w.webp',
      800: 'https://cdn.example.com/img_800w.webp',
      1600: 'https://cdn.example.com/img_1600w.webp',
    },
  } as NewsItemResponse;

  it('sets loading="eager" and fetchPriority="high" when eager prop is true', () => {
    // Cast through unknown to avoid TS error before the prop is added to NewsCardProps.
    // The test will fail at ASSERTION level (loading is "lazy", not "eager") — not at compile/collection level.
    const props = { article: articleWithVariants, newsLang: 'el' as const, eager: true };
    render(<NewsCard {...(props as Parameters<typeof NewsCard>[0])} />);
    const img = document.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('fetchpriority')).toBe('high');
  });

  it('retains loading="lazy" and no fetchPriority="high" when eager is false', () => {
    const props = { article: articleWithVariants, newsLang: 'el' as const, eager: false };
    render(<NewsCard {...(props as Parameters<typeof NewsCard>[0])} />);
    const img = document.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('fetchpriority')).not.toBe('high');
  });
});
