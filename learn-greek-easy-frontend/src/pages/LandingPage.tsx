import { Helmet } from '@dr.pogodin/react-helmet';

import { Header, Hero, Features, FAQ, FinalCTA, Footer } from '@/components/landing';

/**
 * LandingPage Component
 *
 * Public-facing landing page for unauthenticated users.
 * Composes all landing page sections in the correct order.
 *
 * Routes: / (English) and /ru/ (Russian)
 *
 * Features:
 * - Full landing page composition
 * - Theme-aware background (light/dark mode)
 * - Responsive layout
 *
 * SEO: this component does NOT own the landing head. The build emits one
 * static HTML document per locale (see build/localeHtml.ts), and each carries
 * its own <html lang>, <title>, description, canonical, hreflang pair and
 * Open Graph / Twitter tags — already correct for crawlers with no JS. Re-emitting
 * them here would overwrite the RU document's head with EN values at boot and
 * put a second, conflicting canonical in the DOM (Google discards both when
 * they disagree). Only the two locale-INVARIANT tags stay below.
 *
 * Note: Authentication-aware redirects are handled by
 * LandingRoute wrapper, not this component.
 */
export default function LandingPage() {
  return (
    <>
      <Helmet>
        {/* Locale-invariant only — every locale-BEARING tag is owned by the
            static per-locale document (see the SEO note above). meta[name=robots]
            has no counterpart in index.html, so this Helmet is its only source. */}
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Greeklish" />
      </Helmet>

      <div className="min-h-screen bg-background" data-testid="landing-page">
        <Header />
        <main>
          <Hero />
          <Features />
          <FAQ />
          <FinalCTA />
        </main>
        <Footer />
      </div>
    </>
  );
}
