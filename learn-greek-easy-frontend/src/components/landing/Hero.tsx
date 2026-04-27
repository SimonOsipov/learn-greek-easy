import { useTranslation } from 'react-i18next';

import heroImage from '@/assets/landing/cyprus-hero.webp';

import WaitlistForm from './WaitlistForm';

const Hero = () => {
  const { t } = useTranslation('landing');

  return (
    <section
      id="hero"
      data-testid="hero-section"
      className="relative flex min-h-[50vh] items-center justify-center overflow-hidden"
    >
      {/* Full-screen background image */}
      <div className="absolute inset-0 motion-safe:animate-landing-fade-in">
        <img
          src={heroImage}
          alt={t('hero.heroImageAlt')}
          loading="eager"
          className="h-full w-full object-cover"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--landing-navy))]/80 via-[hsl(var(--landing-navy))]/60 to-[hsl(var(--landing-navy))]" />
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-6 py-32 md:py-40">
        <div className="mx-auto max-w-6xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--landing-greek-blue-light))]/20 bg-[hsl(var(--landing-navy))]/90 px-5 py-2.5 backdrop-blur-sm [animation-delay:0.1s] motion-safe:animate-fade-up">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[hsl(var(--landing-gold))]" />
            <span className="text-base font-medium text-[hsl(var(--landing-greek-blue-light))]">
              {t('hero.badge')}
            </span>
          </div>

          {/* Headline */}
          <h1
            className="mb-10 text-balance text-6xl font-bold leading-[1.05] tracking-tight text-[hsl(var(--landing-greek-blue-light))] [animation-delay:0.2s] motion-safe:animate-fade-up sm:text-7xl md:text-8xl lg:text-9xl"
            data-testid="hero-title"
          >
            {t('hero.title')}{' '}
            <span className="text-[hsl(var(--landing-gold))]">{t('hero.titleHighlight')}</span>
          </h1>

          {/* Subheadline */}
          <p
            className="mx-auto mb-14 max-w-4xl text-balance text-2xl leading-relaxed text-[hsl(var(--landing-greek-blue-light))]/90 [animation-delay:0.3s] motion-safe:animate-fade-up md:text-3xl lg:text-4xl"
            data-testid="hero-subtitle"
          >
            {t('hero.subtitle')}
          </p>

          {/* Waitlist Form */}
          <div className="flex flex-col items-center justify-center [animation-delay:0.4s] motion-safe:animate-fade-up">
            <WaitlistForm variant="hero" />
          </div>

          {/* Social proof hint */}
          <p className="mt-14 text-lg text-[hsl(var(--landing-greek-blue-light))]/80 [animation-delay:0.5s] motion-safe:animate-fade-up">
            {t('hero.socialProof')}
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
