import { describe, it, expect } from 'vitest';
import { getDeckBackgroundStyle } from '../deckBackground';

describe('getDeckBackgroundStyle', () => {
  it('returns undefined when called with undefined', () => {
    expect(getDeckBackgroundStyle(undefined)).toBeUndefined();
  });

  it('returns undefined when called with empty string', () => {
    expect(getDeckBackgroundStyle('')).toBeUndefined();
  });

  it('returns an object when given a URL', () => {
    const result = getDeckBackgroundStyle('https://example.com/image.jpg');
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('backgroundImage contains the provided URL', () => {
    const url = 'https://example.com/image.jpg';
    const result = getDeckBackgroundStyle(url);
    expect(result?.backgroundImage).toContain(url);
  });

  it('backgroundImage contains hsl(var(--card)) for theme support', () => {
    const result = getDeckBackgroundStyle('https://example.com/image.jpg');
    expect(result?.backgroundImage).toContain('hsl(var(--card))');
  });

  it('backgroundImage contains linear-gradient for the overlay', () => {
    const result = getDeckBackgroundStyle('https://example.com/image.jpg');
    expect(result?.backgroundImage).toContain('linear-gradient');
  });

  it('backgroundSize is cover', () => {
    const result = getDeckBackgroundStyle('https://example.com/image.jpg');
    expect(result?.backgroundSize).toBe('cover');
  });

  it('backgroundPosition is center', () => {
    const result = getDeckBackgroundStyle('https://example.com/image.jpg');
    expect(result?.backgroundPosition).toBe('center');
  });
});
