import { Helmet } from '@dr.pogodin/react-helmet';

import { Header, Hero, Features, FAQ, FinalCTA, Footer } from '@/components/landing';

// Site configuration
const SITE_URL = 'https://learngreekeasy.com';
const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;

// FAQ structured data for rich snippets
const faqStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is the Greek citizenship language exam?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The Greek citizenship language exam tests your ability to communicate in Greek at a B1 or B2 level. It includes reading comprehension, writing, listening, and speaking sections.',
      },
    },
    {
      '@type': 'Question',
      name: 'What level of Greek do I need to pass?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Most applicants need to demonstrate B1 level proficiency. Some categories may require B2 level. Greeklish covers vocabulary and grammar from A1 through B2.',
      },
    },
    {
      '@type': 'Question',
      name: 'How long does it take to prepare for the exam?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Preparation time varies based on your starting level. Starting from zero, plan for 6-12 months. With some Greek knowledge, 3-6 months may be sufficient with 20-30 minutes of daily practice.',
      },
    },
  ],
};

// Organization structured data
const organizationStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Greeklish',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description:
    'Interactive Greek language learning platform for citizenship exam preparation. Launching May 2026 — join the waitlist.',
};

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
 * - Structured data for rich search snippets
 *
 * Note: Authentication-aware redirects are handled by
 * LandingRoute wrapper, not this component.
 */
export default function LandingPage() {
  return (
    <>
      <Helmet>
        {/* Primary Meta Tags */}
        <title>Greeklish - Master Cypriot Greek with AI-Powered Lessons</title>
        <meta
          name="description"
          content="Join the waitlist for Greeklish — an AI-powered Greek learning platform for Cyprus citizenship exam preparation. Launching May 2026."
        />
        <meta
          name="keywords"
          content="Greek language, Cypriot Greek, citizenship exam, Greek learning, flashcards, B1 Greek, B2 Greek, spaced repetition, naturalization"
        />
        <link rel="canonical" href={SITE_URL} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content="Greeklish - Master Cypriot Greek" />
        <meta
          property="og:description"
          content="Join the waitlist for an interactive Greek learning platform with spaced repetition and AI practice. Launching May 2026."
        />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta property="og:site_name" content="Greeklish" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={SITE_URL} />
        <meta name="twitter:title" content="Greeklish" />
        <meta name="twitter:description" content="Master Cypriot Greek with AI-Powered Lessons" />
        <meta name="twitter:image" content={OG_IMAGE_URL} />

        {/* Additional SEO */}
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="author" content="Greeklish" />

        {/* Structured Data */}
        <script type="application/ld+json">{JSON.stringify(faqStructuredData)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationStructuredData)}</script>
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
