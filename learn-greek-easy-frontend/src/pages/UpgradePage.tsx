import React, { useEffect, useState } from 'react';

import { AlertTriangle, Check, Crown, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { PricingCard } from '@/components/billing/PricingCard';
import { Button } from '@/components/ui/button';
import { COMPARISON_FEATURES } from '@/constants/premiumFeatures';
import { useCheckout } from '@/hooks/useCheckout';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { reportAPIError } from '@/lib/errorReporting';
import { billingAPI } from '@/services/billingAPI';
import type { BillingCycle, BillingStatusResponse, PricingPlan } from '@/services/billingAPI';

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
        <div className="w-full max-w-sm rounded-xl border border-line bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/15">
            <AlertTriangle className="h-6 w-6 text-danger" />
          </div>
          <p className="mb-6 text-fg2">{t('error.title')}</p>
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
        <div className="w-full max-w-sm rounded-xl border border-line bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15">
            <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-fg">{t('alreadyPremium.title')}</h2>
          <p className="text-fg3">{t('alreadyPremium.description')}</p>
        </div>
      </div>
    );
  }

  const banner = (() => {
    if (!billingStatus) return null;
    const { subscription_status, trial_days_remaining } = billingStatus;

    if (subscription_status === 'trialing' && trial_days_remaining && trial_days_remaining > 0) {
      return (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/15 px-4 py-3 text-sm text-primary">
          {t('banner.trialActive', { days: trial_days_remaining })}
        </div>
      );
    }

    if (subscription_status === 'trialing' && trial_days_remaining === 0) {
      return (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/15 px-4 py-3 text-sm text-warning">
          {t('banner.trialExpired')}
        </div>
      );
    }

    if (subscription_status === 'past_due') {
      return (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/15 px-4 py-3 text-sm text-warning">
          {t('banner.pastDue')}
        </div>
      );
    }

    return null;
  })();

  const pricingSection = (() => {
    if (!billingStatus || billingStatus.pricing.length === 0) {
      return <p className="mb-12 text-center text-fg3">{t('pricing.unavailable')}</p>;
    }

    return (
      <>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
        <p className="mb-12 mt-4 text-center text-xs text-fg3">{t('pricing.moneyBack')}</p>
      </>
    );
  })();

  const comparisonTable = (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-bg-2">
            <th className="px-4 py-3 text-left font-medium text-fg2">
              {t('comparison.featureColumn')}
            </th>
            <th className="px-4 py-3 text-center font-medium text-fg2">
              {t('comparison.freeColumn')}
            </th>
            <th className="px-4 py-3 text-center font-medium text-fg2">
              {t('comparison.premiumColumn')}
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_FEATURES.map((feature, index) => (
            <tr
              key={feature.labelKey}
              className={`border-b border-line ${index % 2 === 0 ? 'bg-card' : 'bg-bg-2'}`}
            >
              <td className="px-4 py-3 text-fg2">{t(feature.labelKey)}</td>
              <td className="px-4 py-3 text-center">
                {typeof feature.free === 'string' ? (
                  <span className="text-xs font-medium text-fg3">{t(feature.free)}</span>
                ) : feature.free ? (
                  <Check className="mx-auto h-4 w-4 text-success" />
                ) : (
                  <X className="mx-auto h-4 w-4 text-fg3" />
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {typeof feature.premium === 'string' ? (
                  <span className="text-xs font-medium text-fg3">{t(feature.premium)}</span>
                ) : feature.premium ? (
                  <Check className="mx-auto h-4 w-4 text-success" />
                ) : (
                  <X className="mx-auto h-4 w-4 text-fg3" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-fg">{t('page.title')}</h1>
        <p className="mt-2 text-fg3">{t('page.subtitle')}</p>
      </div>

      {banner}

      {pricingSection}
      <h2 className="mb-6 text-center text-2xl font-bold text-fg">{t('comparison.heading')}</h2>
      {comparisonTable}
    </div>
  );
}
