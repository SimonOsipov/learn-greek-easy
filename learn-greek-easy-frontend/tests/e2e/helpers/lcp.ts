/**
 * LCP Measurement Helper — captureLCP(page)
 *
 * Installs a PerformanceObserver for `largest-contentful-paint` via
 * page.addInitScript() (before navigation) to capture the final LCP entry.
 * Returns a structured result with the LCP timing, element selector, resource
 * URL, and a flag indicating whether the LCP element is the news <img>.
 *
 * Usage:
 *   await page.addInitScript(/* installed by captureLCP via helper internal *\/);
 *   // captureLCP must be called BEFORE page.goto() — it calls addInitScript internally.
 *   // Typical pattern: call captureLCP AFTER navigation+settle; it internally
 *   // installs the observer on first call and reads results after navigation.
 *
 * NOTE: addInitScript must be called before navigation. captureLCP installs it
 * during its first call but you must call captureLCP BEFORE the page.goto().
 * The recommended usage is:
 *   const captureFn = await installLCPObserver(page); // before goto
 *   await page.goto('/dashboard');
 *   // ... wait for settle
 *   const result = await captureFn();
 *
 * For simplicity, captureLCP() accepts a page where the observer is already
 * installed (via addInitScript before navigation) and reads the accumulated
 * entries after navigation has settled.
 */

import { type Page } from '@playwright/test';

export interface LCPResourceTiming {
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  secureConnectionStart: number;
  /** DNS lookup duration (ms) */
  dnsMs: number;
  /** TCP + TLS connection duration (ms) */
  connectMs: number;
}

export interface LCPResult {
  /** LCP time in ms — renderTime || loadTime || startTime from the entry */
  lcpMs: number;
  /** Stable CSS selector for the LCP element (prefers data-testid, then id, then tag+classes) */
  selector: string;
  /** URL of the LCP resource (from the PerformanceLargestContentfulPaint entry) */
  url: string;
  /** Tag name of the LCP element, e.g. "IMG", "DIV" */
  tagName: string;
  /**
   * true if the LCP element is the news <img>:
   *   - tagName === "IMG"
   *   - AND (element is inside [data-testid^="news-card-"] OR url host contains "storageapi.dev")
   */
  isNewsImage: boolean;
  /** PerformanceResourceTiming segments for the LCP URL (may be null if no matching entry) */
  resourceTiming: LCPResourceTiming | null;
  /** Human-readable branch decision for the PERF-04 gate check */
  branchMessage: string;
}

/**
 * Install the LCP PerformanceObserver init script on the page.
 *
 * MUST be called BEFORE page.goto() — addInitScript only affects future navigations.
 *
 * The observer tags each new LCP candidate's element with
 * `data-lcp-candidate="1"` (overwriting on each new entry so only the
 * current winner is tagged), and accumulates entries in window.__lcpEntries.
 */
export async function installLCPObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Initialize the entry array
    (window as unknown as Record<string, unknown>)['__lcpEntries'] = [];

    const entries = (window as unknown as Record<string, unknown>)['__lcpEntries'] as Array<{
      startTime: number;
      renderTime: number;
      loadTime: number;
      size: number;
      url: string;
      id: string;
      tagName: string;
    }>;

    // Inline interface for the non-standard LargestContentfulPaint entry type
    interface LCPEntry extends PerformanceEntry {
      renderTime: number;
      loadTime: number;
      size: number;
      url: string;
      id: string;
      element: Element | null;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const lcp = entry as LCPEntry;

          // Remove the candidate tag from any previously tagged element
          const prev = document.querySelector('[data-lcp-candidate]');
          if (prev) {
            prev.removeAttribute('data-lcp-candidate');
          }

          // Tag the current LCP element so we can resolve it later
          if (lcp.element) {
            lcp.element.setAttribute('data-lcp-candidate', '1');
          }

          entries.push({
            startTime: lcp.startTime,
            renderTime: lcp.renderTime,
            loadTime: lcp.loadTime,
            size: lcp.size,
            url: lcp.url,
            id: lcp.id,
            tagName: lcp.element?.tagName ?? '',
          });
        }
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // PerformanceLargestContentfulPaint not supported in this browser — entries stays empty
    }
  });
}

/**
 * Resolve the tagged LCP element to a stable CSS selector (in page context).
 *
 * Strategy (in order):
 *   1. [data-testid="<value>"]
 *   2. #<id>
 *   3. <tagName>.<first-two-class-tokens>
 *   4. Fallback: [data-lcp-candidate]
 */
async function resolveLCPSelector(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const el = document.querySelector('[data-lcp-candidate]');
    if (!el) return '[data-lcp-candidate]';

    const testId = el.getAttribute('data-testid');
    if (testId) return `[data-testid="${testId}"]`;

    if (el.id) return `#${el.id}`;

    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList)
      .slice(0, 2)
      .filter((c) => c.length > 0);
    if (classes.length > 0) return `${tag}.${classes.join('.')}`;

    return tag;
  });
}

/**
 * Check whether the tagged LCP element lives inside a news card.
 */
async function isInsideNewsCard(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const el = document.querySelector('[data-lcp-candidate]');
    if (!el) return false;
    return el.closest('[data-testid^="news-card-"]') !== null;
  });
}

/**
 * Capture LCP data after the page has settled.
 *
 * Prerequisites:
 *   - installLCPObserver(page) was called BEFORE page.goto()
 *   - The page has navigated and settled (networkidle + quiet window elapsed)
 *
 * @param page - Playwright Page object after navigation has settled
 * @returns LCPResult with all measurement fields populated
 */
export async function captureLCP(page: Page): Promise<LCPResult> {
  // Read accumulated LCP entries from the page
  const rawEntries = await page.evaluate(() => {
    return (window as unknown as Record<string, unknown>)['__lcpEntries'] as Array<{
      startTime: number;
      renderTime: number;
      loadTime: number;
      size: number;
      url: string;
      id: string;
      tagName: string;
    }>;
  });

  if (!rawEntries || rawEntries.length === 0) {
    return {
      lcpMs: 0,
      selector: '(no LCP entry captured)',
      url: '',
      tagName: '',
      isNewsImage: false,
      resourceTiming: null,
      branchMessage:
        'WARNING: No LCP entries captured. Observer may not have fired or browser does not support LCP.',
    };
  }

  // Take the LAST entry — the final LCP winner
  const last = rawEntries[rawEntries.length - 1];
  const lcpMs = last.renderTime || last.loadTime || last.startTime;
  const tagName = last.tagName.toUpperCase();
  const lcpUrl = last.url;

  // Resolve stable CSS selector for the tagged element
  const selector = await resolveLCPSelector(page);

  // Check if inside a news card
  const insideNewsCard = await isInsideNewsCard(page);

  // Determine if this is the news image
  let isNewsImage = false;
  if (tagName === 'IMG') {
    const urlHostIsStorage = lcpUrl.includes('storageapi.dev');
    isNewsImage = insideNewsCard || urlHostIsStorage;
  }

  // Optionally grab PerformanceResourceTiming for the LCP URL
  let resourceTiming: LCPResourceTiming | null = null;
  if (lcpUrl) {
    resourceTiming = await page.evaluate((url) => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const match = entries.find((e) => e.name === url);
      if (!match) return null;
      return {
        domainLookupStart: match.domainLookupStart,
        domainLookupEnd: match.domainLookupEnd,
        connectStart: match.connectStart,
        connectEnd: match.connectEnd,
        secureConnectionStart: match.secureConnectionStart,
        dnsMs: match.domainLookupEnd - match.domainLookupStart,
        connectMs: match.connectEnd - match.connectStart,
      };
    }, lcpUrl);
  }

  // Branch message for the PERF-04 AC#3 gate
  const branchMessage = isNewsImage
    ? `CONFIRMED: LCP element is the news image (${selector}, ${lcpMs.toFixed(1)}ms, url=${lcpUrl}) → PERF-04-02..05 apply`
    : `REFUTED: LCP element is ${selector} (${tagName}), NOT the news image → STOP per AC#3; PERF-04-02..05 do not apply`;

  return {
    lcpMs,
    selector,
    url: lcpUrl,
    tagName,
    isNewsImage,
    resourceTiming,
    branchMessage,
  };
}
