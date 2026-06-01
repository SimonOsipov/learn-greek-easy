/**
 * Tests for PictureOption srcset + CLS behaviour (PERF-10).
 *
 * Covers:
 * - srcset attribute present when imageVariants supplied
 * - srcset absent (fallback) when imageVariants null
 * - intrinsic width and height attributes set (prevents CLS)
 * - loading="lazy" present
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PictureOption } from '../PictureOption';

// Sentry queue stub — not under test here
vi.mock('@/lib/sentry-queue', () => ({
  getSentry: () => null,
  isSentryLoaded: () => false,
  queueMessage: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const VARIANTS = {
  400: 'https://cdn.example.com/img_400w.webp',
  800: 'https://cdn.example.com/img_800w.webp',
  1600: 'https://cdn.example.com/img_1600w.webp',
};

describe('PictureOption (PERF-10)', () => {
  it('renders img with srcSet when imageVariants provided', () => {
    render(
      <PictureOption
        imageUrl="https://cdn.example.com/original.jpg"
        imageVariants={VARIANTS}
        optionIndex={0}
        exerciseId="ex-1"
        alt="Option 1"
      />
    );
    const img = screen.getByRole('img', { hidden: true });
    expect(img).toHaveAttribute('srcset');
    expect(img.getAttribute('srcset')).toContain('400w');
    expect(img.getAttribute('srcset')).toContain('800w');
    expect(img.getAttribute('srcset')).toContain('1600w');
  });

  it('renders img without srcSet (fallback) when imageVariants null', () => {
    render(
      <PictureOption
        imageUrl="https://cdn.example.com/original.jpg"
        imageVariants={null}
        optionIndex={0}
        exerciseId="ex-2"
        alt="Option 1"
      />
    );
    const img = screen.getByRole('img', { hidden: true });
    // srcSet should be undefined (attribute absent or empty)
    const srcset = img.getAttribute('srcset');
    expect(!srcset || srcset === '').toBe(true);
  });

  it('img has intrinsic width and height for CLS prevention', () => {
    render(
      <PictureOption
        imageUrl="https://cdn.example.com/original.jpg"
        optionIndex={0}
        exerciseId="ex-3"
        alt="Option 1"
      />
    );
    const img = screen.getByRole('img', { hidden: true });
    expect(img).toHaveAttribute('width', '400');
    expect(img).toHaveAttribute('height', '400');
  });

  it('img has loading="lazy"', () => {
    render(
      <PictureOption
        imageUrl="https://cdn.example.com/original.jpg"
        optionIndex={0}
        exerciseId="ex-4"
        alt="Option 1"
      />
    );
    const img = screen.getByRole('img', { hidden: true });
    expect(img).toHaveAttribute('loading', 'lazy');
  });
});
