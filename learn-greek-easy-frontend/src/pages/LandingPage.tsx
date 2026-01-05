import {
  Header,
  Hero,
  Features,
  SocialProof,
  Pricing,
  FAQ,
  FinalCTA,
  Footer,
} from '@/components/landing';

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
 * - Clean white background
 * - Responsive layout
 *
 * Note: Authentication-aware redirects are handled by
 * LandingRoute wrapper, not this component.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" data-testid="landing-page">
      <Header />
      <main>
        <Hero />
        <Features />
        <SocialProof />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
