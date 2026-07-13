import { useTranslation } from 'react-i18next';

import heroFallback from '@/assets/landing/cyprus-hero.webp?w=1280&format=webp&quality=68';
import heroAvif from '@/assets/landing/cyprus-hero.webp?w=640;960;1280;1920&format=avif&quality=65&as=srcset';
import heroWebp from '@/assets/landing/cyprus-hero.webp?w=640;960;1280;1920&format=webp&quality=68&as=srcset';

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
      <div className="absolute inset-0">
        <picture>
          <source srcSet={heroAvif} type="image/avif" sizes="100vw" />
          <source srcSet={heroWebp} type="image/webp" sizes="100vw" />
          <img
            src={heroFallback}
            alt={t('hero.heroImageAlt')}
            width={1920}
            height={1080}
            loading="eager"
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
        </picture>
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--landing-header-bg))]/85 via-[hsl(var(--landing-header-bg))]/80 to-[hsl(var(--landing-header-bg))]" />
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-6 py-32 md:py-40">
        <div className="mx-auto max-w-6xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--landing-header-fg))]/20 bg-[hsl(var(--landing-header-bg))]/90 px-5 py-2.5 backdrop-blur-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[hsl(var(--landing-gold))]" />
            <span className="text-base font-medium text-[hsl(var(--landing-header-fg))]">
              {t('hero.badge')}
            </span>
          </div>

          {/* Headline */}
          <h1
            className="mb-10 text-balance text-6xl font-bold leading-[1.05] tracking-tight text-[hsl(var(--landing-header-fg))] sm:text-7xl md:text-8xl lg:text-9xl"
            data-testid="hero-title"
          >
            {t('hero.title')}{' '}
            <span className="text-[hsl(var(--landing-gold))]">{t('hero.titleHighlight')}</span>
          </h1>

          {/* Subheadline */}
          <p
            className="mx-auto mb-14 max-w-4xl text-balance text-2xl leading-relaxed text-[hsl(var(--landing-header-fg))]/90 md:text-3xl lg:text-4xl"
            data-testid="hero-subtitle"
          >
            {t('hero.subtitle')}
          </p>

          {/* Waitlist Form */}
          <div className="flex flex-col items-center justify-center">
            <WaitlistForm />
          </div>

          {/* Social proof hint */}
          <p className="mt-14 text-lg text-[hsl(var(--landing-header-fg))]/80">
            {t('hero.socialProof')}
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
