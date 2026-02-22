import { Button } from '@/components/ui/button';
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
    <div
      className={`relative flex flex-col overflow-visible rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-800 ${
        isFeatured
          ? 'border-amber-500 ring-2 ring-amber-500'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {isFeatured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="whitespace-nowrap rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
            {t('pricing.mostPopular')}
          </span>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {t('subscription.labels.currentPlan', 'Current Plan')}
          </span>
        </div>
      )}

      <div className="mb-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">
          {symbol}
          {plan.price_formatted}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {t(getPeriodKey(plan.billing_cycle))}
        </span>
      </div>

      {plan.savings_percent !== null && (
        <div className="mb-4">
          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/50 dark:text-green-400">
            {t('pricing.save', { percent: plan.savings_percent })}
          </span>
        </div>
      )}

      <Button
        className="mt-auto w-full"
        variant={isFeatured ? 'hero' : 'default'}
        disabled={isLoading || isCurrentPlan}
        onClick={() => onSubscribe(plan)}
      >
        {isLoading ? t('pricing.subscribing') : (buttonLabel ?? t('pricing.subscribe'))}
      </Button>
    </div>
  );
}
