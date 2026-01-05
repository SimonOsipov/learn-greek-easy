import { ArrowRight, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ctaImage from '@/assets/landing/limassol-cta.webp';
import { Button } from '@/components/ui/button';

const FinalCTA = () => {
  const { t } = useTranslation('landing');

  return (
    <section
      data-testid="final-cta-section"
      className="relative flex min-h-[500px] items-center overflow-hidden py-24 md:py-32"
    >
      {/* Background Image */}
      <img
        src={ctaImage}
        alt={t('finalCta.imageAlt')}
        width={1920}
        height={1080}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-foreground/70" />

      <div className="container relative z-10 mx-auto px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className="mb-6 text-3xl font-bold text-background motion-safe:animate-fade-up md:text-4xl lg:text-5xl"
            style={{ animationDelay: '0.1s' }}
          >
            {t('finalCta.title')}
          </h2>

          <p
            className="mb-10 text-lg text-background/80 motion-safe:animate-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            {t('finalCta.subtitle')}
          </p>

          <div
            className="flex flex-col items-center justify-center gap-4 motion-safe:animate-fade-up sm:flex-row"
            style={{ animationDelay: '0.3s' }}
          >
            <Button
              size="xl"
              className="group bg-background text-foreground shadow-lg hover:bg-background/90"
            >
              {t('finalCta.primaryCta')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="xl"
              variant="ghost"
              className="border border-background/20 text-background hover:bg-background/10"
            >
              <BookOpen className="h-4 w-4" />
              {t('finalCta.secondaryCta')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
