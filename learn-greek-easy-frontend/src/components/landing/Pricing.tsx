import type { ReactNode } from 'react';

import { Check, Crown, Sparkles, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

interface Plan {
  nameKey: string;
  priceKey: string;
  periodKey: string;
  descriptionKey: string;
  icon: ReactNode;
  featuresKey: string;
  ctaKey: string;
  buttonVariant: 'default' | 'outline';
  popular: boolean;
  highlight?: boolean;
  route: string;
}

const FOUNDERS_COLORS = {
  card: 'border-founders-border bg-founders-surface/50',
  badge: 'bg-founders-brand',
  iconBg: 'bg-founders-soft text-founders-brand',
  check: 'text-founders-accent',
  button: 'bg-founders-brand text-landing-header-fg hover:bg-founders-brand-hover',
} as const;

const Pricing = () => {
  const { t } = useTranslation('landing');

  const plans: Plan[] = [
    {
      nameKey: 'pricing.plans.free.name',
      priceKey: 'pricing.plans.free.price',
      periodKey: 'pricing.plans.free.period',
      descriptionKey: 'pricing.plans.free.description',
      icon: <Zap className="h-6 w-6" />,
      featuresKey: 'pricing.plans.free.features',
      ctaKey: 'pricing.plans.free.cta',
      buttonVariant: 'outline',
      popular: false,
      route: '/register',
    },
    {
      nameKey: 'pricing.plans.monthly.name',
      priceKey: 'pricing.plans.monthly.price',
      periodKey: 'pricing.plans.monthly.period',
      descriptionKey: 'pricing.plans.monthly.description',
      icon: <Sparkles className="h-6 w-6" />,
      featuresKey: 'pricing.plans.monthly.features',
      ctaKey: 'pricing.plans.monthly.cta',
      buttonVariant: 'default',
      popular: true,
      route: '/register?plan=monthly',
    },
    {
      nameKey: 'pricing.plans.quarterly.name',
      priceKey: 'pricing.plans.quarterly.price',
      periodKey: 'pricing.plans.quarterly.period',
      descriptionKey: 'pricing.plans.quarterly.description',
      icon: <Sparkles className="h-6 w-6" />,
      featuresKey: 'pricing.plans.quarterly.features',
      ctaKey: 'pricing.plans.quarterly.cta',
      buttonVariant: 'default',
      popular: false,
      route: '/register?plan=quarterly',
    },
    {
      nameKey: 'pricing.plans.semiAnnual.name',
      priceKey: 'pricing.plans.semiAnnual.price',
      periodKey: 'pricing.plans.semiAnnual.period',
      descriptionKey: 'pricing.plans.semiAnnual.description',
      icon: <Crown className="h-6 w-6" />,
      featuresKey: 'pricing.plans.semiAnnual.features',
      ctaKey: 'pricing.plans.semiAnnual.cta',
      buttonVariant: 'default',
      popular: false,
      highlight: true,
      route: '/register?plan=semi-annual',
    },
  ];

  return (
    <section
      data-testid="pricing-section"
      id="pricing"
      className="bg-[hsl(var(--landing-navy))]/5 py-16 md:py-24"
    >
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium text-[hsl(var(--landing-navy))] motion-safe:animate-fade-up">
            {t('pricing.label')}
          </p>
          <h2
            className="mb-3 text-2xl font-bold text-[hsl(var(--landing-navy))] motion-safe:animate-fade-up md:text-4xl"
            style={{ animationDelay: '0.1s' }}
          >
            {t('pricing.title')}
          </h2>
          <p
            className="text-lg text-[hsl(var(--landing-navy))]/80 motion-safe:animate-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            {t('pricing.subtitle')}
          </p>
        </div>

        {/* Pricing grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, index) => {
            const features = t(plan.featuresKey, { returnObjects: true }) as string[];
            return (
              <div
                key={index}
                data-testid="pricing-card"
                className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 motion-safe:animate-fade-up ${
                  plan.popular
                    ? // scale-[1.02]: arbitrary Tailwind value — subtle scale lift on the most-popular card (lg only to avoid overlap in 2-col)
                      'border-[hsl(var(--landing-greek-blue))] bg-[hsl(var(--landing-greek-blue))]/5 shadow-landing-card hover:shadow-landing-card-hover lg:scale-[1.02]'
                    : plan.highlight
                      ? FOUNDERS_COLORS.card
                      : 'border-[hsl(var(--landing-navy))]/15 bg-[hsl(var(--landing-navy))]/5 shadow-landing-card hover:border-[hsl(var(--landing-greek-blue))]/50 hover:shadow-landing-card-hover dark:border-[hsl(var(--landing-navy))]/25'
                }`}
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-[hsl(var(--landing-gold))] px-3 py-1 text-xs font-semibold text-[hsl(var(--landing-navy))]">
                      {t('pricing.badges.mostPopular')}
                    </span>
                  </div>
                )}

                {/* Founders badge */}
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className={`flex items-center gap-1 rounded-full ${FOUNDERS_COLORS.badge} px-3 py-1 text-xs font-semibold text-landing-header-fg`}
                    >
                      <Crown className="h-3 w-3" />
                      {t('pricing.badges.limited')}
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-6">
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                      plan.highlight
                        ? FOUNDERS_COLORS.iconBg
                        : 'bg-[hsl(var(--landing-greek-blue-light))]/10 text-[hsl(var(--landing-navy))]'
                    }`}
                  >
                    {plan.icon}
                  </div>
                  <h3 className="mb-1 text-xl font-bold text-[hsl(var(--landing-navy))]">
                    {t(plan.nameKey)}
                  </h3>
                  <p className="text-sm text-[hsl(var(--landing-navy))]/70">
                    {t(plan.descriptionKey)}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-6 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold text-[hsl(var(--landing-navy))]">
                    {t(plan.priceKey)}
                  </span>
                  <span className="text-[hsl(var(--landing-navy))]/70">{t(plan.periodKey)}</span>
                </div>

                {/* Features */}
                <ul className="mb-8 flex-1 space-y-3">
                  {features.map((feature, featureIndex) => (
                    <li
                      key={featureIndex}
                      className="flex items-start gap-2 text-sm text-[hsl(var(--landing-navy))]"
                    >
                      <Check
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                          plan.highlight
                            ? FOUNDERS_COLORS.check
                            : 'text-[hsl(var(--landing-greek-blue))]'
                        }`}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  variant={plan.buttonVariant}
                  className={`h-11 w-full font-semibold ${
                    plan.highlight ? `border-0 ${FOUNDERS_COLORS.button}` : ''
                  }`}
                  data-testid="pricing-cta"
                  asChild
                >
                  <Link to={plan.route}>{t(plan.ctaKey)}</Link>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Trust note */}
        <p
          className="mt-10 text-center text-sm text-[hsl(var(--landing-navy))]/70 motion-safe:animate-fade-up"
          style={{ animationDelay: '0.6s' }}
        >
          {t('pricing.guarantee')}
        </p>
      </div>
    </section>
  );
};

export default Pricing;
