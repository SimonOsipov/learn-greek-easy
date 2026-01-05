import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import heroImage from '@/assets/landing/cyprus-hero.webp';
import { Button } from '@/components/ui/button';

const Hero = () => {
  const { t } = useTranslation('landing');

  return (
    <section
      data-testid="hero-section"
      className="relative flex min-h-[50vh] items-center justify-center overflow-hidden"
    >
      {/* Full-screen background image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt={t('hero.heroImageAlt')}
          width={1920}
          height={1080}
          loading="eager"
          className="h-full w-full object-cover"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-6 py-32 md:py-40">
        <div className="mx-auto max-w-6xl text-center">
          {/* Badge */}
          <div
            className="mb-8 inline-flex animate-fade-up items-center gap-2 rounded-full border border-primary/20 bg-background/90 px-5 py-2.5 opacity-0 backdrop-blur-sm"
            style={{ animationDelay: '0.1s' }}
          >
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
            <span className="text-base font-medium text-primary">{t('hero.badge')}</span>
          </div>

          {/* Headline */}
          <h1
            className="mb-10 animate-fade-up text-balance text-6xl font-bold leading-[1.05] tracking-tight text-foreground opacity-0 sm:text-7xl md:text-8xl lg:text-9xl"
            style={{ animationDelay: '0.2s' }}
            data-testid="hero-title"
          >
            {t('hero.title')} <span className="text-primary">{t('hero.titleHighlight')}</span>
          </h1>

          {/* Subheadline */}
          <p
            className="mx-auto mb-14 max-w-4xl animate-fade-up text-balance text-2xl leading-relaxed text-foreground/90 opacity-0 md:text-3xl lg:text-4xl"
            style={{ animationDelay: '0.3s' }}
            data-testid="hero-subtitle"
          >
            {t('hero.subtitle')}
          </p>

          {/* CTAs */}
          <div
            className="flex animate-fade-up flex-col items-center justify-center gap-4 opacity-0 sm:flex-row"
            style={{ animationDelay: '0.4s' }}
          >
            <Button
              variant="hero"
              size="xl"
              className="group"
              data-testid="hero-cta-button"
              asChild
            >
              <Link to="/register">
                {t('hero.cta')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>

          {/* Social proof hint */}
          <p
            className="mt-14 animate-fade-up text-lg text-foreground/80 opacity-0"
            style={{ animationDelay: '0.5s' }}
          >
            {t('hero.socialProof')}
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
