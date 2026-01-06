import { useEffect, useState } from 'react';

import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SocialProof = () => {
  const { t } = useTranslation('landing');

  const quoteKeys = ['founder', 'mariaK', 'dimitrisP', 'annaS', 'georgeM'];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % quoteKeys.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [quoteKeys.length]);

  return (
    <section data-testid="social-proof-section" className="overflow-hidden py-24 md:py-32">
      <div className="container mx-auto px-6">
        <div>
          {/* Sliding quotes container */}
          <div className="relative h-[280px] md:h-[240px]">
            {quoteKeys.map((key, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                  index === currentIndex
                    ? 'translate-x-0 opacity-100'
                    : index < currentIndex || (currentIndex === 0 && index === quoteKeys.length - 1)
                      ? '-translate-x-full opacity-0'
                      : 'translate-x-full opacity-0'
                }`}
              >
                <div className="relative h-full rounded-3xl border border-border/50 bg-card p-8 shadow-landing-card md:p-12">
                  {/* Quote mark */}
                  <div className="absolute -top-4 left-8 flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <span className="font-serif text-xl text-primary-foreground">&quot;</span>
                  </div>

                  <blockquote className="mb-6 line-clamp-3 text-lg font-medium leading-relaxed text-foreground md:text-xl">
                    {t(`socialProof.quotes.${key}.text`)}
                  </blockquote>

                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-landing-greek-blue-light">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {t(`socialProof.quotes.${key}.author`)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t(`socialProof.quotes.${key}.role`)}
                      </p>
                    </div>
                  </div>

                  {/* Decorative elements */}
                  <div className="absolute -bottom-3 -right-3 -z-10 h-24 w-24 rounded-2xl bg-primary/5" />
                </div>
              </div>
            ))}
          </div>

          {/* Dots indicator */}
          <div className="mt-8 flex justify-center gap-2">
            {quoteKeys.map((_, index) => (
              <button
                type="button"
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  index === currentIndex ? 'w-6 bg-primary' : 'bg-primary/30 hover:bg-primary/50'
                }`}
                aria-label={t('socialProof.goToQuote', { number: index + 1 })}
              />
            ))}
          </div>

          {/* Stats preview */}
          <div
            className="mt-12 grid grid-cols-3 gap-6 motion-safe:animate-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground md:text-3xl">500+</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('socialProof.stats.activeLearners')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground md:text-3xl">2,000+</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('socialProof.stats.flashcards')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground md:text-3xl">A1-B2</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('socialProof.stats.levelCoverage')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
