import { useTranslation } from 'react-i18next';

import ctaImage from '@/assets/landing/limassol-cta.webp';

import WaitlistForm from './WaitlistForm';

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
      <div className="absolute inset-0 bg-landing-header-bg/70" />

      <div className="container relative z-10 mx-auto px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className="mb-6 text-3xl font-bold text-landing-header-fg motion-safe:animate-fade-up md:text-4xl lg:text-5xl"
            style={{ animationDelay: '0.1s' }}
          >
            {t('finalCta.title')}
          </h2>

          <p
            className="mb-10 text-lg text-landing-header-fg/80 motion-safe:animate-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            {t('finalCta.subtitle')}
          </p>

          <div className="motion-safe:animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <WaitlistForm variant="dark" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
