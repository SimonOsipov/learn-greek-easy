/**
 * newsFormat.ts — shared formatting helpers for news article display.
 *
 * formatPublicationDate: Parses YYYY-MM-DD date strings in UTC to avoid the
 *   off-by-one-day error that occurs when `new Date('2026-06-22')` parses as
 *   UTC midnight and then shifts to the previous calendar day in negative-UTC
 *   offset timezones (e.g. US/Americas).
 *
 * safeExternalHref: Guards outbound URLs so that only http/https hrefs are
 *   rendered on anchors or passed to window.open. Rejects javascript:, data:,
 *   and any other scheme that could execute code on click.
 */

/**
 * Format a publication date string for display.
 *
 * When the input is a bare `YYYY-MM-DD` date (no time component), the date is
 * parsed in UTC so the correct calendar day is shown regardless of the user's
 * local timezone offset.  Timestamps with a time component are parsed normally
 * (they already carry an explicit offset or are local-time strings).
 *
 * @param raw    Raw value from the API — typically `YYYY-MM-DD` or ISO 8601.
 * @param locale BCP 47 locale tag (e.g. `"en-US"`); defaults to the browser locale.
 * @returns      Formatted string such as `"Jun 22, 2026"`, or `""` for invalid/empty input.
 */
export function formatPublicationDate(raw: string | null | undefined, locale?: string): string {
  const s = raw?.trim();
  if (!s) return '';

  // Bare date: YYYY-MM-DD — parse in UTC to avoid timezone day-shift.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))));
  }

  // Full timestamp — parse normally (browser applies local offset or Z suffix).
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Return a safe `href` value for an outbound link, or `undefined` if the URL
 * scheme is not `http:` or `https:`.
 *
 * Rejects `javascript:`, `data:`, `vbscript:`, and any other non-http(s) scheme
 * that could be used as an XSS sink when passed directly to an `<a href>` or
 * `window.open`.
 *
 * `transparent` and `currentColor` (CSS values) are not URLs and will be
 * rejected as unparseable.
 *
 * @param url  Admin-supplied URL from the API.
 * @returns    The original URL string when safe, otherwise `undefined`.
 */
export function safeExternalHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
