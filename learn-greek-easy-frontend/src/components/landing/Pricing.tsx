import type { ReactNode } from 'react';

import { Check, Crown, Sparkles, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  icon: ReactNode;
  features: string[];
  buttonText: string;
  buttonVariant: 'default' | 'outline';
  popular: boolean;
  highlight?: boolean;
}

const Pricing = () => {
  const plans: Plan[] = [
    {
      name: 'Free',
      price: '0 EUR',
      period: 'forever',
      description: 'Get started with the basics',
      icon: <Zap className="h-6 w-6" />,
      features: [
        'Basic vocabulary cards (A1 level)',
        'Limited daily practice sessions',
        'Progress tracking',
        'Community access',
      ],
      buttonText: 'Start Free',
      buttonVariant: 'outline',
      popular: false,
    },
    {
      name: 'Monthly Premium',
      price: '29 EUR',
      period: '/month',
      description: 'Full access, billed monthly',
      icon: <Sparkles className="h-6 w-6" />,
      features: [
        'All vocabulary themes (A1-B2)',
        'Unlimited practice sessions',
        'Verb conjugations & noun cases',
        'Real news & audio dialogs',
        'History & culture questions',
        'Priority support',
      ],
      buttonText: 'Go Premium',
      buttonVariant: 'default',
      popular: true,
    },
    {
      name: 'Yearly Premium',
      price: '200 EUR',
      period: '/year',
      description: 'Save 148 EUR vs monthly',
      icon: <Sparkles className="h-6 w-6" />,
      features: [
        'Everything in Monthly Premium',
        '2+ months free',
        'Early access to new features',
        'Offline mode (coming soon)',
        'Certificate upon completion',
      ],
      buttonText: 'Save with Yearly',
      buttonVariant: 'default',
      popular: false,
    },
    {
      name: 'Founders Edition',
      price: '250 EUR',
      period: 'one-time',
      description: 'Lifetime access, forever',
      icon: <Crown className="h-6 w-6" />,
      features: [
        'Everything in Premium, forever',
        'Lifetime updates included',
        'Founders badge on profile',
        'Direct input on new features',
        'Exclusive founders community',
        'Support our mission',
      ],
      buttonText: 'Become a Founder',
      buttonVariant: 'default',
      popular: false,
      highlight: true,
    },
  ];

  return (
    <section data-testid="pricing-section" id="pricing" className="bg-background py-16 md:py-24">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 animate-fade-up text-sm font-medium text-primary opacity-0">
            SIMPLE PRICING
          </p>
          <h2
            className="mb-3 animate-fade-up text-2xl font-bold opacity-0 md:text-4xl"
            style={{ animationDelay: '0.1s' }}
          >
            Choose your path to fluency
          </h2>
          <p
            className="animate-fade-up text-lg text-muted-foreground opacity-0"
            style={{ animationDelay: '0.2s' }}
          >
            Start free, upgrade when you&apos;re ready
          </p>
        </div>

        {/* Pricing grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative flex animate-fade-up flex-col rounded-2xl border p-6 opacity-0 transition-all duration-300 ${
                plan.popular
                  ? 'scale-[1.02] border-primary bg-primary/5 shadow-lg'
                  : plan.highlight
                    ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                    : 'border-border bg-card hover:border-primary/50'
              }`}
              style={{ animationDelay: `${0.1 * (index + 1)}s` }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Founders badge */}
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                    <Crown className="h-3 w-3" />
                    Limited
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                    plan.highlight ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'
                  }`}
                >
                  {plan.icon}
                </div>
                <h3 className="mb-1 text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="ml-1 text-muted-foreground">{plan.period}</span>
              </div>

              {/* Features */}
              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-2 text-sm text-foreground">
                    <Check
                      className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                        plan.highlight ? 'text-amber-500' : 'text-primary'
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
                  plan.highlight ? 'border-0 bg-amber-500 text-white hover:bg-amber-600' : ''
                }`}
              >
                {plan.buttonText}
              </Button>
            </div>
          ))}
        </div>

        {/* Trust note */}
        <p
          className="mt-10 animate-fade-up text-center text-sm text-muted-foreground opacity-0"
          style={{ animationDelay: '0.6s' }}
        >
          All plans include a 14-day money-back guarantee. No questions asked.
        </p>
      </div>
    </section>
  );
};

export default Pricing;
