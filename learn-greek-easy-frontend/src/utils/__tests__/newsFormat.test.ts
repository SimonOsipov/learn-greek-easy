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
// NWS8-04 RED tests: localized long-month format
//
// The current implementation uses month:'short' and does not propagate the
// locale to callers.  These tests assert the DESIRED behaviour (month:'long'
// with the supplied locale) and will fail until the implementation is updated.
//
// NOTE: May ('мая') is identical in RU short and long forms, so we use
// January ('янв.' short vs 'января' long) to produce a guaranteed RED for
// the RU locale case.  The subtask spec example uses May to show the target
// format; we assert the same structural requirements with a month that
// distinguishes short from long.
// ---------------------------------------------------------------------------

describe('formatPublicationDate — NWS8-04: localized long-month (RED)', () => {
  // formats_long_month_ru
  // 'month: short' + locale 'ru' renders 'янв.' — long form renders 'января'.
  it('formats_long_month_ru: locale ru, bare date → long Russian month name', () => {
    const result = formatPublicationDate('2026-01-26', 'ru');
    // 'января' is the long-form genitive of January in Russian.
    // With month:'short' this would be 'янв.' — assertion will fail RED.
    expect(result).toContain('января');
    expect(result).toContain('26');
    expect(result).toContain('2026');
  });

  // formats_long_month_en
  // 'month: short' + locale 'en' renders 'Jan' — long form renders 'January'.
  it('formats_long_month_en: locale en, bare date → long English month name', () => {
    const result = formatPublicationDate('2026-01-26', 'en');
    // 'January' is the long form; 'Jan' is the short form.
    // With month:'short' this would be 'Jan' — assertion will fail RED.
    expect(result).toContain('January');
    expect(result).toContain('26');
    expect(result).toContain('2026');
  });

  // utc_safe_bare_date — already covered by the existing UTC-shift test above;
  // not duplicated here per F6 instructions.

  // invalid_input_returns_empty — '' and 'not-a-date' are already covered in
  // the first describe block above; not duplicated here per F6 instructions.

  // full_timestamp_long_month
  // Full ISO timestamp with locale 'en' and January → 'January' (long) not 'Jan' (short).
  it('full_timestamp_long_month: full ISO timestamp, locale en → long month name', () => {
    const result = formatPublicationDate('2026-01-26T10:00:00Z', 'en');
    // With month:'short' this renders 'Jan' — assertion will fail RED.
    expect(result).toContain('January');
    expect(result).toContain('2026');
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
