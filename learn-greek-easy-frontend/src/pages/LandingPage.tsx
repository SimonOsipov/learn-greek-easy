import { Helmet } from '@dr.pogodin/react-helmet';

import { Header, Hero, Features, FAQ, FinalCTA, Footer } from '@/components/landing';

// Site configuration
const SITE_URL = 'https://greeklish.eu';
const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;

/**
 * LandingPage Component
 *
 * Public-facing landing page for unauthenticated users.
 * Composes all landing page sections in the correct order.
 *
 * Route: /
 *
 * Features:
 * - Full landing page composition
 * - Theme-aware background (light/dark mode)
 * - Responsive layout
 * - SEO meta tags with Open Graph and Twitter Card support
 *
 * Note: Authentication-aware redirects are handled by
 * LandingRoute wrapper, not this component.
 */
export default function LandingPage() {
  return (
    <>
      <Helmet>
        {/* Primary Meta Tags */}
        <title>Greeklish - Learn and Practice all aspects of the Greek language</title>
        <meta
          name="description"
          content="Learn and practice Greek Language on interactive platform with spaced repetition, exercises and exam preparation."
        />
        <meta
          name="keywords"
          content="Greek language, Cypriot Citizenship Exam, Greek language learning, Ellinomatheia"
        />
        <link rel="canonical" href={SITE_URL} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content="Greeklish - Your Learning Greek Companion" />
        <meta
          property="og:description"
          content="Learn and practice Greek Language on interactive platform with spaced repetition, exercises and exam preparation."
        />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta property="og:site_name" content="Greeklish" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={SITE_URL} />
        <meta name="twitter:title" content="Greeklish - Your Learning Greek Companion" />
        <meta
          name="twitter:description"
          content="Learn and practice Greek Language on interactive platform with spaced repetition, exercises and exam preparation."
        />
        <meta name="twitter:image" content={OG_IMAGE_URL} />

        {/* Additional SEO */}
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="author" content="Greeklish" />
      </Helmet>

      <div className="min-h-screen bg-[hsl(var(--landing-navy))]" data-testid="landing-page">
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
