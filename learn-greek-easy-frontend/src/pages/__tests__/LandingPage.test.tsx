/**
 * WEDGE-13-03 (AC-7 / AC-8) — RED spec, authored pre-implementation.
 *
 * The static per-variant HTML (WEDGE-13-02) becomes the single owner of the
 * landing SEO head. This spec asserts LandingPage's <Helmet> is reduced to
 * EXACTLY the two locale-invariant tags (meta[name=robots], meta[name=author])
 * — every locale-bearing tag (title, description, keywords, canonical, every
 * og:*, every twitter:*, meta[name=language]) must be gone.
 *
 * ── Defect B: "inspect Helmet output" is not implementable as written ──────
 * Real <Helmet> cannot flush to document.head under happy-dom (it throws —
 * see ruRoute.test.tsx's header comment), and mocking it out to avoid that
 * crash destroys the very output this spec needs to assert. `jsdom` is NOT
 * installed, so switching environments is not an option (scope expansion).
 *
 * Fix: mock Helmet to CAPTURE its children instead of discarding them, then
 * enumerate the captured React element tree directly — asserting the closed
 * set, not "robots is present" (which would trivially pass with 17 stragglers
 * still there).
 */

import React from 'react';

import { describe, it, expect, vi } from 'vitest';

import { render } from '@/lib/test-utils';
import LandingPage from '../LandingPage';

const captured = vi.hoisted(() => ({ children: null as React.ReactNode }));

vi.mock('@dr.pogodin/react-helmet', () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => {
    captured.children = children ?? null;
    return null;
  },
}));

/** `type:name|property|rel` for every element Helmet was given as children. */
function enumerateHelmetTags(children: React.ReactNode): string[] {
  return React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((el) => {
      const props = el.props as Record<string, unknown>;
      const key = props.name ?? props.property ?? props.rel;
      return `${String(el.type)}:${String(key)}`;
    });
}

describe('LandingPage Helmet (AC-7 / AC-8)', () => {
  it('landing_helmet_emits_only_robots_and_author', () => {
    render(<LandingPage />);

    // Closed set. Today's Helmet emits 19 tags (title, description, keywords,
    // canonical, 7x og:*, 5x twitter:*, robots, language, author) — this
    // assertion fails on the array itself, not merely on robots'/author's
    // presence, so 17 lingering locale-bearing tags cannot sneak a pass.
    const tags = enumerateHelmetTags(captured.children);
    expect(tags).toEqual(['meta:robots', 'meta:author']);

    const elements = React.Children.toArray(captured.children).filter(React.isValidElement);
    const robotsMeta = elements.find(
      (el) => (el.props as Record<string, unknown>).name === 'robots'
    );
    const authorMeta = elements.find(
      (el) => (el.props as Record<string, unknown>).name === 'author'
    );

    expect((robotsMeta?.props as Record<string, unknown> | undefined)?.content).toBe(
      'index, follow'
    );
    expect((authorMeta?.props as Record<string, unknown> | undefined)?.content).toBe('Greeklish');
  });
});
