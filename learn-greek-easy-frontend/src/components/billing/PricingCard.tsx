import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PricingPlan } from '@/services/billingAPI';

function getPeriodKey(billingCycle: string): string {
  if (billingCycle === 'monthly') return 'pricing.perMonth';
  if (billingCycle === 'quarterly') return 'pricing.perQuarter';
  return 'pricing.perSixMonths';
}

const CURRENCY_SYMBOLS: Record<string, string> = { eur: '€', usd: '$', gbp: '£' };

interface PricingCardProps {
  plan: PricingPlan;
  isLoading: boolean;
  onSubscribe: (plan: PricingPlan) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  isCurrentPlan?: boolean;
  buttonLabel?: string;
}

export function PricingCard({
  plan,
  isLoading,
  onSubscribe,
  t,
  isCurrentPlan,
  buttonLabel,
}: PricingCardProps) {
  const isFeatured = plan.billing_cycle === 'semi_annual';
  const symbol = CURRENCY_SYMBOLS[plan.currency] ?? plan.currency.toUpperCase();

  return (
    <Card
      className={cn(
        'glass-strong relative flex flex-col overflow-visible p-6',
        isFeatured && 'ring-2 ring-founders-accent'
      )}
    >
      {isFeatured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="whitespace-nowrap rounded-full bg-founders-accent px-3 py-1 text-xs font-semibold text-primary-foreground">
            {t('pricing.mostPopular')}
          </span>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {t('subscription.labels.currentPlan')}
          </span>
        </div>
      )}

      <div className="mb-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-fg">
          {symbol}
          {plan.price_formatted}
        </span>
        <span className="text-sm text-fg3">{t(getPeriodKey(plan.billing_cycle))}</span>
      </div>

      <div className="mb-4 min-h-[28px]">
        {plan.savings_percent !== null && (
          <span className="badge b-green">
            {t('pricing.save', { percent: plan.savings_percent })}
          </span>
        )}
      </div>

      <Button
        className="mt-auto w-full"
        variant={isFeatured ? 'hero' : 'default'}
        disabled={isLoading || isCurrentPlan}
        onClick={() => onSubscribe(plan)}
      >
        {isLoading ? t('pricing.subscribing') : (buttonLabel ?? t('pricing.subscribe'))}
      </Button>
    </Card>
  );
}
