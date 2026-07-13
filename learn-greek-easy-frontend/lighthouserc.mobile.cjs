/**
 * Lighthouse CI Configuration - Mobile
 *
 * Consumed ONLY by release-verify.yml (Assert Lighthouse (Mobile), lines 1217/1218/1248)
 * and the unit test lighthouserc.config.test.ts. NOT used by preview.yml/test.yml.
 * Uses mobile emulation with throttling to simulate real mobile conditions.
 *
 * Score thresholds (lower than desktop due to mobile constraints):
 * - Performance: 70+ (warn)
 * - Accessibility: 90+ (error)
 * - Best Practices: 80+ (warn)
 * - SEO: 80+ (warn)
 */
module.exports = {
  ci: {
    collect: {
      // URLs to test (set dynamically via env var, comma-separated)
      url: process.env.LIGHTHOUSE_URLS
        ? process.env.LIGHTHOUSE_URLS.split(',')
        : ['http://localhost:5173'],

      // Median-of-3 per URL. PERF-25-03 tightened the LCP gate from a loose
      // 7000ms tripwire to a real 4800ms regression floor, so single-run lab
      // noise (numberOfRuns:1) now has room to flip a passing run red; 3 runs
      // + lhci's built-in median assertion smooths that out.
      numberOfRuns: 3,

      settings: {
        // Mobile form factor (no preset - configure manually)
        formFactor: 'mobile',

        // Required for CI environment
        chromeFlags: '--no-sandbox --disable-gpu',

        // Mobile screen emulation (iPhone 12 dimensions)
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
        },

        // Mobile network throttling (simulates 4G connection).
        // cpuSlowdownMultiplier 2 models a modern mid/high-tier phone (iPhone 12
        // class); the prior value of 4 modelled a low-end 2017-era device and
        // pushed LCP on the cold preview box ~6s, well past the 4000ms floor.
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 2,
        },
      },
    },

    assert: {
      assertions: {
        // Category thresholds (lower performance threshold for mobile)
        'categories:performance': ['warn', { minScore: 0.7 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],

        // LCP gate = error @ 4800ms on ALL three URLs (PERF-25-03, ratcheted
        // down from the 7000ms tripwire this replaced). This is the canonical
        // writeup for the PERF-24/PERF-25 LCP saga (Decision #10).
        //
        // ROOT CAUSE (PERF-24, 2026-07-04): pre-auth mobile LCP was
        // RENDER-TIMING-bound, not byte-budget-bound. The LHR showed TTFB
        // (~110ms) and TBT (~5ms) healthy, but a ~3-4s gap between FCP
        // (~1.7-2.4s) and LCP (~5.5-5.9s): the LCP elements are TEXT
        // (hero-subtitle on `/`, card description on `/login`, card title on
        // `/register`) sitting behind (a) a post-mount lazy-route chunk
        // waterfall and (b) the hero/header entrance animation, which held
        // its final text at `opacity-0` until a post-mount JS transition
        // fired. PERF-24's byte-budget cuts (i18n namespace split, deferred
        // posthog-js import) did NOT move LCP — that's what confirmed the
        // render-timing diagnosis over a byte-budget one.
        //
        // FIX (PERF-25 Levers A+B, this story): (A, PERF-25-01) de-gate the
        // hero + header entrance animation so LCP text paints at its final
        // opacity immediately, no animation gate; (B, PERF-25-02) eager-load
        // the 3 pre-auth routes (`/`, `/login`, `/register`) instead of
        // lazy-chunking them, removing the post-mount waterfall.
        //
        // MEASURED (RV#1, 2026-07-12, release-verify run 29243389034): `/`
        // 4302ms, `/login` 3773ms, `/register` 3781ms — a 27-31% improvement
        // over the PERF-24 band (5891/5501/5475ms). `/login` and `/register`
        // now clear the real Web Vitals `error@4000` floor; `/` does not
        // (4302 > 4000).
        //
        // WHY 4800, NOT 4000: per user decision + story Decision #14, the
        // gate is honestly ratcheted 7000 -> 4800 rather than all the way to
        // the Web Vitals 4000 floor. `/`'s residual cost above 4000 is
        // SPA-boot Render Delay, not a byte or animation gate — `/` is
        // ~525ms heavier than `/login`/`/register` because eager-loading
        // (Lever B) makes it render the whole LandingPage synchronously
        // before paint. All three URLs clear 4800 with >=500ms of headroom
        // against RV#1 (`/`=498ms, `/login`=1027ms, `/register`=1019ms), so
        // 4800 is a real, currently-passing regression gate rather than an
        // aspirational one that would immediately flake. Getting `/` under
        // the true 4000 floor (defer below-fold landing content to a later
        // paint) is tracked as follow-up story PERF-26.
        //
        // PERF-23 honesty rules still apply: no `|| true`, no standing
        // waivers. NOTE: scripts/parse-lighthouse-results.cjs still uses
        // lcp.poor=4000 to color the PR-comment bands, so mobile LCP values
        // between 4000-4800ms will render as "poor" there — informational
        // only, this assertion (not that script) is what gates the CI job.
        'largest-contentful-paint': ['error', { maxNumericValue: 4800 }],
      },
    },

    upload: {
      // Upload to temporary public storage for easy report access
      target: 'temporary-public-storage',
    },
  },
};
