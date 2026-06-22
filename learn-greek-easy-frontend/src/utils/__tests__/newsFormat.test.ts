import { describe, expect, it } from 'vitest';

import { formatPublicationDate, safeExternalHref } from '../newsFormat';

// ---------------------------------------------------------------------------
// formatPublicationDate
// ---------------------------------------------------------------------------

describe('formatPublicationDate — bare YYYY-MM-DD strings', () => {
  it('returns a string containing the correct day number and year for a bare date', () => {
    const result = formatPublicationDate('2026-06-22', 'en-US');
    // Must contain the day (22) and year (2026) regardless of timezone.
    expect(result).toContain('22');
    expect(result).toContain('2026');
  });

  it('parses 2026-06-22 in UTC — day does not shift to 21 in negative-offset locales', () => {
    // The helper forces timeZone:'UTC' for bare date strings.
    // Any timezone: the date object is created at UTC midnight 2026-06-22,
    // so the formatted output must always show day 22, never 21.
    const result = formatPublicationDate('2026-06-22', 'en-US');
    // Negative check: day 21 must NOT appear (the off-by-one bug being fixed)
    expect(result).not.toMatch(/\b21\b/);
    expect(result).toContain('2026');
  });

  it('formats January date correctly', () => {
    const result = formatPublicationDate('2026-01-01', 'en-US');
    expect(result).toContain('1');
    expect(result).toContain('2026');
  });

  it('returns empty string for null', () => {
    expect(formatPublicationDate(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatPublicationDate(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatPublicationDate('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(formatPublicationDate('   ')).toBe('');
  });

  it('returns empty string for a clearly invalid date string', () => {
    expect(formatPublicationDate('not-a-date')).toBe('');
  });
});

describe('formatPublicationDate — full ISO 8601 timestamps', () => {
  it('returns a non-empty string for a full ISO timestamp', () => {
    const result = formatPublicationDate('2026-06-22T12:00:00Z');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('2026');
  });

  it('returns empty string for a NaN-producing string', () => {
    expect(formatPublicationDate('totally-invalid')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// safeExternalHref
// ---------------------------------------------------------------------------

describe('safeExternalHref — safe URLs pass through', () => {
  it('returns the URL for an https scheme', () => {
    expect(safeExternalHref('https://ekathimerini.com/article/123')).toBe(
      'https://ekathimerini.com/article/123'
    );
  });

  it('returns the URL for an http scheme', () => {
    expect(safeExternalHref('http://example.com/page')).toBe('http://example.com/page');
  });

  it('returns the URL for https with path, query, and hash', () => {
    const url = 'https://sigmalive.com/news/article?id=42#section';
    const result = safeExternalHref(url);
    expect(result).toBeDefined();
    expect(result).toContain('sigmalive.com');
  });
});

describe('safeExternalHref — unsafe URLs return undefined', () => {
  it('returns undefined for javascript: scheme', () => {
    expect(safeExternalHref('javascript:alert(1)')).toBeUndefined();
  });

  it('returns undefined for data: scheme', () => {
    expect(safeExternalHref('data:text/html,<h1>XSS</h1>')).toBeUndefined();
  });

  it('returns undefined for vbscript: scheme', () => {
    expect(safeExternalHref('vbscript:msgbox(1)')).toBeUndefined();
  });

  it('returns undefined for a bare string (unparseable URL)', () => {
    expect(safeExternalHref('not-a-url')).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(safeExternalHref('')).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(safeExternalHref(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(safeExternalHref(undefined)).toBeUndefined();
  });

  it('returns undefined for ftp: scheme (not http/https)', () => {
    expect(safeExternalHref('ftp://files.example.com/file.pdf')).toBeUndefined();
  });
});
