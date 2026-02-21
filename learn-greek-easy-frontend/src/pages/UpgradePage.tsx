import React, { useEffect, useState } from 'react';

import { AlertTriangle, Check, Crown, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useCheckout } from '@/hooks/useCheckout';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { reportAPIError } from '@/lib/errorReporting';
import { billingAPI } from '@/services/billingAPI';
import type { BillingCycle, BillingStatusResponse, PricingPlan } from '@/services/billingAPI';

const COMPARISON_FEATURES = [
  { label: 'Basic vocabulary cards (A1)', free: true, premium: true },
  { label: 'Limited daily practice', free: true, premium: true },
  { label: 'Limited personal decks', free: true, premium: true },
  { label: 'Progress tracking', free: true, premium: true },
  { label: 'Community access', free: true, premium: true },
  { label: 'All vocabulary themes (A1-B2)', free: false, premium: true },
  { label: 'Unlimited practice', free: false, premium: true },
  { label: 'Verb conjugations & noun cases', free: false, premium: true },
  { label: 'Real news & audio dialogs', free: false, premium: true },
  { label: 'History & culture', free: false, premium: true },
  { label: 'Priority support', free: false, premium: true },
];

function getPeriodKey(billingCycle: string): string {
  if (billingCycle === 'monthly') return 'pricing.perMonth';
  if (billingCycle === 'quarterly') return 'pricing.perQuarter';
  return 'pricing.perSixMonths';
}

interface PricingCardProps {
  plan: PricingPlan;
  isLoading: boolean;
  onSubscribe: (plan: PricingPlan) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function PricingCard({ plan, isLoading, onSubscribe, t }: PricingCardProps) {
  const isFeatured = plan.billing_cycle === 'semi_annual';

  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-800 ${
        isFeatured
          ? 'border-amber-500 ring-2 ring-amber-500'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {isFeatured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
            {t('pricing.mostPopular')}
          </span>
        </div>
      )}

      <div className="mb-4">
        <div className="text-3xl font-bold text-gray-900 dark:text-white">
          {plan.price_formatted}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t(getPeriodKey(plan.billing_cycle))}
        </div>
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
        disabled={isLoading}
        onClick={() => onSubscribe(plan)}
      >
        {isLoading ? t('pricing.subscribing') : t('pricing.subscribe')}
      </Button>

      <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
        {t('pricing.moneyBack')}
      </p>
    </div>
  );
}

export function UpgradePage() {
  const { t } = useTranslation('upgrade');
  const [searchParams] = useSearchParams();
  const { track } = useTrackEvent();
  const { startCheckout, isLoading } = useCheckout();

  const promoCode = searchParams.get('promo');

  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = React.useCallback(() => {
    setError(null);
    setIsLoadingData(true);

    let cancelled = false;

    async function doFetch() {
      try {
        const status = await billingAPI.getBillingStatus();
        if (cancelled) return;
        setBillingStatus(status);
        track('upgrade_page_viewed', {
          user_status: status.subscription_status,
          has_promo: !!promoCode,
          promo_code: promoCode || undefined,
          trial_days_remaining: status.trial_days_remaining,
          pricing_count: status.pricing.length,
        });
      } catch (err) {
        if (cancelled) return;
        setError('error');
        reportAPIError(err, { operation: 'getBillingStatus', silent: true });
      } finally {
        if (!cancelled) setIsLoadingData(false);
      }
    }

    doFetch();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return fetchStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubscribe = (plan: PricingPlan) => {
    track('billing_cycle_selected', {
      billing_cycle: plan.billing_cycle,
      has_promo: !!promoCode,
      promo_code: promoCode || undefined,
      user_status: billingStatus?.subscription_status,
      price_amount: plan.price_amount,
      currency: plan.currency,
    });
    startCheckout(plan.billing_cycle as BillingCycle, promoCode || undefined);
  };

  if (isLoadingData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300">{t('error.title')}</p>
          <Button
            onClick={() => {
              fetchStatus();
            }}
            variant="outline"
          >
            {t('error.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (billingStatus?.is_premium && billingStatus.subscription_status === 'active') {
    return (
      <div className="flex min-h-[400px] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
            <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            {t('alreadyPremium.title')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400">{t('alreadyPremium.description')}</p>
        </div>
      </div>
    );
  }

  const banner = (() => {
    if (!billingStatus) return null;
    const { subscription_status, trial_days_remaining } = billingStatus;

    if (subscription_status === 'trialing' && trial_days_remaining && trial_days_remaining > 0) {
      return (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {t('banner.trialActive', { days: trial_days_remaining })}
        </div>
      );
    }

    if (subscription_status === 'trialing' && trial_days_remaining === 0) {
      return (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          {t('banner.trialExpired')}
        </div>
      );
    }

    if (subscription_status === 'past_due') {
      return (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          {t('banner.pastDue')}
        </div>
      );
    }

    return null;
  })();

  const pricingSection = (() => {
    if (!billingStatus || billingStatus.pricing.length === 0) {
      return (
        <p className="mb-12 text-center text-gray-500 dark:text-gray-400">
          {t('pricing.unavailable')}
        </p>
      );
    }

    return (
      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {billingStatus.pricing.map((plan) => (
          <PricingCard
            key={plan.billing_cycle}
            plan={plan}
            isLoading={isLoading}
            onSubscribe={handleSubscribe}
            t={t}
          />
        ))}
      </div>
    );
  })();

  const comparisonTable = (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
            <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
              Feature
            </th>
            <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">
              {t('comparison.freeColumn')}
            </th>
            <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">
              {t('comparison.premiumColumn')}
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_FEATURES.map((feature, index) => (
            <tr
              key={feature.label}
              className={`border-b border-gray-100 dark:border-gray-700/50 ${
                index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'
              }`}
            >
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{feature.label}</td>
              <td className="px-4 py-3 text-center">
                {feature.free ? (
                  <Check className="mx-auto h-4 w-4 text-green-500" />
                ) : (
                  <X className="mx-auto h-4 w-4 text-gray-300 dark:text-gray-600" />
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {feature.premium ? (
                  <Check className="mx-auto h-4 w-4 text-green-500" />
                ) : (
                  <X className="mx-auto h-4 w-4 text-gray-300 dark:text-gray-600" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('page.title')}</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">{t('page.subtitle')}</p>
      </div>

      {banner}

      {pricingSection}

      {comparisonTable}
    </div>
  );
}
